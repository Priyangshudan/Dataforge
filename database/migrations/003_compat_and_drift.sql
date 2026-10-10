-- DataForge Migration 003: Compatibility Alignment & Drift Extensions

-- 1. Broaden check constraints to support both capitalized and friendly strings
ALTER TABLE datasets DROP CONSTRAINT IF EXISTS chk_dataset_type;
ALTER TABLE datasets ADD CONSTRAINT chk_dataset_type 
    CHECK (type IN ('Structured Tabular', 'Feature Store', 'Raw Ingestion', 'Derived Gold', 'TABULAR', 'Tabular'));

ALTER TABLE models DROP CONSTRAINT IF EXISTS chk_model_status;
ALTER TABLE models ADD CONSTRAINT chk_model_status 
    CHECK (status IN ('Deployed', 'Staging', 'Archived', 'Active'));

ALTER TABLE experiments DROP CONSTRAINT IF EXISTS chk_experiment_status;
ALTER TABLE experiments ADD CONSTRAINT chk_experiment_status 
    CHECK (status IN ('Pending', 'Running', 'Completed', 'Failed', 'PLANNED', 'RUNNING', 'COMPLETED', 'FAILED'));

-- 2. Extend dataset_similarity table for advanced drift & similarity results
ALTER TABLE dataset_similarity ADD COLUMN IF NOT EXISTS drift_score NUMERIC(7,4) DEFAULT 0.0;
ALTER TABLE dataset_similarity ADD COLUMN IF NOT EXISTS comparison_method VARCHAR(50) DEFAULT 'JACCARD';
ALTER TABLE dataset_similarity ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE dataset_similarity ADD COLUMN IF NOT EXISTS schema_match_ratio NUMERIC(5,4);
ALTER TABLE dataset_similarity ADD COLUMN IF NOT EXISTS column_overlap_count INTEGER DEFAULT 0;
ALTER TABLE dataset_similarity ADD COLUMN IF NOT EXISTS shared_columns TEXT[] DEFAULT ARRAY[]::TEXT[];
DO $$
BEGIN
    ALTER TABLE dataset_similarity ALTER COLUMN schema_match_ratio DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
    ALTER TABLE dataset_similarity ALTER COLUMN column_overlap_count DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Extend dataset_columns table for rich column profiling
ALTER TABLE dataset_columns ADD COLUMN IF NOT EXISTS ordinal_position INTEGER DEFAULT 1;
ALTER TABLE dataset_columns ADD COLUMN IF NOT EXISTS column_order INTEGER DEFAULT 1;
DO $$
BEGIN
    ALTER TABLE dataset_columns ALTER COLUMN column_order DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
    ALTER TABLE dataset_columns ALTER COLUMN ordinal_position DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE dataset_columns ADD COLUMN IF NOT EXISTS null_count BIGINT DEFAULT 0;
ALTER TABLE dataset_columns ADD COLUMN IF NOT EXISTS distinct_count BIGINT;
ALTER TABLE dataset_columns ADD COLUMN IF NOT EXISTS sample_values JSONB DEFAULT '[]'::jsonb;

-- 4. Extend activity_logs for rich audit tracking
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_name VARCHAR(150);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255);

-- 5. Extend dataset_lineage for flexible transformation type labeling
ALTER TABLE dataset_lineage ADD COLUMN IF NOT EXISTS transformation_type VARCHAR(100) DEFAULT 'VERSION_DERIVATION';
ALTER TABLE dataset_lineage ADD COLUMN IF NOT EXISTS lineage_type VARCHAR(100) DEFAULT 'VERSION_DERIVATION';
DO $$
BEGIN
    ALTER TABLE dataset_lineage ALTER COLUMN lineage_type DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
    ALTER TABLE dataset_lineage ALTER COLUMN transformation_type DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
