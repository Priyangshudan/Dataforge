# DataForge — Dataset, Model, and Experiment Lineage Management DBMS

DataForge is an academic Database Management System (DBMS) backend built from absolute zero using **PostgreSQL 18**, **Node.js**, **TypeScript**, and **Express**. It models, versions, profiles, and tracks full lineage across datasets, machine learning models, training versions, experiments, and multidimensional evaluation metrics.

---

## 1. Core Architecture & DBMS Principles

- **Pure PostgreSQL Implementation**: No ORM abstraction layer. All queries utilize parameterized SQL, checked-out transaction clients, foreign key cascades/restrictions, check constraints, domain views, triggers, and recursive Common Table Expressions (CTEs).
- **Relational Lineage**: Recursive ancestry resolution via PostgreSQL CTEs for hierarchical DAG traversal from dataset versions to model versions and experiment evaluations.
- **Explainable Similarity & Drift**: SHA-256 byte deduplication, Jaccard schema similarity, and numerical feature distribution shift profiling (mean shifts & drift scoring) persisted directly into PostgreSQL.
- **Physical File & DB Atomicity**: Local multipart CSV ingestion with automatic filesystem compensation (unlink on transaction rollback).
- **Automatic Audit Logging**: PostgreSQL database trigger (`trg_after_insert_dataset_version`) automatically records version additions into immutable `activity_logs`.

---

## 2. Prerequisites & Environment Setup

- **Node.js**: v20+ (tested on Node v24.19.0)
- **PostgreSQL**: PostgreSQL 18+ running on `127.0.0.1:5432`
- **PowerShell** (Windows) or POSIX terminal

### Environment Variables (.env)
Copy `.env.example` to `.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/dataforge
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/dataforge_test
UPLOAD_DIR=uploads
MAX_FILE_SIZE_BYTES=52428800
```

---

## 3. Quickstart & Verification Commands (PowerShell)

### 1. Install Dependencies
```powershell
npm install
```

### 2. Build TypeScript Code
```powershell
npm run build
```

### 3. Run Database Migrations
Executes tracked migrations in order (`001_initial_schema.sql`, `002_views_triggers.sql`, `003_compat_and_drift.sql`):
```powershell
npm run db:migrate
```

### 4. Seed Database with Realistic Demonstration Data
Executes idempotent seed script populating 13 tables across customer intelligence, fraud detection, and retail domains:
```powershell
npm run db:seed
```

### 5. Run Integration & Acceptance Tests
Executes the comprehensive Vitest test suite testing database connectivity, migrations, project regression, rollback compensation, duplicate detection, recursive lineage, and view queries:
```powershell
npm test
```

### 6. Start the Backend Server
```powershell
npm run dev
# Or production mode:
npm start
```
Server starts on `http://localhost:5000`.

---

## 4. Academic DBMS Demonstrations

A dedicated SQL demonstration script is provided at `database/queries/demo_queries.sql`.
Run directly using `psql`:
```powershell
psql -U postgres -h 127.0.0.1 -p 5432 -d dataforge -f database/queries/demo_queries.sql
```

The script demonstrates:
1. **Multi-Table Relational Joins**: Projects -> Datasets -> Versions -> Experiments -> Model Versions -> Models -> Metrics.
2. **Aggregations & Profiling**: `COUNT`, `SUM`, `AVG`, `ROUND` across storage footprints and row counts.
3. **GROUP BY with HAVING**: Model evaluation aggregation filtering models with `AVG(accuracy) >= 0.80`.
4. **Subqueries**: Identifying experiments outperforming the overall benchmark accuracy.
5. **Recursive CTEs**: Multi-hop version ancestry tree traversal.
6. **Database Views**: Inspecting `best_experiments_view` and `dataset_summary_view`.
7. **Database Trigger Verification**: Confirming audit entries fired by `trg_after_insert_dataset_version`.

---

## 5. API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Live PostgreSQL connectivity check (`SELECT 1`) |
| `GET` | `/api/users` | List users with role/status filters |
| `POST` | `/api/users` | Create user (enforces unique email) |
| `GET` | `/api/projects` | List projects with search and pagination |
| `POST` | `/api/projects` | Create project & atomically enroll owner in transaction |
| `GET` | `/api/projects/:id` | Project details |
| `GET` | `/api/projects/:id/members` | Project membership list |
| `GET` | `/api/datasets` | List datasets with summary metrics |
| `POST` | `/api/datasets` | Create dataset under project |
| `GET` | `/api/datasets/:id` | Dataset details with version & storage counts |
| `GET` | `/api/datasets/:id/versions` | List dataset versions |
| `POST` | `/api/datasets/:id/versions` | Upload CSV (multipart), extract metadata, atomic commit |
| `GET` | `/api/versions/:id` | Dataset version details and extracted column schema |
| `GET` | `/api/versions/:id/compare/:otherId` | Schema Jaccard comparison and column diffs |
| `GET` | `/api/models` | List ML models |
| `POST` | `/api/models` | Create model under project |
| `POST` | `/api/models/:id/versions` | Create model version with hyperparameters & dataset link |
| `GET` | `/api/experiments` | List experiments |
| `POST` | `/api/experiments` | Create experiment linking model version to dataset version |
| `POST` | `/api/experiments/:id/metrics` | Add validated evaluation metrics |
| `GET` | `/api/lineage/datasets/:datasetId` | Full relational lineage DAG (nodes & edges) |
| `GET` | `/api/lineage/versions/:versionId` | Recursive ancestry and downstream lineage |
| `POST` | `/api/ai/check-similarity` | Compute and persist Jaccard schema similarity |
| `POST` | `/api/analysis/drift` | Compute and persist numeric feature distribution drift |
| `GET` | `/api/analytics/summary` | Global system aggregate counts |
| `GET` | `/api/analytics/datasets` | Dataset distribution by project & top datasets |
| `GET` | `/api/analytics/experiments` | Experiment statuses, model rankings, and top performers |
| `GET` | `/api/activity-logs` | Filterable, paginated audit activity logs |

