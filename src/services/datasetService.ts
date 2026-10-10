import fs from 'fs';
import { query, withTransaction } from '../db';
import { Dataset, DatasetVersion, DatasetColumn } from '../types';
import { AppError } from '../middleware/errorHandler';
import { analyzeCsvFile } from '../utils/csv';

export class DatasetService {
  static async listDatasets(filters: {
    project_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<Dataset[]> {
    let sql = 'SELECT * FROM dataset_summary_view WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters.project_id) {
      sql += ` AND project_id = $${idx++}`;
      params.push(filters.project_id);
    }

    if (filters.search) {
      sql += ` AND (name ILIKE $${idx} OR description ILIKE $${idx})`;
      params.push(`%${filters.search}%`);
      idx++;
    }

    const sortCol = ['name', 'created_at', 'total_versions', 'total_storage_bytes'].includes(filters.sortBy || '')
      ? filters.sortBy
      : 'created_at';
    const sortDir = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${sortCol} ${sortDir}`;

    if (filters.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET $${idx++}`;
      params.push(filters.offset);
    }

    const res = await query<Dataset>(sql, params);
    return res.rows;
  }

  static async getDatasetById(id: string): Promise<Dataset> {
    const res = await query<Dataset>('SELECT * FROM dataset_summary_view WHERE id = $1', [id]);
    if (res.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', `Dataset with ID ${id} not found.`);
    }
    return res.rows[0];
  }

  static async createDataset(data: {
    name: string;
    project_id: string;
    description?: string;
    source?: string;
    type?: string;
    tags?: string[];
    created_by?: string;
  }): Promise<Dataset> {
    // 1. Verify project exists
    const projCheck = await query('SELECT id FROM projects WHERE id = $1', [data.project_id]);
    if (projCheck.rowCount === 0) {
      throw new AppError(400, 'FOREIGN_KEY_VIOLATION', `Project with ID ${data.project_id} does not exist.`);
    }

    const res = await query<Dataset>(
      `INSERT INTO datasets (name, project_id, description, source, type, tags, created_by)
       VALUES ($1, $2, $3, COALESCE($4, 'MANUAL_UPLOAD'), COALESCE($5, 'Structured Tabular'), COALESCE($6, ARRAY[]::TEXT[]), $7)
       RETURNING *`,
      [data.name, data.project_id, data.description || null, data.source, data.type, data.tags, data.created_by]
    );

    return res.rows[0];
  }

