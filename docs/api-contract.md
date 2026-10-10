# DataForge — REST API Contract

All endpoints reside under `/api`. Standard JSON responses follow:
`{ "success": true, "data": ... }` or `{ "success": false, "error": { "code": "...", "message": "..." } }`.

## 1. System Health
- `GET /api/health`
  - Verifies live PostgreSQL connectivity via `SELECT 1`.
  - Response 200: `{ "status": "UP", "database": "connected", "timestamp": "..." }`

## 2. Users
- `GET /api/users`
  - Query params: `role`, `status`, `limit`, `offset`
- `POST /api/users`
  - Body: `{ "name": "string", "email": "string", "role": "ADMIN"|"DATA_ENGINEER"|"VIEWER" }`
  - Response 201: User entity
- `GET /api/users/:id`

## 3. Projects
- `GET /api/projects`
  - Query params: `search`, `limit`, `offset`
- `POST /api/projects`
  - Body: `{ "name": "string", "slug": "string" (opt), "description": "string", "owner_id": "uuid" }`
  - Response 201: Created project
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
  - Body: `{ "name"?: "string", "description"?: "string" }`
- `GET /api/projects/:id/members`
- `POST /api/projects/:id/members`
  - Body: `{ "user_id": "uuid", "role": "string" }`
- `GET /api/projects/:id/datasets`

## 4. Datasets
- `GET /api/datasets`
  - Query params: `project_id`, `search`, `limit`, `offset`, `sortBy`, `sortOrder`
- `POST /api/datasets`
  - Body: `{ "project_id": "uuid", "name": "string", "description"?: "string", "type"?: "TABULAR", "tags"?: string[], "created_by"?: "uuid" }`
- `GET /api/datasets/:id`
  - Returns dataset details + summary metrics (latest version, version count, total storage)
- `PATCH /api/datasets/:id`
- `GET /api/datasets/:id/versions`
- `POST /api/datasets/:id/versions` (Multipart/form-data)
  - Fields: `file` (CSV), `commit_message`, `version_label` (opt), `parent_version_id` (opt), `created_by` (opt)
  - Response 201: Created dataset version + extracted column metadata

## 5. Versions
- `GET /api/versions/:id`
  - Returns version metadata + column list
- `GET /api/versions/:id/columns`
- `GET /api/versions/:id/compare/:otherVersionId`
  - Compares schemas, added/removed columns, row count diff, and computed Jaccard similarity

## 6. Models & Model Versions
- `GET /api/models`
  - Query params: `project_id`
- `POST /api/models`
  - Body: `{ "project_id": "uuid", "name": "string", "description"?: "string", "framework": "string", "task_type"?: "string", "created_by"?: "uuid" }`
- `GET /api/models/:id`
- `GET /api/models/:id/versions`
- `POST /api/models/:id/versions`
  - Body: `{ "version": "string", "dataset_version_id"?: "uuid", "algorithm": "string", "hyperparameters"?: object, "endpoint_url"?: "string", "created_by"?: "uuid" }`
- `GET /api/models/versions/:id`

## 7. Experiments & Metrics
- `GET /api/experiments`
  - Query params: `model_version_id`, `dataset_version_id`, `status`
- `POST /api/experiments`
  - Body: `{ "name": "string", "dataset_version_id": "uuid", "model_version_id": "uuid", "notes"?: "string", "created_by"?: "uuid" }`
- `GET /api/experiments/:id`
- `PATCH /api/experiments/:id`
  - Body: `{ "status"?: "PLANNED"|"RUNNING"|"COMPLETED"|"FAILED", "notes"?: "string" }`
- `POST /api/experiments/:id/metrics`
  - Body: `{ "accuracy"?: number, "precision_score"?: number, "recall_score"?: number, "f1_score"?: number, "loss"?: number, "roc_auc"?: number, "extra_metrics"?: object }`
- `GET /api/experiments/:id/metrics`

## 8. Lineage
- `GET /api/lineage/datasets/:datasetId`
  - Lineage of all versions under a dataset, including parent-child dependencies and connected models/experiments
- `GET /api/lineage/versions/:versionId`
  - Recursive upstream and downstream ancestry for a specific version

## 9. Analysis
- `POST /api/ai/check-similarity`
  - Body: `{ "base_version_id": "uuid", "compared_version_id": "uuid" }`
  - Computes and stores schema Jaccard similarity and metric comparison
- `POST /api/analysis/drift`
  - Body: `{ "base_version_id": "uuid", "compared_version_id": "uuid" }`
  - Computes numeric feature distribution shifts and stores drift score

## 10. Analytics
- `GET /api/analytics/summary`
  - System-level totals (projects, datasets, versions, models, experiments, storage bytes)
- `GET /api/analytics/datasets`
  - Dataset velocity, distribution by project, size rankings
- `GET /api/analytics/experiments`
  - Experiment completion rates, average accuracy, top models via `best_experiments_view`

## 11. Activity Logs
- `GET /api/activity-logs`
  - Query params: `project_id`, `entity_type`, `user_id`, `limit`, `offset`

