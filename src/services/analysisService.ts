import fs from 'fs';
import { query } from '../db';
import { DatasetService } from './datasetService';
import { computeDatasetDrift, calculateJaccardSimilarity, DriftAnalysisResult } from '../utils/drift';
import { AppError } from '../middleware/errorHandler';

export class LineageService {
  /**
   * Retrieves full lineage graph for a dataset including all versions,
   * derivation relationships, and connected downstream models and experiments.
   */
  static async getDatasetLineage(datasetId: string): Promise<any> {
    const dataset = await DatasetService.getDatasetById(datasetId);

    // 1. Get all versions under this dataset
    const versionsRes = await query(
      `SELECT id, version_number, version_label, parent_version_id, file_name, file_size_bytes, row_count, column_count, checksum_sha256, created_at
       FROM dataset_versions
       WHERE dataset_id = $1
       ORDER BY version_number ASC`,
      [datasetId]
    );

    const versionIds = versionsRes.rows.map((v) => v.id);

    if (versionIds.length === 0) {
      return {
        dataset,
        nodes: [{ id: dataset.id, type: 'DATASET', label: dataset.name }],
        edges: [],
      };
    }

    // 2. Fetch direct derivation & training lineage records
    const lineageRes = await query(
      `SELECT dl.id, dl.source_version_id, dl.target_version_id, dl.model_version_id, dl.transformation_type,
              mv.version as model_version_label, m.name as model_name, m.framework
       FROM dataset_lineage dl
       LEFT JOIN model_versions mv ON dl.model_version_id = mv.id
       LEFT JOIN models m ON mv.model_id = m.id
       WHERE dl.source_version_id = ANY($1::uuid[])`,
      [versionIds]
    );

    // 3. Fetch connected experiments
    const experimentsRes = await query(
      `SELECT e.id, e.name, e.status, e.dataset_version_id, e.model_version_id, em.accuracy, em.loss
       FROM experiments e
       LEFT JOIN experiment_metrics em ON em.experiment_id = e.id
       WHERE e.dataset_version_id = ANY($1::uuid[])`,
      [versionIds]
    );

    // Build unified nodes & edges for graph visualization
    const nodes: any[] = [];
    const edges: any[] = [];

    // Dataset root node
    nodes.push({ id: dataset.id, type: 'DATASET', label: dataset.name });

    // Version nodes
    for (const v of versionsRes.rows) {
      nodes.push({
        id: v.id,
        type: 'DATASET_VERSION',
        label: `${dataset.name} ${v.version_label}`,
        metadata: v,
      });
      edges.push({
        id: `e-d-${v.id}`,
        source: dataset.id,
        target: v.id,
        type: 'CONTAINS_VERSION',
      });
      if (v.parent_version_id) {
        edges.push({
          id: `e-v-${v.parent_version_id}-${v.id}`,
          source: v.parent_version_id,
          target: v.id,
          type: 'DERIVED_FROM',
        });
      }
    }

    // Model version nodes and edges
    for (const l of lineageRes.rows) {
      if (l.model_version_id) {
        const mvNodeId = `mv-${l.model_version_id}`;
        if (!nodes.some((n) => n.id === mvNodeId)) {
          nodes.push({
            id: mvNodeId,
            type: 'MODEL_VERSION',
            label: `${l.model_name || 'Model'} (${l.model_version_label})`,
            framework: l.framework,
          });
        }
        edges.push({
          id: `e-train-${l.source_version_id}-${l.model_version_id}`,
          source: l.source_version_id,
          target: mvNodeId,
          type: 'TRAINED_MODEL',
        });
      }
    }

    // Experiment nodes and edges
    for (const exp of experimentsRes.rows) {
      const expNodeId = `exp-${exp.id}`;
      nodes.push({
        id: expNodeId,
        type: 'EXPERIMENT',
        label: exp.name,
        status: exp.status,
        accuracy: exp.accuracy,
      });
      edges.push({
        id: `e-exp-${exp.dataset_version_id}-${exp.id}`,
        source: exp.dataset_version_id,
        target: expNodeId,
        type: 'EVALUATED_IN',
      });
    }

    return { dataset, nodes, edges };
  }