  static async updateDataset(
    id: string,
    data: { name?: string; description?: string; status?: string; tags?: string[] }
  ): Promise<Dataset> {
    await this.getDatasetById(id);

    const res = await query<Dataset>(
      `UPDATE datasets
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           tags = COALESCE($4, tags),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [data.name, data.description, data.status, data.tags, id]
    );

    return res.rows[0];
  }

  static async getDatasetVersions(datasetId: string): Promise<DatasetVersion[]> {
    await this.getDatasetById(datasetId);

    const res = await query<DatasetVersion>(
      `SELECT * FROM dataset_versions WHERE dataset_id = $1 ORDER BY version_number DESC`,
      [datasetId]
    );
    return res.rows;
  }

  /**
   * Atomic creation of dataset version with multi-statement rollback and physical file compensation.
   */
  static async createDatasetVersion(
    datasetId: string,
    file: Express.Multer.File,
    data: {
      commit_message?: string;
      version_label?: string;
      parent_version_id?: string;
      created_by?: string;
    }
  ): Promise<{ version: DatasetVersion; columns: DatasetColumn[] }> {
    // 1. Ensure dataset exists
    const dataset = await this.getDatasetById(datasetId);

    // 2. Validate parent version if provided
    if (data.parent_version_id) {
      const parentCheck = await query<DatasetVersion>(
        'SELECT id, dataset_id, version_number FROM dataset_versions WHERE id = $1',
        [data.parent_version_id]
      );
      if (parentCheck.rowCount === 0) {
        // Compensate: delete newly uploaded file
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new AppError(400, 'INVALID_PARENT', `Parent version with ID ${data.parent_version_id} does not exist.`);
      }
      if (parentCheck.rows[0].dataset_id !== datasetId) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new AppError(400, 'INVALID_PARENT', 'Parent version must belong to the exact same dataset.');
      }
    }

    // 3. Extract CSV metadata and SHA-256 hash from uploaded bytes
    let csvResult;
    try {
      csvResult = await analyzeCsvFile(file.path);
    } catch (parseErr: any) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError(400, 'MALFORMED_CSV', `Failed to parse CSV file: ${parseErr.message}`);
    }

    // 4. Check for duplicate SHA-256 within the same dataset (Deduplication Policy)
    const dupCheck = await query<DatasetVersion>(
      'SELECT id, version_number, version_label FROM dataset_versions WHERE dataset_id = $1 AND checksum_sha256 = $2',
      [datasetId, csvResult.checksum_sha256]
    );

    if (dupCheck.rowCount && dupCheck.rowCount > 0) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      const existing = dupCheck.rows[0];
      throw new AppError(
        409,
        'DUPLICATE_FILE',
        `Exact duplicate file with SHA-256 checksum ${csvResult.checksum_sha256} already exists in this dataset as ${existing.version_label} (version ${existing.version_number}).`,
        { existing_version_id: existing.id, version_number: existing.version_number }
      );
    }

    // 5. Execute atomic transaction
    try {
      return await withTransaction(async (client) => {
        // Lock dataset row to serialize version numbering per dataset
        await client.query('SELECT id FROM datasets WHERE id = $1 FOR UPDATE', [datasetId]);
        const maxVerRes = await client.query<{ max_ver: number }>(
          'SELECT COALESCE(MAX(version_number), 0) AS max_ver FROM dataset_versions WHERE dataset_id = $1',
          [datasetId]
        );
        const nextVersionNumber = Number(maxVerRes.rows[0].max_ver) + 1;
        const versionLabel = data.version_label || `v${nextVersionNumber}.0.0`;

        // Insert dataset_versions
        const verInsertRes = await client.query<DatasetVersion>(
          `INSERT INTO dataset_versions (
             dataset_id, version_number, version_label, parent_version_id,
             file_name, storage_path, file_size_bytes, row_count, column_count,
             checksum_sha256, schema_fingerprint, commit_message, created_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            datasetId,
            nextVersionNumber,
            versionLabel,
            data.parent_version_id || null,
            file.originalname,
            file.path,
            csvResult.file_size_bytes,
            csvResult.row_count,
            csvResult.column_count,
            csvResult.checksum_sha256,
            csvResult.schema_fingerprint,
            data.commit_message || `Version ${versionLabel} created.`,
            data.created_by || null,
          ]
        );
        const createdVersion = verInsertRes.rows[0];

        // Insert extracted column metadata
        const insertedColumns: DatasetColumn[] = [];
        for (const col of csvResult.columns) {
          const colRes = await client.query<DatasetColumn>(
            `INSERT INTO dataset_columns (
               version_id, column_name, data_type, is_nullable, ordinal_position,
               null_count, distinct_count, sample_values
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
              createdVersion.id,
              col.column_name,
              col.data_type,
              col.is_nullable,
              col.ordinal_position,
              col.null_count,
              col.distinct_count,
              JSON.stringify(col.sample_values),
            ]
          );
          insertedColumns.push(colRes.rows[0]);
        }

        // Insert parent derivation lineage if parent_version_id was specified
        if (data.parent_version_id) {
          await client.query(
            `INSERT INTO dataset_lineage (
               source_version_id, target_version_id, transformation_type
             ) VALUES ($1, $2, 'VERSION_DERIVATION')
             ON CONFLICT DO NOTHING`,
            [data.parent_version_id, createdVersion.id]
          );
        }

        // Note: The database trigger trg_after_insert_dataset_version handles automatic insertion
        // into activity_logs without double logging from application code.

        return { version: createdVersion, columns: insertedColumns };
      });
    } catch (txErr) {
      // Transaction failed and was rolled back by withTransaction; compensate file storage
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupErr) {
          console.error('Failed to unlink uploaded file during rollback compensation:', cleanupErr);
        }
      }
      throw txErr;
    }
  }

  static async getVersionById(versionId: string): Promise<{ version: DatasetVersion; columns: DatasetColumn[] }> {
    const verRes = await query<DatasetVersion>('SELECT * FROM dataset_versions WHERE id = $1', [versionId]);
    if (verRes.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', `Dataset version with ID ${versionId} not found.`);
    }

    const colRes = await query<DatasetColumn>(
      'SELECT * FROM dataset_columns WHERE version_id = $1 ORDER BY ordinal_position ASC',
      [versionId]
    );

    return { version: verRes.rows[0], columns: colRes.rows };
  }
}
