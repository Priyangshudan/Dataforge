# DataForge — System Architecture

## 1. Architectural Overview
DataForge is structured as a clean, layered backend service following the Controller-Service-Repository pattern backed directly by PostgreSQL 18.

```
+-------------------------------------------------------------------+
|                        Client Layer                               |
|       (REST Clients / Future React+Vite Frontend / Tests)         |
+-------------------------------------------------------------------+
                                  |
                                  v  HTTP / REST (JSON & Multipart)
+-------------------------------------------------------------------+
|                     Express Application Layer                     |
|  - CORS & Security Headers                                        |
|  - Multer File Upload Middleware (50MB streaming to /uploads)    |
|  - Centralized Zod Request Validation                             |
|  - Standardized JSON Error Handling (400, 404, 409, 413, 500)     |
+-------------------------------------------------------------------+
                                  |
                                  v  Route Dispatch
+-------------------------------------------------------------------+
|                         Controller Layer                          |
|  - HealthController      - ProjectsController    - DatasetsController
|  - VersionsController    - ModelsController      - ExperimentsController
|  - LineageController     - AnalysisController    - AnalyticsController
|  - ActivityLogsController- UsersController                           |
+-------------------------------------------------------------------+
                                  |
                                  v  Business Logic & Orchestration
+-------------------------------------------------------------------+
|                          Service Layer                            |
|  - ProjectService: atomic project creation + owner membership     |
|  - VersionService: CSV stream parse, SHA-256 hash, col metadata,  |
|                    dedup policy, atomic transaction rollback      |
|  - AnalysisService: Jaccard schema similarity, statistical drift  |
|  - LineageService: recursive ancestry and dependency graph        |
|  - AnalyticsService: aggregate queries, summary metrics           |
+-------------------------------------------------------------------+
                                  |
                                  v  Checked-out client or pool query
+-------------------------------------------------------------------+
|               Database Connection & Transaction Layer             |
|  - pg (node-postgres) Connection Pool                             |
|  - withTransaction(client, callback) with automatic COMMIT/ROLLBACK|
|  - Parameterized SQL execution (zero string interpolation)        |
+-------------------------------------------------------------------+
                                  |
                                  v  TCP 5432
+-------------------------------------------------------------------+
|                   PostgreSQL 18 DBMS Core                         |
|  - 13 Normalized Relational Tables + Check & FK Constraints       |
|  - Triggers: trg_after_insert_dataset_version -> activity_logs    |
|  - Views: dataset_summary_view, best_experiments_view, analytics |
|  - Recursive CTEs: Lineage graph traversal & version ancestry    |
|  - Indexes: B-tree on FKs, slugs, checksums, timestamps           |
+-------------------------------------------------------------------+
                                  |
                                  v  Local Filesystem
+-------------------------------------------------------------------+
|                   Physical File Storage                           |
|  - uploads/ directory for uploaded raw CSV bytes                  |
|  - Cryptographically hashed filenames                            |
|  - Transactional compensation: unlink on DB rollback             |
+-------------------------------------------------------------------+
```

---

## 2. Directory & Module Organization
```
Dataforge/
├── .env.example              # Documented environment variables template
├── .gitignore                # Git ignore rules (node_modules, .env, uploads)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript compiler settings
├── vitest.config.ts          # Integration test runner configuration
├── docs/                     # Comprehensive architecture and requirements
│   ├── requirements.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── api-contract.md
│   └── dbms-features.md
├── database/
│   ├── migrations/           # Ordered SQL migrations
│   │   ├── 001_initial_schema.sql
│   │   └── 002_views_triggers.sql
│   ├── seeds/
│   │   └── seed_data.sql     # Idempotent realistic demonstration seed data
│   └── queries/
│       └── demo_queries.sql  # Runnable SQL queries demonstrating DBMS features
├── src/
│   ├── config/               # Environment & app constants
│   ├── db/                   # Connection pool, transaction helper, migrations
│   ├── middleware/           # Error handler, validation, upload handling
│   ├── types/                # TypeScript interfaces & domain entities
│   ├── utils/                # CSV parser, SHA-256 hasher, statistical drift
│   ├── services/             # Core business logic & SQL query execution
│   ├── controllers/          # HTTP request handlers
│   ├── routes/               # Express route definitions
│   └── app.ts / index.ts     # Express app factory and server entrypoint
├── tests/                    # Integration & regression test suite
└── uploads/                  # Local directory for raw CSV files
```

---

## 3. Key Design Decisions

### 3.1 PostgreSQL as the Pure Source of Truth
No secondary document or graph database is introduced. Hierarchical dataset ancestry and experiment-model-dataset lineage are modeled via foreign keys and queried using PostgreSQL 18's high-performance **Recursive CTEs**.

### 3.2 Transaction Boundary & Compensation
Creating a dataset version involves writing a file to disk and executing 5 SQL operations. All SQL statements run within a single checked-out `pg.PoolClient` transaction (`BEGIN` -> `COMMIT`). If any SQL error occurs, `ROLLBACK` is issued and the newly saved CSV file is deleted from the filesystem, preventing orphaned files or partial records.

### 3.3 Explainable Similarity & Drift
Rather than black-box AI APIs, DataForge computes:
1. Exact file identity via SHA-256 checksums.
2. Structural schema similarity via the Jaccard index of column sets.
3. Statistical numerical drift by calculating distribution shifts (mean/variance/KS-proxy) across numeric columns between dataset versions, persisting results in `dataset_similarity`.

