-- DataForge Migration 002: Triggers, Functions, Views

-- 1. Helper function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_datasets_updated_at ON datasets;
CREATE TRIGGER trg_datasets_updated_at
    BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dataset_versions_updated_at ON dataset_versions;
CREATE TRIGGER trg_dataset_versions_updated_at
    BEFORE UPDATE ON dataset_versions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_models_updated_at ON models;
CREATE TRIGGER trg_models_updated_at
    BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 2. Trigger function for automatic activity logging on dataset version creation
CREATE OR REPLACE FUNCTION log_dataset_version_creation()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
    v_dataset_name VARCHAR(100);
BEGIN
    SELECT project_id, name INTO v_project_id, v_dataset_name
    FROM datasets
    WHERE id = NEW.dataset_id;

    INSERT INTO activity_logs (
        project_id,
        user_id,
        action,
        entity_type,
        entity_id,
        entity_name,
        details
    ) VALUES (
        v_project_id,
        NEW.created_by,
        'CREATE',
        'DATASET_VERSION',
        NEW.id,
        COALESCE(v_dataset_name, 'Dataset') || ' ' || NEW.version_label,
        COALESCE(NEW.commit_message, 'Version ' || NEW.version_label || ' created.')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_insert_dataset_version ON dataset_versions;
CREATE TRIGGER trg_after_insert_dataset_version
    AFTER INSERT ON dataset_versions
    FOR EACH ROW EXECUTE FUNCTION log_dataset_version_creation();

-- 3. Views

-- View 1: Dataset Summary View
CREATE OR REPLACE VIEW dataset_summary_view AS
SELECT 
    d.id,
    d.name,
    d.project_id,
    p.name AS project_name,
    d.description,
    d.type,
    d.status,
    d.created_at,
    d.updated_at,
    COUNT(dv.id) AS total_versions,
    COALESCE(MAX(dv.version_number), 0) AS latest_version_number,
    COALESCE(SUM(dv.file_size_bytes), 0) AS total_storage_bytes,
    COALESCE(MAX(dv.row_count), 0) AS latest_row_count
FROM datasets d
LEFT JOIN projects p ON d.project_id = p.id
LEFT JOIN dataset_versions dv ON d.id = dv.dataset_id
GROUP BY d.id, d.name, d.project_id, p.name, d.description, d.type, d.status, d.created_at, d.updated_at;

-- View 2: Best Experiments View
CREATE OR REPLACE VIEW best_experiments_view AS
WITH ranked_experiments AS (
    SELECT 
        e.id AS experiment_id,
        e.name AS experiment_name,
        m.id AS model_id,
        m.name AS model_name,
        mv.id AS model_version_id,
        mv.version AS model_version_label,
        mv.algorithm,
        d.id AS dataset_id,
        d.name AS dataset_name,
        dv.id AS dataset_version_id,
        dv.version_label AS dataset_version_label,
        em.accuracy,
        em.precision_score,
        em.recall_score,
        em.f1_score,
        em.loss,
        em.roc_auc,
        e.completed_at,
        ROW_NUMBER() OVER (
            PARTITION BY m.id 
            ORDER BY em.accuracy DESC NULLS LAST, em.f1_score DESC NULLS LAST
        ) AS model_rank
    FROM experiments e
    JOIN model_versions mv ON e.model_version_id = mv.id
    JOIN models m ON mv.model_id = m.id
    JOIN dataset_versions dv ON e.dataset_version_id = dv.id
    JOIN datasets d ON dv.dataset_id = d.id
    LEFT JOIN experiment_metrics em ON em.experiment_id = e.id
    WHERE e.status = 'COMPLETED'
)
SELECT * FROM ranked_experiments;

-- View 3: Project Analytics View
CREATE OR REPLACE VIEW project_analytics_view AS
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    p.slug,
    u.name AS owner_name,
    COUNT(DISTINCT d.id) AS dataset_count,
    COUNT(DISTINCT dv.id) AS version_count,
    COUNT(DISTINCT m.id) AS model_count,
    COALESCE(SUM(dv.file_size_bytes), 0) AS total_storage_bytes,
    p.created_at
FROM projects p
JOIN users u ON p.owner_id = u.id
LEFT JOIN datasets d ON d.project_id = p.id
LEFT JOIN dataset_versions dv ON dv.dataset_id = d.id
LEFT JOIN models m ON m.project_id = p.id
GROUP BY p.id, p.name, p.slug, u.name, p.created_at;

