import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { UserService, ProjectService } from '../services/projectService';
import { DatasetService } from '../services/datasetService';
import { ModelService, ExperimentService } from '../services/modelService';
import { LineageService, AnalysisService, AnalyticsService } from '../services/analysisService';
import { AppError } from '../middleware/errorHandler';

export class HealthController {
  static async check(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbStart = Date.now();
      const dbCheck = await pool.query('SELECT 1 as alive');
      const dbLatencyMs = Date.now() - dbStart;

      res.status(200).json({
        success: true,
        data: {
          status: 'UP',
          database: dbCheck.rows[0].alive === 1 ? 'connected' : 'unhealthy',
          database_latency_ms: dbLatencyMs,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export class UsersController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await UserService.listUsers({
        role: req.query.role as string,
        status: req.query.status as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.status(200).json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserService.getUserById(req.params.id);
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email address'),
        role: z.string().optional(),
        avatar: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const user = await UserService.createUser(data);
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
}

export class ProjectsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projects = await ProjectService.listProjects({
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.status(200).json({ success: true, data: projects });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const project = await ProjectService.getProjectById(req.params.id);
      res.status(200).json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        slug: z.string().optional(),
        description: z.string().optional(),
        owner_id: z.string().uuid('Invalid owner_id UUID'),
      });
      const data = schema.parse(req.body);
      const project = await ProjectService.createProject(data);
      res.status(201).json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        name: z.string().min(2).optional(),
        description: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const project = await ProjectService.updateProject(req.params.id, data);
      res.status(200).json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  }

  static async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const members = await ProjectService.getProjectMembers(req.params.id);
      res.status(200).json({ success: true, data: members });
    } catch (err) {
      next(err);
    }
  }

  static async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        user_id: z.string().uuid('Invalid user_id UUID'),
        role: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const member = await ProjectService.addProjectMember(req.params.id, data);
      res.status(201).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  }

  static async getDatasets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const datasets = await ProjectService.getProjectDatasets(req.params.id);
      res.status(200).json({ success: true, data: datasets });
    } catch (err) {
      next(err);
    }
  }
}

export class DatasetsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const datasets = await DatasetService.listDatasets({
        project_id: req.query.project_id as string,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as any,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.status(200).json({ success: true, data: datasets });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dataset = await DatasetService.getDatasetById(req.params.id);
      res.status(200).json({ success: true, data: dataset });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        name: z.string().min(1, 'Dataset name is required'),
        project_id: z.string().uuid('Invalid project_id UUID'),
        description: z.string().optional(),
        source: z.string().optional(),
        type: z.string().optional(),
        tags: z.array(z.string()).optional(),
        created_by: z.string().uuid().optional(),
      });
      const data = schema.parse(req.body);
      const dataset = await DatasetService.createDataset(data);
      res.status(201).json({ success: true, data: dataset });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z.string().optional(),
        tags: z.array(z.string()).optional(),
      });
      const data = schema.parse(req.body);
      const dataset = await DatasetService.updateDataset(req.params.id, data);
      res.status(200).json({ success: true, data: dataset });
    } catch (err) {
      next(err);
    }
  }

  static async listVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versions = await DatasetService.getDatasetVersions(req.params.id);
      res.status(200).json({ success: true, data: versions });
    } catch (err) {
      next(err);
    }
  }

  static async createVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError(400, 'FILE_REQUIRED', 'CSV file upload is required.');
      }

      const bodySchema = z.object({
        commit_message: z.string().optional(),
        version_label: z.string().optional(),
        parent_version_id: z.string().uuid().optional(),
        created_by: z.string().uuid().optional(),
      });
      const parsedBody = bodySchema.parse(req.body);

      const result = await DatasetService.createDatasetVersion(req.params.id, req.file, parsedBody);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export class VersionsController {
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DatasetService.getVersionById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async compare(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const comparison = await AnalysisService.compareVersions(req.params.id, req.params.otherVersionId);
      res.status(200).json({ success: true, data: comparison });
    } catch (err) {
      next(err);
    }
  }
}

