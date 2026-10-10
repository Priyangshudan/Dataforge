import { Router } from 'express';
import {
  HealthController,
  UsersController,
  ProjectsController,
  DatasetsController,
  VersionsController,
  ModelsController,
  ExperimentsController,
  LineageController,
  AnalysisController,
  AnalyticsController,
  ActivityLogsController,
} from '../controllers';
import { upload } from '../middleware/upload';

const router = Router();

// Health
router.get('/health', HealthController.check);

// Users
router.get('/users', UsersController.list);
router.post('/users', UsersController.create);
router.get('/users/:id', UsersController.getById);

// Projects
router.get('/projects', ProjectsController.list);
router.post('/projects', ProjectsController.create);
router.get('/projects/:id', ProjectsController.getById);
router.patch('/projects/:id', ProjectsController.update);
router.get('/projects/:id/members', ProjectsController.getMembers);
router.post('/projects/:id/members', ProjectsController.addMember);
router.get('/projects/:id/datasets', ProjectsController.getDatasets);

// Datasets
router.get('/datasets', DatasetsController.list);
router.post('/datasets', DatasetsController.create);
router.get('/datasets/:id', DatasetsController.getById);
router.patch('/datasets/:id', DatasetsController.update);
router.get('/datasets/:id/versions', DatasetsController.listVersions);
router.post('/datasets/:id/versions', upload.single('file'), DatasetsController.createVersion);

// Versions
router.get('/versions/:id', VersionsController.getById);
router.get('/versions/:id/compare/:otherVersionId', VersionsController.compare);

// Models & Model Versions
router.get('/models', ModelsController.list);
router.post('/models', ModelsController.create);
router.get('/models/:id', ModelsController.getById);
router.get('/models/:id/versions', ModelsController.listVersions);
router.post('/models/:id/versions', ModelsController.createVersion);
router.get('/models/versions/:id', ModelsController.getVersionById);

// Experiments & Metrics
router.get('/experiments', ExperimentsController.list);
router.post('/experiments', ExperimentsController.create);
router.get('/experiments/:id', ExperimentsController.getById);
router.patch('/experiments/:id', ExperimentsController.update);
router.post('/experiments/:id/metrics', ExperimentsController.addMetrics);
router.get('/experiments/:id/metrics', ExperimentsController.getMetrics);

// Lineage
router.get('/lineage/datasets/:datasetId', LineageController.getDatasetLineage);
router.get('/lineage/versions/:versionId', LineageController.getVersionLineage);

// Analysis & Similarity
router.post('/ai/check-similarity', AnalysisController.checkSimilarity);
router.post('/analysis/drift', AnalysisController.calculateDrift);

// Analytics
router.get('/analytics/summary', AnalyticsController.getSummary);
router.get('/analytics/datasets', AnalyticsController.getDatasets);
router.get('/analytics/experiments', AnalyticsController.getExperiments);

// Activity Logs
router.get('/activity-logs', ActivityLogsController.list);

export default router;

