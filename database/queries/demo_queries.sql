-- ============================================================================
-- DataForge DBMS Academic Demonstration Queries
-- ============================================================================
-- These queries showcase fundamental and advanced relational database concepts
-- executed directly on PostgreSQL 18: Joins, Aggregation, GROUP BY with HAVING,
-- Subqueries, Common Table Expressions (Recursive CTEs), Views, and Triggers.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DEMO 1: Complex Multi-Table Relational Join
-- Joins: Projects -> Datasets -> Dataset Versions -> Experiments -> Model Versions -> Models -> Metrics
-- Purpose: Complete lineage path linking business project to model accuracy.
-- ----------------------------------------------------------------------------
SELECT 
    p.name AS project_name,
    d.name AS dataset_name,
    dv.version_label AS dataset_version,
    dv.checksum_sha256 AS data_fingerprint,
    m.name AS model_name,
    mv.version AS model_version,
    mv.algorithm,
    e.name AS experiment_name,
    e.status AS experiment_status,
    em.accuracy,
    em.loss
FROM projects p
JOIN datasets d ON d.project_id = p.id
JOIN dataset_versions dv ON dv.dataset_id = d.id
JOIN experiments e ON e.dataset_version_id = dv.id
JOIN model_versions mv ON e.model_version_id = mv.id
JOIN models m ON mv.model_id = m.id
LEFT JOIN experiment_metrics em ON em.experiment_id = e.id
ORDER BY em.accuracy DESC NULLS LAST;


-- ----------------------------------------------------------------------------
-- DEMO 2: Aggregate Statistics & Dataset Storage Profiling
-- Purpose: Compute total storage, total rows, and average file sizes across projects.
-- ----------------------------------------------------------------------------
SELECT 
    p.name AS project_name,
    COUNT(DISTINCT d.id) AS total_datasets,
    COUNT(dv.id) AS total_versions,
    COALESCE(SUM(dv.file_size_bytes), 0) AS total_storage_bytes,
    ROUND(COALESCE(AVG(dv.file_size_bytes), 0) / 1024.0 / 1024.0, 2) AS avg_version_mb,
    COALESCE(SUM(dv.row_count), 0) AS total_rows_tracked
FROM projects p
LEFT JOIN datasets d ON d.project_id = p.id
LEFT JOIN dataset_versions dv ON dv.dataset_id = d.id
GROUP BY p.id, p.name
ORDER BY total_storage_bytes DESC;


-- ----------------------------------------------------------------------------
-- DEMO 3: GROUP BY with HAVING Clause
-- Purpose: Filter high-performing models that have completed experiments and 
-- achieved an average accuracy greater than or equal to 0.80.
-- ----------------------------------------------------------------------------
SELECT 
    m.name AS model_name,
    m.framework,
    COUNT(e.id) AS completed_experiments_count,
    ROUND(AVG(em.accuracy), 4) AS avg_accuracy,
    ROUND(MIN(em.loss), 4) AS min_loss,
    ROUND(MAX(em.roc_auc), 4) AS best_roc_auc
FROM models m
JOIN model_versions mv ON mv.model_id = m.id
JOIN experiments e ON e.model_version_id = mv.id
JOIN experiment_metrics em ON em.experiment_id = e.id
WHERE UPPER(e.status) = 'COMPLETED'
GROUP BY m.id, m.name, m.framework
HAVING COUNT(e.id) >= 1 AND AVG(em.accuracy) >= 0.80
ORDER BY avg_accuracy DESC;


-- ----------------------------------------------------------------------------
-- DEMO 4: Subquery Identifying Experiments Performing Above Average
-- Purpose: Compare each experiment's accuracy against the overall benchmark 
-- calculated in an uncorrelated scalar subquery.
-- ----------------------------------------------------------------------------
SELECT 
    e.id AS experiment_id,
    e.name AS experiment_name,
    m.name AS model_name,
    dv.version_label AS trained_on_dataset_version,
    em.accuracy,
    ROUND((SELECT AVG(accuracy) FROM experiment_metrics WHERE accuracy IS NOT NULL), 4) AS benchmark_avg_accuracy,
    ROUND(em.accuracy - (SELECT AVG(accuracy) FROM experiment_metrics WHERE accuracy IS NOT NULL), 4) AS margin_above_benchmark
FROM experiments e
JOIN experiment_metrics em ON em.experiment_id = e.id
JOIN model_versions mv ON e.model_version_id = mv.id
JOIN models m ON mv.model_id = m.id
JOIN dataset_versions dv ON e.dataset_version_id = dv.id
WHERE em.accuracy > (SELECT AVG(accuracy) FROM experiment_metrics WHERE accuracy IS NOT NULL)
ORDER BY em.accuracy DESC;


-- ----------------------------------------------------------------------------
-- DEMO 5: Recursive Common Table Expression (Lineage Version Ancestry)
-- Purpose: Traverse backwards through parent_version_id hierarchy to determine
-- full lineage tree depth and history.
-- ----------------------------------------------------------------------------
WITH RECURSIVE version_ancestry AS (
    -- Anchor member: Select child version (v1.1.0)
    SELECT 
        id, 
        dataset_id, 
        version_number, 
        version_label, 
        parent_version_id, 
        checksum_sha256,
        file_size_bytes,
        commit_message,
        1 AS ancestry_depth
    FROM dataset_versions
    WHERE parent_version_id IS NOT NULL

    UNION ALL

    -- Recursive member: Find parent version
    SELECT 
        dv.id, 
        dv.dataset_id, 
        dv.version_number, 
        dv.version_label, 
        dv.parent_version_id, 
        dv.checksum_sha256,
        dv.file_size_bytes,
        dv.commit_message,
        va.ancestry_depth + 1
    FROM dataset_versions dv
    INNER JOIN version_ancestry va ON dv.id = va.parent_version_id
)
SELECT 
    ancestry_depth,
    version_label,
    version_number,
    checksum_sha256,
    file_size_bytes,
    commit_message
FROM version_ancestry
ORDER BY ancestry_depth ASC;


-- ----------------------------------------------------------------------------
-- DEMO 6: Materialized Perspective via Database View (best_experiments_view)
-- Purpose: Query pre-ranked model evaluations utilizing window functions.
-- ----------------------------------------------------------------------------
SELECT 
    model_name,
    model_version_label,
    algorithm,
    dataset_name,
    dataset_version_label,
    accuracy,
    loss,
    model_rank
FROM best_experiments_view
WHERE model_rank = 1
ORDER BY accuracy DESC NULLS LAST;


-- ----------------------------------------------------------------------------
-- DEMO 7: Trigger Verification (Automatic Audit Logging)
-- Purpose: Verify that insert on dataset_versions fired trg_after_insert_dataset_version
-- and generated corresponding activity_logs entries.
-- ----------------------------------------------------------------------------
SELECT 
    al.id,
    p.name AS project_name,
    al.action,
    al.entity_type,
    al.entity_name,
    al.details,
    al.created_at
FROM activity_logs al
LEFT JOIN projects p ON al.project_id = p.id
WHERE al.entity_type = 'DATASET_VERSION'
ORDER BY al.created_at DESC
LIMIT 5;
