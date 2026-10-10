import { query } from '../db';
import { Model, ModelVersion, Experiment, ExperimentMetric } from '../types';
import { AppError } from '../middleware/errorHandler';

export class ModelService {
  static async listModels(filters: { project_id?: string; limit?: number; offset?: number }): Promise<Model[]> {
    let sql = 'SELECT * FROM models WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters.project_id) {
      sql += ` AND project_id = $${idx++}`;
      params.push(filters.project_id);
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

    const res = await query<Model>(sql, params);
    return res.rows;
  }

  static async getModelById(id: string): Promise<Model> {
    const res = await query<Model>('SELECT * FROM models WHERE id = $1', [id]);
    if (res.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', `Model with ID ${id} not found.`);
    }
    return res.rows[0];
  }

  static async createModel(data: {
    project_id: string;
    name: string;
    description?: string;
    framework: string;
    task_type?: string;
    created_by?: string;
  }): Promise<Model> {
    const projCheck = await query('SELECT id FROM projects WHERE id = $1', [data.project_id]);
    if (projCheck.rowCount === 0) {
      throw new AppError(400, 'FOREIGN_KEY_VIOLATION', `Project with ID ${data.project_id} does not exist.`);
    }

    const res = await query<Model>(
      `INSERT INTO models (project_id, name, description, framework, task_type, created_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'Classification'), $6)
       RETURNING *`,
      [data.project_id, data.name, data.description || null, data.framework, data.task_type, data.created_by]
    );

    return res.rows[0];
  }

  static async listModelVersions(modelId: string): Promise<ModelVersion[]> {
    await this.getModelById(modelId);

    const res = await query<ModelVersion>(
      'SELECT * FROM model_versions WHERE model_id = $1 ORDER BY created_at DESC',
      [modelId]
    );
    return res.rows;
  }

  static async getModelVersionById(id: string): Promise<ModelVersion> {
    const res = await query<ModelVersion>('SELECT * FROM model_versions WHERE id = $1', [id]);
    if (res.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', `Model version with ID ${id} not found.`);
    }
    return res.rows[0];
  }

  static async createModelVersion(
    modelId: string,
    data: {
      version: string;
      dataset_version_id?: string;
      algorithm: string;
      hyperparameters?: Record<string, any>;
      endpoint_url?: string;
      created_by?: string;
    }
  ): Promise<ModelVersion> {
    await this.getModelById(modelId);

    if (data.dataset_version_id) {
      const dvCheck = await query('SELECT id FROM dataset_versions WHERE id = $1', [data.dataset_version_id]);
      if (dvCheck.rowCount === 0) {
        throw new AppError(400, 'FOREIGN_KEY_VIOLATION', `Dataset version ${data.dataset_version_id} does not exist.`);
      }
    }

    const res = await query<ModelVersion>(
      `INSERT INTO model_versions (
         model_id, version, dataset_version_id, algorithm, hyperparameters, endpoint_url, created_by
       ) VALUES ($1, $2, $3, $4, COALESCE($5, '{}'::jsonb), $6, $7)
       RETURNING *`,
      [
        modelId,
        data.version,
        data.dataset_version_id || null,
        data.algorithm,
        JSON.stringify(data.hyperparameters || {}),
        data.endpoint_url || null,
        data.created_by || null,
      ]
    );

    const createdMv = res.rows[0];

    // Record training lineage if dataset_version_id was linked
    if (data.dataset_version_id) {
      await query(
        `INSERT INTO dataset_lineage (source_version_id, model_version_id, transformation_type)
         VALUES ($1, $2, 'MODEL_TRAINING')
         ON CONFLICT DO NOTHING`,
        [data.dataset_version_id, createdMv.id]
      );
    }

    return createdMv;
  }
}