  /**
   * Recursive CTE traversal finding full upstream ancestry and downstream descendants of a specific version
   */
  static async getVersionLineage(versionId: string): Promise<any> {
    // 1. Recursive Ancestry (Upstream)
    const ancestryRes = await query(
      `WITH RECURSIVE version_ancestry AS (
         SELECT id, dataset_id, version_number, version_label, parent_version_id, checksum_sha256, 1 AS depth
         FROM dataset_versions
         WHERE id = $1

         UNION ALL

         SELECT dv.id, dv.dataset_id, dv.version_number, dv.version_label, dv.parent_version_id, dv.checksum_sha256, va.depth + 1
         FROM dataset_versions dv
         INNER JOIN version_ancestry va ON dv.id = va.parent_version_id
       )
       SELECT va.*, d.name AS dataset_name
       FROM version_ancestry va
       JOIN datasets d ON va.dataset_id = d.id
       ORDER BY depth ASC`,
      [versionId]
    );

    // 2. Recursive Descendants (Downstream)
    const descendantsRes = await query(
      `WITH RECURSIVE version_descendants AS (
         SELECT id, dataset_id, version_number, version_label, parent_version_id, checksum_sha256, 1 AS depth
         FROM dataset_versions
         WHERE id = $1

         UNION ALL

         SELECT dv.id, dv.dataset_id, dv.version_number, dv.version_label, dv.parent_version_id, dv.checksum_sha256, vd.depth + 1
         FROM dataset_versions dv
         INNER JOIN version_descendants vd ON dv.parent_version_id = vd.id
       )
       SELECT vd.*, d.name AS dataset_name
       FROM version_descendants vd
       JOIN datasets d ON vd.dataset_id = d.id
       ORDER BY depth ASC`,
      [versionId]
    );

    // 3. Connected models and experiments
    const modelsRes = await query(
      `SELECT mv.id, mv.version, mv.algorithm, m.name as model_name, m.framework
       FROM dataset_lineage dl
       JOIN model_versions mv ON dl.model_version_id = mv.id
       JOIN models m ON mv.model_id = m.id
       WHERE dl.source_version_id = $1`,
      [versionId]
    );

    const experimentsRes = await query(
      `SELECT e.id, e.name, e.status, em.accuracy, em.f1_score, em.loss
       FROM experiments e
       LEFT JOIN experiment_metrics em ON em.experiment_id = e.id
       WHERE e.dataset_version_id = $1`,
      [versionId]
    );

    return {
      version_id: versionId,
      ancestry: ancestryRes.rows,
      descendants: descendantsRes.rows,
      trained_models: modelsRes.rows,
      experiments: experimentsRes.rows,
    };
  }
}

export class AnalysisService {
  /**
   * Compares two dataset version schemas and returns structural difference
   */
  static async compareVersions(versionAId: string, versionBId: string): Promise<any> {
    const verA = await DatasetService.getVersionById(versionAId);
    const verB = await DatasetService.getVersionById(versionBId);

    const colsA = verA.columns.map((c) => c.column_name);
    const colsB = verB.columns.map((c) => c.column_name);

    const jaccard = calculateJaccardSimilarity(colsA, colsB);

    return {
      base_version: verA.version,
      compared_version: verB.version,
      jaccard_similarity: jaccard.score,
      shared_columns: jaccard.shared,
      added_columns: jaccard.added,
      removed_columns: jaccard.removed,
      row_count_diff: verB.version.row_count - verA.version.row_count,
      file_size_diff_bytes: verB.version.file_size_bytes - verA.version.file_size_bytes,
      exact_checksum_match: verA.version.checksum_sha256 === verB.version.checksum_sha256,
    };
  }

  /**
   * Checks similarity between two versions and records result in dataset_similarity
   */
  static async checkSimilarity(baseVersionId: string, comparedVersionId: string): Promise<any> {
    if (baseVersionId === comparedVersionId) {
      throw new AppError(400, 'INVALID_COMPARISON', 'Cannot compare a dataset version with itself.');
    }

    const comparison = await this.compareVersions(baseVersionId, comparedVersionId);

    // Upsert into dataset_similarity
    const res = await query(
      `INSERT INTO dataset_similarity (
         base_version_id, compared_version_id, similarity_score, drift_score, comparison_method,
         column_overlap_count, schema_match_ratio, shared_columns, details
       ) VALUES ($1, $2, $3, 0.0, 'JACCARD_SCHEMA_SIMILARITY', $4, $5, $6, $7)
       ON CONFLICT (base_version_id, compared_version_id) DO UPDATE SET
         similarity_score = EXCLUDED.similarity_score,
         column_overlap_count = EXCLUDED.column_overlap_count,
         schema_match_ratio = EXCLUDED.schema_match_ratio,
         shared_columns = EXCLUDED.shared_columns,
         details = EXCLUDED.details
       RETURNING *`,
      [
        baseVersionId,
        comparedVersionId,
        comparison.jaccard_similarity,
        comparison.shared_columns.length,
        comparison.jaccard_similarity,
        comparison.shared_columns,
        JSON.stringify(comparison),
      ]
    );

    return res.rows[0];
  }

