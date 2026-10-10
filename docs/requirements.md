# DataForge — Requirements Specification

## 1. Project Mission & System Purpose
DataForge is a dataset and machine-learning experiment lineage management system designed as an academic DBMS project.
Its purpose is to track how datasets evolve across versions, which machine learning models utilize particular dataset versions, which experiments were performed, what metrics those experiments achieved, and how all those artifacts relate to one another in an auditable relational graph.

A dataset in DataForge is never treated as an isolated flat file:
- It belongs to an explicit **Project** with an **Owner** and designated **Members**.
- It maintains schema definitions, row/column counts, and SHA-256 byte checksums.
- It evolves through **Dataset Versions** with parent-child ancestry.
- It feeds into **Models** and specific **Model Versions**.
- It is evaluated via **Experiments** that record multidimensional **Experiment Metrics** (accuracy, precision, recall, f1, loss, roc_auc, and arbitrary JSON metrics).
- It provides full bi-directional **Lineage** traversing from project to raw dataset, through version transitions, to trained models and experiment evaluations.
- It tracks system activity via automated PostgreSQL **Triggers** into immutable **Activity Logs**.
- It provides explainable, deterministic **Dataset Similarity** and **Data Drift** analysis.

---

## 2. Core Functional Requirements

### FR-1: User Management
- Support creating and listing users with roles (`ADMIN`, `DATA_ENGINEER`, `VIEWER`) and statuses (`Active`, `Suspended`, `Inactive`).
- Enforce unique email addresses.

### FR-2: Project Management & RBAC Membership
- Projects must possess a unique ID, human-readable name, unique slug, description, and designated owner (`owner_id` referencing `users.id`).
- When a project is created, the owner must be atomically enrolled as a member with the `OWNER` role inside the same database transaction.
- Support listing projects, retrieving project details, updating metadata, listing project members, and listing datasets associated with a project.
- Mandatory consistency guarantee: Project creation must be immediately visible in `GET /api/projects` and committed to PostgreSQL.

### FR-3: Dataset Registry & Project Association
- Every dataset must belong to a valid project via foreign key constraint (`project_id` referencing `projects.id`).
- Support dataset metadata updates, filtering by project, searching, and sorting.
- Provide comprehensive dataset summary information including latest version number, total version count, and total storage footprint.

### FR-4: CSV Upload, Checksum Calculation & Metadata Extraction
- Real multipart/form-data CSV uploads via Express and Multer.
- Files stored on the local filesystem (`uploads/`) with cryptographically secure random names; raw filesystem paths are not exposed to clients.
- Server-side SHA-256 calculation derived strictly from uploaded byte streams.
- Real-time CSV parsing extracting row count, column count, column names, null counts, distinct counts, and inferred data types (`INTEGER`, `NUMERIC`, `TEXT`, `BOOLEAN`, `TIMESTAMP`).
- MVP upload limit enforced at 50MB.

### FR-5: Dataset Versioning & Deduplication Policy
- Each dataset version captures `version_number` (strictly monotonic integer per dataset), `version_label` (e.g. `v1.0.0`), optional `parent_version_id`, `commit_message`, file size, row/column counts, SHA-256 checksum, schema fingerprint, and temporal validity (`valid_from`, `valid_to`).
- Unique constraint enforces `(dataset_id, version_number)`.
- Parent versions must belong to the exact same dataset; circular ancestry is strictly prevented.
- Deduplication Policy:
  - Exact file duplicate in same dataset: Rejected with HTTP 409 Conflict.
  - Same file uploaded to different dataset: Permitted as a distinct entity referencing its own project/dataset context.
- Multi-step atomic transaction: File validation -> Parent verification -> Version insert -> Column metadata insert -> Lineage insert -> Activity log trigger. Rolls back cleanly upon any step failure.

### FR-6: Dataset Schema Comparison, Similarity & Drift Analysis
- **Exact Duplicate Detection**: Fast index lookup on SHA-256 checksum.
- **Schema Comparison**: Computes Jaccard index on column sets and identifies added, removed, or type-modified columns.
- **Explainable Similarity**: Combined structural Jaccard similarity and metadata metrics yielding a deterministic score between 0.0 and 1.0.
- **Statistical Data Drift**: Compares continuous numeric columns between versions using normalized Kolmogorov-Smirnov (KS) statistic / Population Stability Index (PSI) proxy, returning distribution shift metrics per feature and overall dataset drift. Persisted in `dataset_similarity` table.

### FR-7: Models & Model Versions
- Manage machine learning models scoped to projects with framework metadata (e.g. `Scikit-learn`, `PyTorch`, `TensorFlow`, `XGBoost`).
- Track discrete model versions with hyperparameters, algorithm names, and links to training dataset versions.

### FR-8: Experiments & Multi-dimensional Metrics
- Record ML experiments tying together a specific `model_version_id` and `dataset_version_id`.
- Track experiment lifecycle statuses: `PLANNED`, `RUNNING`, `COMPLETED`, `FAILED`.
- Store evaluation metrics: `accuracy`, `precision_score`, `recall_score`, `f1_score`, `loss`, `roc_auc`, and extensible `extra_metrics` JSONB.
- Support metric validation (e.g., loss >= 0; accuracy, precision, recall, f1, roc_auc between 0 and 1).

### FR-9: Relational Lineage Graph
- Maintain upstream and downstream dependencies across datasets, versions, models, and experiments.
- Queryable via PostgreSQL recursive CTEs for arbitrary depth ancestry and full graph export for frontend visualization.

### FR-10: Automated Activity & Audit Logging
- PostgreSQL database trigger on `dataset_versions` automatically logs creation events into `activity_logs`.
- Application-level transactional logging for other key lifecycle events.
- Filterable and paginated audit query API.

### FR-11: Database-Backed Analytics
- System-wide aggregations: projects, datasets, versions, models, experiments, storage.
- Project-level breakdown and version velocity.
- Best performing experiments ranked by specified metric utilizing PostgreSQL Views and subqueries.

