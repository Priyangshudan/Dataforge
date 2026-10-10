# DataForge — DBMS Concepts & SQL Implementations

This document details how DataForge fulfills academic DBMS requirements using real PostgreSQL 18 features without ORM obfuscation.

---

## 1. Constraints & Data Integrity
1. **Primary & Foreign Keys**: Every table has a UUID primary key (via `gen_random_uuid()`). Referential actions explicitly declare `ON DELETE CASCADE` (for child resources like versions, columns, metrics) or `ON DELETE RESTRICT` (e.g. project owner).
2. **Unique Constraints**:
   - `users.email` (global unique user identity).
   - `projects.slug` (URL-friendly unique key).
   - `dataset_versions(dataset_id, version_number)` (scoped version increments).
3. **Domain Check Constraints**:
   - `chk_user_role`: Restricts roles to valid enumerations.
   - `chk_version_number_positive`: Enforces `version_number > 0`.
   - `chk_no_self_parent`: Enforces `parent_version_id <> id`.
   - `chk_metric_ranges`: Validates `accuracy`, `precision_score`, `recall_score`, `f1_score`, `roc_auc` in `[0.0, 1.0]` and `loss >= 0.0`.
   - `chk_similarity_range`: Validates `similarity_score BETWEEN 0.0 AND 1.0`.

---

## 2. Relational Joins & Aggregations
DataForge queries demonstrate multi-table relational joins across deep hierarchies:
`projects -> datasets -> dataset_versions -> experiments -> experiment_metrics -> models`

Aggregation functions (`COUNT`, `SUM`, `AVG`, `MAX`, `MIN`) are used throughout the analytics engine to aggregate row counts, byte storage, and model metric performances.

---

## 3. GROUP BY and HAVING Queries
DataForge demonstrates sophisticated aggregation filtering:
```sql
-- Identify high-performing models with more than 1 completed experiment having average accuracy > 0.85
SELECT 
    m.name AS model_name,
    m.framework,
    COUNT(e.id) AS completed_experiments,
    ROUND(AVG(em.accuracy), 4) AS avg_accuracy,
    ROUND(MIN(em.loss), 4) AS min_loss
FROM models m
JOIN model_versions mv ON mv.model_id = m.id
JOIN experiments e ON e.model_version_id = mv.id
JOIN experiment_metrics em ON em.experiment_id = e.id
WHERE e.status = 'COMPLETED'
GROUP BY m.id, m.name, m.framework
HAVING COUNT(e.id) >= 1 AND AVG(em.accuracy) >= 0.80
ORDER BY avg_accuracy DESC;
```

---

## 4. Subqueries & Benchmark Comparison
```sql
-- Find experiments whose accuracy exceeds the average accuracy of all experiments in the same project
SELECT 
    e.id AS experiment_id,
    e.name AS experiment_name,
    p.name AS project_name,
    em.accuracy,
    sub.project_avg_accuracy
FROM experiments e
JOIN experiment_metrics em ON em.experiment_id = e.id
JOIN dataset_versions dv ON e.dataset_version_id = dv.id
JOIN datasets d ON dv.dataset_id = d.id
JOIN projects p ON d.project_id = p.id
JOIN (
    SELECT 
        d2.project_id,
        AVG(em2.accuracy) AS project_avg_accuracy
    FROM experiments e2
    JOIN experiment_metrics em2 ON em2.experiment_id = e2.id
    JOIN dataset_versions dv2 ON e2.dataset_version_id = dv2.id
    JOIN datasets d2 ON dv2.dataset_id = d2.id
    GROUP BY d2.project_id
) sub ON sub.project_id = p.id
WHERE em.accuracy > sub.project_avg_accuracy;
```

---

## 5. PostgreSQL Views
1. `dataset_summary_view`:
   Aggregates version count, total storage, row count, and latest version number per dataset.
2. `best_experiments_view`:
   Ranks experiments per model by accuracy using `ROW_NUMBER() OVER (PARTITION BY mv.model_id ORDER BY em.accuracy DESC NULLS LAST)`.
3. `project_analytics_view`:
   Summarizes high-level resource counts (datasets, versions, models) and storage bytes per project.

---

## 6. PostgreSQL Indexes
Strategic B-tree indexes are implemented to accelerate queries:
- `idx_projects_owner_id`, `idx_projects_slug`
- `idx_datasets_project_id`, `idx_datasets_name`
- `idx_dataset_versions_dataset_id`, `idx_dataset_versions_checksum` (for O(1) duplicate detection)
- `idx_dataset_versions_parent_id`, `idx_dataset_versions_created_at`
- `idx_dataset_columns_version_id`
- `idx_experiments_dataset_version_id`, `idx_experiments_model_version_id`
- `idx_activity_logs_project_id`, `idx_activity_logs_created_at`

---

## 7. Stored Functions and Database Triggers
Automatic activity logging is enforced at the DBMS level:
- Function: `log_dataset_version_creation()`
  - Trigger: `trg_after_insert_dataset_version` ON `dataset_versions` AFTER INSERT FOR EACH ROW
  - Automatically queries the dataset's `project_id`, extracts version label and commit message, and inserts an immutable record into `activity_logs`.

---

## 8. Recursive Common Table Expressions (Lineage Ancestry)
```sql
WITH RECURSIVE version_ancestry AS (
    -- Anchor member: Target version
    SELECT 
        id, 
        dataset_id, 
        version_number, 
        version_label, 
        parent_version_id, 
        checksum_sha256,
        1 AS depth
    FROM dataset_versions
    WHERE id = $1

    UNION ALL

    -- Recursive member: Traverse upward to parent
    SELECT 
        dv.id, 
        dv.dataset_id, 
        dv.version_number, 
        dv.version_label, 
        dv.parent_version_id, 
        dv.checksum_sha256,
        va.depth + 1
    FROM dataset_versions dv
    INNER JOIN version_ancestry va ON dv.id = va.parent_version_id
)
SELECT * FROM version_ancestry ORDER BY depth ASC;
```

---

## 9. ACID Transactions & Compensation
Multi-statement operations utilize explicit PostgreSQL transactions via a single checked-out `PoolClient`:
```sql
BEGIN;
-- Step 1: Lock and verify dataset
-- Step 2: Insert dataset_version
-- Step 3: Insert dataset_columns (batch)
-- Step 4: Insert lineage record
COMMIT;
```
If an error occurs, `ROLLBACK` is executed and any newly uploaded physical file is removed from disk.