  /**
   * Runs statistical distribution drift analysis on numeric columns between two versions
   */
  static async calculateDrift(baseVersionId: string, comparedVersionId: string): Promise<any> {
    if (baseVersionId === comparedVersionId) {
      throw new AppError(400, 'INVALID_COMPARISON', 'Cannot run drift analysis between identical versions.');
    }

    const verA = await DatasetService.getVersionById(baseVersionId);
    const verB = await DatasetService.getVersionById(comparedVersionId);

    const driftRes: DriftAnalysisResult = await computeDatasetDrift(
      verA.version.storage_path,
      verB.version.storage_path,
      verA.columns,
      verB.columns
    );

    // Upsert into dataset_similarity table
    const res = await query(
      `INSERT INTO dataset_similarity (
         base_version_id, compared_version_id, similarity_score, drift_score, comparison_method,
         column_overlap_count, schema_match_ratio, shared_columns, details
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (base_version_id, compared_version_id) DO UPDATE SET
         similarity_score = EXCLUDED.similarity_score,
         drift_score = EXCLUDED.drift_score,
         comparison_method = EXCLUDED.comparison_method,
         column_overlap_count = EXCLUDED.column_overlap_count,
         schema_match_ratio = EXCLUDED.schema_match_ratio,
         shared_columns = EXCLUDED.shared_columns,
         details = EXCLUDED.details
       RETURNING *`,
      [
        baseVersionId,
        comparedVersionId,
        driftRes.similarity_score,
        driftRes.drift_score,
        driftRes.comparison_method,
        driftRes.column_overlap_count,
        driftRes.schema_match_ratio,
        driftRes.shared_columns,
        JSON.stringify(driftRes.details),
      ]
    );

    return res.rows[0];
  }
}

export class AnalyticsService {
  static async getSummary(): Promise<any> {
    const summaryRes = await query(`
      SELECT 
        (SELECT COUNT(*) FROM projects) AS total_projects,
        (SELECT COUNT(*) FROM datasets) AS total_datasets,
        (SELECT COUNT(*) FROM dataset_versions) AS total_dataset_versions,
        (SELECT COUNT(*) FROM models) AS total_models,
        (SELECT COUNT(*) FROM experiments) AS total_experiments,
        (SELECT COALESCE(SUM(file_size_bytes), 0) FROM dataset_versions) AS total_storage_bytes;
    `);

    return summaryRes.rows[0];
  }

  static async getDatasetAnalytics(): Promise<any> {
    const projectBreakdown = await query(`SELECT * FROM project_analytics_view ORDER BY dataset_count DESC;`);
    const datasetsSummary = await query(`SELECT * FROM dataset_summary_view ORDER BY total_versions DESC LIMIT 10;`);

    return {
      projects: projectBreakdown.rows,
      top_datasets: datasetsSummary.rows,
    };
  }

  static async getExperimentAnalytics(): Promise<any> {
    const statusCounts = await query(`
      SELECT status, COUNT(*) AS count
      FROM experiments
      GROUP BY status;
    `);

    const bestExperiments = await query(`
      SELECT * FROM best_experiments_view WHERE model_rank = 1 ORDER BY accuracy DESC NULLS LAST LIMIT 10;
    `);

    const highPerformingModels = await query(`
      SELECT 
        m.name AS model_name,
        m.framework,
        COUNT(e.id) AS completed_experiments,
        ROUND(AVG(em.accuracy), 4) AS avg_accuracy,
        ROUND(MIN(em.loss), 4) AS min_loss
      FROM models m
      JOIN model_versions mv ON mv.model_id = m.id
      JOIN experiments e ON e.model_version_id = mv.id
      JOIN experiment_metrics em ON em.experiment_id = e.id
      WHERE e.status = 'COMPLETED'
      GROUP BY m.id, m.name, m.framework
      HAVING COUNT(e.id) >= 1
      ORDER BY avg_accuracy DESC;
    `);

    return {
      status_distribution: statusCounts.rows,
      best_experiments: bestExperiments.rows,
      high_performing_models: highPerformingModels.rows,
    };
  }

  static async listActivityLogs(filters: {
    project_id?: string;
    entity_type?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let sql = 'SELECT * FROM activity_logs WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters.project_id) {
      sql += ` AND project_id = $${idx++}`;
      params.push(filters.project_id);
    }
    if (filters.entity_type) {
      sql += ` AND entity_type = $${idx++}`;
      params.push(filters.entity_type);
    }
    if (filters.user_id) {
      sql += ` AND user_id = $${idx++}`;
      params.push(filters.user_id);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET $${idx++}`;
      params.push(filters.offset);
    }

    const res = await query(sql, params);
    return res.rows;
  }
}
