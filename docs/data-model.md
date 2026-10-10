# DataForge — Relational Data Model & ER Diagram

## 1. Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    users ||--o{ projects : "owns"
    users ||--o{ project_members : "participates_as"
    projects ||--o{ project_members : "has_members"
    projects ||--o{ datasets : "contains"
    projects ||--o{ models : "owns_models"
    projects ||--o{ activity_logs : "records_logs"
    users ||--o{ activity_logs : "triggers_action"

    datasets ||--o{ dataset_versions : "has_versions"
    dataset_versions ||--o{ dataset_columns : "defines_columns"
    dataset_versions |o--o{ dataset_versions : "parent_version"

    models ||--o{ model_versions : "has_versions"
    dataset_versions ||--o{ model_versions : "trained_on"

    model_versions ||--o{ experiments : "evaluated_in"
    dataset_versions ||--o{ experiments : "tested_on"
    experiments ||--o{ experiment_metrics : "yields_metrics"

    dataset_versions ||--o{ dataset_lineage : "source_node"
    dataset_versions ||--o{ dataset_lineage : "target_node"
    model_versions ||--o{ dataset_lineage : "model_node"

    dataset_versions ||--o{ dataset_similarity : "base_version"
    dataset_versions ||--o{ dataset_similarity : "compared_version"

    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar role
        varchar avatar
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    projects {
        uuid id PK
        varchar name
        varchar slug UK
        text description
        uuid owner_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    project_members {
        uuid project_id PK,FK
        uuid user_id PK,FK
        varchar role
        timestamptz assigned_at
    }

    datasets {
        uuid id PK
        varchar name
        uuid project_id FK
        text description
        varchar source
        varchar type
        varchar status
        text[] tags
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    dataset_versions {
        uuid id PK
        uuid dataset_id FK
        int version_number
        varchar version_label
        uuid parent_version_id FK
        varchar file_name
        varchar storage_path
        bigint file_size_bytes
        bigint row_count
        int column_count
        char checksum_sha256
        varchar schema_fingerprint
        text commit_message
        varchar status
        uuid created_by FK
        timestamptz valid_from
        timestamptz valid_to
        timestamptz created_at
        timestamptz updated_at
    }

    dataset_columns {
        uuid id PK
        uuid version_id FK
        varchar column_name
        varchar data_type
        boolean is_nullable
        int column_order
        bigint null_count
        bigint distinct_count
        jsonb sample_values
        timestamptz created_at
    }

    models {
        uuid id PK
        varchar name
        uuid project_id FK
        text description
        varchar framework
        varchar task_type
        varchar status
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    model_versions {
        uuid id PK
        uuid model_id FK
        varchar version
        uuid dataset_version_id FK
        varchar algorithm
        jsonb hyperparameters
        varchar endpoint_url
        varchar status
        uuid created_by FK
        timestamptz created_at
    }

    experiments {
        uuid id PK
        varchar name
        uuid dataset_version_id FK
        uuid model_version_id FK
        varchar status
        timestamptz started_at
        timestamptz completed_at
        text notes
        uuid created_by FK
        timestamptz created_at
    }

    experiment_metrics {
        uuid id PK
        uuid experiment_id FK
        numeric accuracy
        numeric precision_score
        numeric recall_score
        numeric f1_score
        numeric loss
        numeric roc_auc
        jsonb extra_metrics
        timestamptz recorded_at
    }

    dataset_lineage {
        uuid id PK
        uuid source_version_id FK
        uuid target_version_id FK
        uuid model_version_id FK
        varchar lineage_type
        timestamptz created_at
    }

    dataset_similarity {
        uuid id PK
        uuid base_version_id FK
        uuid compared_version_id FK
        numeric similarity_score
        numeric drift_score
        varchar comparison_method
        jsonb details
        timestamptz created_at
    }

    activity_logs {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        varchar entity_name
        text details
        inet ip_address
        varchar user_agent
        timestamptz created_at
    }
```

---

## 2. Integrity Constraints & Foreign Key Rules

| Entity | Constraint | Description |
|---|---|---|
| `users` | `users_email_key` | Email must be globally unique |
| `users` | `chk_user_role` | Allowed roles: ADMIN, DATA_ENGINEER, VIEWER |
| `projects` | `projects_slug_key` | URL-safe slug must be globally unique |
| `projects` | `projects_owner_id_fkey` | References `users(id)` ON DELETE RESTRICT |
| `project_members` | `project_members_pkey` | Composite PK `(project_id, user_id)` |
| `datasets` | `datasets_project_id_fkey` | References `projects(id)` ON DELETE CASCADE |
| `dataset_versions` | `uq_dataset_version_number` | Unique `(dataset_id, version_number)` |
| `dataset_versions` | `chk_version_number_positive`| `version_number > 0` |
| `dataset_versions` | `chk_no_self_parent` | `parent_version_id <> id` |
| `experiment_metrics`| `chk_metric_ranges` | Loss >= 0; accuracy, precision, recall, f1, auc between 0 and 1 |
| `dataset_similarity`| `chk_similarity_range` | `similarity_score BETWEEN 0.0 AND 1.0` |
| `dataset_similarity`| `chk_drift_range` | `drift_score >= 0.0` |