export class ModelsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = await ModelService.listModels({
        project_id: req.query.project_id as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.status(200).json({ success: true, data: models });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const model = await ModelService.getModelById(req.params.id);
      res.status(200).json({ success: true, data: model });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        project_id: z.string().uuid('Invalid project_id UUID'),
        name: z.string().min(1, 'Model name is required'),
        description: z.string().optional(),
        framework: z.string().min(1, 'Framework is required'),
        task_type: z.string().optional(),
        created_by: z.string().uuid().optional(),
      });
      const data = schema.parse(req.body);
      const model = await ModelService.createModel(data);
      res.status(201).json({ success: true, data: model });
    } catch (err) {
      next(err);
    }
  }

  static async listVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const versions = await ModelService.listModelVersions(req.params.id);
      res.status(200).json({ success: true, data: versions });
    } catch (err) {
      next(err);
    }
  }

  static async createVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        version: z.string().min(1, 'Version label is required'),
        dataset_version_id: z.string().uuid().optional(),
        algorithm: z.string().min(1, 'Algorithm is required'),
        hyperparameters: z.record(z.any()).optional(),
        endpoint_url: z.string().optional(),
        created_by: z.string().uuid().optional(),
      });
      const data = schema.parse(req.body);
      const mv = await ModelService.createModelVersion(req.params.id, data);
      res.status(201).json({ success: true, data: mv });
    } catch (err) {
      next(err);
    }
  }

  static async getVersionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mv = await ModelService.getModelVersionById(req.params.id);
      res.status(200).json({ success: true, data: mv });
    } catch (err) {
      next(err);
    }
  }
}

export class ExperimentsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const experiments = await ExperimentService.listExperiments({
        model_version_id: req.query.model_version_id as string,
        dataset_version_id: req.query.dataset_version_id as string,
        status: req.query.status as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.status(200).json({ success: true, data: experiments });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exp = await ExperimentService.getExperimentById(req.params.id);
      res.status(200).json({ success: true, data: exp });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        name: z.string().min(1, 'Experiment name is required'),
        dataset_version_id: z.string().uuid('Invalid dataset_version_id UUID'),
        model_version_id: z.string().uuid('Invalid model_version_id UUID'),
        notes: z.string().optional(),
        status: z.string().optional(),
        created_by: z.string().uuid().optional(),
      });
      const data = schema.parse(req.body);
      const exp = await ExperimentService.createExperiment(data);
      res.status(201).json({ success: true, data: exp });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        status: z.string().optional(),
        notes: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const exp = await ExperimentService.updateExperiment(req.params.id, data);
      res.status(200).json({ success: true, data: exp });
    } catch (err) {
      next(err);
    }
  }

  static async addMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        accuracy: z.number().min(0).max(1).optional(),
        precision_score: z.number().min(0).max(1).optional(),
        recall_score: z.number().min(0).max(1).optional(),
        f1_score: z.number().min(0).max(1).optional(),
        loss: z.number().min(0).optional(),
        roc_auc: z.number().min(0).max(1).optional(),
        extra_metrics: z.record(z.any()).optional(),
      });
      const data = schema.parse(req.body);
      const metric = await ExperimentService.addMetrics(req.params.id, data);
      res.status(201).json({ success: true, data: metric });
    } catch (err) {
      next(err);
    }
  }

  static async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await ExperimentService.getMetrics(req.params.id);
      res.status(200).json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  }
}

export class LineageController {
  static async getDatasetLineage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lineage = await LineageService.getDatasetLineage(req.params.datasetId);
      res.status(200).json({ success: true, data: lineage });
    } catch (err) {
      next(err);
    }
  }

  static async getVersionLineage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lineage = await LineageService.getVersionLineage(req.params.versionId);
      res.status(200).json({ success: true, data: lineage });
    } catch (err) {
      next(err);
    }
  }
}

export class AnalysisController {
  static async checkSimilarity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        base_version_id: z.string().uuid('Invalid base_version_id UUID'),
        compared_version_id: z.string().uuid('Invalid compared_version_id UUID'),
      });
      const data = schema.parse(req.body);
      const result = await AnalysisService.checkSimilarity(data.base_version_id, data.compared_version_id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async calculateDrift(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        base_version_id: z.string().uuid('Invalid base_version_id UUID'),
        compared_version_id: z.string().uuid('Invalid compared_version_id UUID'),
      });
      const data = schema.parse(req.body);
      const result = await AnalysisService.calculateDrift(data.base_version_id, data.compared_version_id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export class AnalyticsController {
  static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await AnalyticsService.getSummary();
      res.status(200).json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  static async getDatasets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AnalyticsService.getDatasetAnalytics();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getExperiments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AnalyticsService.getExperimentAnalytics();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export class ActivityLogsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await AnalyticsService.listActivityLogs({
        project_id: req.query.project_id as string,
        entity_type: req.query.entity_type as string,
        user_id: req.query.user_id as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      });
      res.status(200).json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
}

