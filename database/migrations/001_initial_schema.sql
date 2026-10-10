-- DataForge Migration 001: Initial Schema
-- Tables, Primary Keys, Foreign Keys, Check Constraints, Indexes

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    avatar VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_role CHECK (role IN ('ADMIN', 'DATA_ENGINEER', 'VIEWER', 'Admin', 'Data Engineer', 'Viewer')),
    CONSTRAINT chk_user_status CHECK (status IN ('Active', 'Suspended', 'Inactive'))
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Project Members Table
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

-- 4. Datasets Table
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT,
    source VARCHAR(100) DEFAULT 'MANUAL_UPLOAD',
    type VARCHAR(50) NOT NULL DEFAULT 'TABULAR',
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Dataset Versions Table
CREATE TABLE IF NOT EXISTS dataset_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_label VARCHAR(50) NOT NULL,
    parent_version_id UUID REFERENCES dataset_versions(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    row_count BIGINT NOT NULL,
    column_count INTEGER NOT NULL,
    checksum_sha256 CHAR(64) NOT NULL,
    schema_fingerprint VARCHAR(64) NOT NULL,
    commit_message TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_dataset_version_number UNIQUE (dataset_id, version_number),
    CONSTRAINT chk_version_number_positive CHECK (version_number > 0),
    CONSTRAINT chk_no_self_parent CHECK (parent_version_id IS NULL OR parent_version_id <> id)
);

-- 6. Dataset Columns Table
CREATE TABLE IF NOT EXISTS dataset_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    column_name VARCHAR(100) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    is_nullable BOOLEAN NOT NULL DEFAULT true,
    column_order INTEGER NOT NULL,
    null_count BIGINT DEFAULT 0,
    distinct_count BIGINT,
    sample_values JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Models Table
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT,
    framework VARCHAR(50) NOT NULL,
    task_type VARCHAR(50) DEFAULT 'Classification',
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Model Versions Table
CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    dataset_version_id UUID REFERENCES dataset_versions(id) ON DELETE SET NULL,
    algorithm VARCHAR(100) NOT NULL,
    hyperparameters JSONB DEFAULT '{}'::jsonb,
    endpoint_url VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Experiments Table
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    model_version_id UUID NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_experiment_status CHECK (status IN ('PLANNED', 'RUNNING', 'COMPLETED', 'FAILED'))
);

-- 10. Experiment Metrics Table
CREATE TABLE IF NOT EXISTS experiment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    accuracy NUMERIC(7, 4),
    precision_score NUMERIC(7, 4),
    recall_score NUMERIC(7, 4),
    f1_score NUMERIC(7, 4),
    loss NUMERIC(10, 6),
    roc_auc NUMERIC(7, 4),
    extra_metrics JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_metrics_accuracy CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 1)),
    CONSTRAINT chk_metrics_precision CHECK (precision_score IS NULL OR (precision_score >= 0 AND precision_score <= 1)),
    CONSTRAINT chk_metrics_recall CHECK (recall_score IS NULL OR (recall_score >= 0 AND recall_score <= 1)),
    CONSTRAINT chk_metrics_f1 CHECK (f1_score IS NULL OR (f1_score >= 0 AND f1_score <= 1)),
    CONSTRAINT chk_metrics_loss CHECK (loss IS NULL OR loss >= 0),
    CONSTRAINT chk_metrics_roc_auc CHECK (roc_auc IS NULL OR (roc_auc >= 0 AND roc_auc <= 1))
);

-- 11. Dataset Lineage Table
CREATE TABLE IF NOT EXISTS dataset_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    target_version_id UUID REFERENCES dataset_versions(id) ON DELETE CASCADE,
    model_version_id UUID REFERENCES model_versions(id) ON DELETE CASCADE,
    lineage_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Dataset Similarity Table
CREATE TABLE IF NOT EXISTS dataset_similarity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    compared_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5, 4) NOT NULL,
    drift_score NUMERIC(7, 4) NOT NULL DEFAULT 0.0,
    comparison_method VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_similarity_range CHECK (similarity_score >= 0.0 AND similarity_score <= 1.0),
    CONSTRAINT chk_drift_range CHECK (drift_score >= 0.0)
);

-- 13. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_name VARCHAR(150),
    details TEXT,
    ip_address INET,
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Query Performance & Lookups
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_datasets_name ON datasets(name);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset_id ON dataset_versions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_checksum ON dataset_versions(checksum_sha256);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_parent_id ON dataset_versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_dataset_columns_version_id ON dataset_columns(version_id);
CREATE INDEX IF NOT EXISTS idx_models_project_id ON models(project_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_model_id ON model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_experiments_dataset_version ON experiments(dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_experiments_model_version ON experiments(model_version_id);
CREATE INDEX IF NOT EXISTS idx_experiment_metrics_experiment_id ON experiment_metrics(experiment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_version_column ON dataset_columns (version_id, column_name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_experiment_metrics_exp ON experiment_metrics (experiment_id);
CREATE INDEX IF NOT EXISTS idx_dataset_lineage_source ON dataset_lineage(source_version_id);
CREATE INDEX IF NOT EXISTS idx_dataset_similarity_base ON dataset_similarity(base_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_similarity_pair ON dataset_similarity (base_version_id, compared_version_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