export class ExperimentService {
  static async listExperiments(filters: {
    model_version_id?: string;
    dataset_version_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Experiment[]> {
    let sql = `
      SELECT e.*, 
             em.accuracy, em.precision_score, em.recall_score, em.f1_score, em.loss, em.roc_auc,
             m.name as model_name, mv.version as model_version_label,
             d.name as dataset_name, dv.version_label as dataset_version_label
      FROM experiments e
      JOIN model_versions mv ON e.model_version_id = mv.id
      JOIN models m ON mv.model_id = m.id
      JOIN dataset_versions dv ON e.dataset_version_id = dv.id
      JOIN datasets d ON dv.dataset_id = d.id
      LEFT JOIN experiment_metrics em ON em.experiment_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters.model_version_id) {
      sql += ` AND e.model_version_id = $${idx++}`;
      params.push(filters.model_version_id);
    }
    if (filters.dataset_version_id) {
      sql += ` AND e.dataset_version_id = $${idx++}`;
      params.push(filters.dataset_version_id);
    }
    if (filters.status) {
      sql += ` AND e.status = $${idx++}`;
      params.push(filters.status);
    }

    sql += ' ORDER BY e.created_at DESC';

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

  static async getExperimentById(id: string): Promise<any> {
    const res = await query(
      `SELECT e.*, 
              em.accuracy, em.precision_score, em.recall_score, em.f1_score, em.loss, em.roc_auc, em.extra_metrics,
              m.name as model_name, mv.version as model_version_label, mv.algorithm,
              d.name as dataset_name, dv.version_label as dataset_version_label
       FROM experiments e
       JOIN model_versions mv ON e.model_version_id = mv.id
       JOIN models m ON mv.model_id = m.id
       JOIN dataset_versions dv ON e.dataset_version_id = dv.id
       JOIN datasets d ON dv.dataset_id = d.id
       LEFT JOIN experiment_metrics em ON em.experiment_id = e.id
       WHERE e.id = $1`,
      [id]
    );

    if (res.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', `Experiment with ID ${id} not found.`);
    }

    return res.rows[0];
  }

  static async createExperiment(data: {
    name: string;
    dataset_version_id: string;
    model_version_id: string;
    notes?: string;
    status?: string;
    created_by?: string;
  }): Promise<Experiment> {
    // 1. Verify dataset_version exists
    const dvCheck = await query('SELECT id FROM dataset_versions WHERE id = $1', [data.dataset_version_id]);
    if (dvCheck.rowCount === 0) {
      throw new AppError(400, 'FOREIGN_KEY_VIOLATION', `Dataset version ${data.dataset_version_id} does not exist.`);
    }

    // 2. Verify model_version exists
    const mvCheck = await query('SELECT id FROM model_versions WHERE id = $1', [data.model_version_id]);
    if (mvCheck.rowCount === 0) {
      throw new AppError(400, 'FOREIGN_KEY_VIOLATION', `Model version ${data.model_version_id} does not exist.`);
    }

    const res = await query<Experiment>(
      `INSERT INTO experiments (name, dataset_version_id, model_version_id, status, notes, created_by)
       VALUES ($1, $2, $3, COALESCE($4, 'COMPLETED'), $5, $6)
       RETURNING *`,
      [data.name, data.dataset_version_id, data.model_version_id, data.status, data.notes || null, data.created_by]
    );

    return res.rows[0];
  }

  static async updateExperiment(
    id: string,
    data: { status?: string; notes?: string }
  ): Promise<Experiment> {
    await this.getExperimentById(id);

    const res = await query<Experiment>(
      `UPDATE experiments
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           completed_at = CASE WHEN $1 = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id = $3
       RETURNING *`,
      [data.status, data.notes, id]
    );

    return res.rows[0];
  }

  static async addMetrics(
    experimentId: string,
    data: {
      accuracy?: number;
      precision_score?: number;
      recall_score?: number;
      f1_score?: number;
      loss?: number;
      roc_auc?: number;
      extra_metrics?: Record<string, any>;
    }
  ): Promise<ExperimentMetric> {
    await this.getExperimentById(experimentId);

    const res = await query<ExperimentMetric>(
      `INSERT INTO experiment_metrics (
         experiment_id, accuracy, precision_score, recall_score, f1_score, loss, roc_auc, extra_metrics
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '{}'::jsonb))
       RETURNING *`,
      [
        experimentId,
        data.accuracy !== undefined ? data.accuracy : null,
        data.precision_score !== undefined ? data.precision_score : null,
        data.recall_score !== undefined ? data.recall_score : null,
        data.f1_score !== undefined ? data.f1_score : null,
        data.loss !== undefined ? data.loss : null,
        data.roc_auc !== undefined ? data.roc_auc : null,
        JSON.stringify(data.extra_metrics || {}),
      ]
    );

    return res.rows[0];
  }

  static async getMetrics(experimentId: string): Promise<ExperimentMetric[]> {
    await this.getExperimentById(experimentId);

    const res = await query<ExperimentMetric>(
      'SELECT * FROM experiment_metrics WHERE experiment_id = $1 ORDER BY recorded_at DESC',
      [experimentId]
    );

    return res.rows;
  }
}

