export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner_id: string;
  members_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: string;
  assigned_at: string;
  user_name?: string;
  user_email?: string;
}

export interface Dataset {
  id: string;
  name: string;
  project_id: string;
  project_name?: string;
  description?: string | null;
  source?: string | null;
  type: string;
  status: string;
  tags?: string[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  latest_version_number?: number;
  latest_version_label?: string;
  total_versions?: number | string;
  total_storage_bytes?: number | string;
  latest_row_count?: number | string;
}

export interface DatasetColumn {
  id: string;
  version_id: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  ordinal_position: number;
  null_count?: number;
  distinct_count?: number;
  sample_values?: any[];
  created_at: string;
}

export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version_number: number;
  version_label: string;
  parent_version_id?: string | null;
  file_name: string;
  storage_path: string;
  file_size_bytes: number | string;
  row_count: number | string;
  column_count: number;
  checksum_sha256: string;
  schema_fingerprint: string;
  commit_message?: string | null;
  status: string;
  created_by?: string | null;
  valid_from: string;
  valid_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionDetailResponse {
  version: DatasetVersion;
  columns: DatasetColumn[];
}

export interface VersionComparison {
  base_version: DatasetVersion;
  compared_version: DatasetVersion;
  jaccard_similarity: number;
  shared_columns: string[];
  added_columns: string[];
  removed_columns: string[];
  row_count_diff: number;
  file_size_diff_bytes: number;
  exact_checksum_match: boolean;
}

export interface Model {
  id: string;
  name: string;
  project_id: string;
  project_name?: string;
  description?: string | null;
  framework: string;
  task_type?: string | null;
  status: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelVersion {
  id: string;
  model_id: string;
  version: string;
  dataset_version_id?: string | null;
  dataset_version_label?: string;
  algorithm: string;
  hyperparameters?: Record<string, any>;
  endpoint_url?: string | null;
  status: string;
  created_by?: string | null;
  created_at: string;
}

export interface Experiment {
  id: string;
  name: string;
  dataset_version_id: string;
  model_version_id: string;
  status: 'PLANNED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'Pending' | 'Running' | 'Completed' | 'Failed';
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  accuracy?: number | string | null;
  precision_score?: number | string | null;
  recall_score?: number | string | null;
  f1_score?: number | string | null;
  loss?: number | string | null;
  roc_auc?: number | string | null;
  model_name?: string;
  model_version_label?: string;
  dataset_name?: string;
  dataset_version_label?: string;
}

export interface ExperimentMetric {
  id: string;
  experiment_id: string;
  accuracy?: number | null;
  precision_score?: number | null;
  recall_score?: number | null;
  f1_score?: number | null;
  loss?: number | null;
  roc_auc?: number | null;
  extra_metrics?: Record<string, any>;
  recorded_at: string;
}

export interface LineageGraph {
  dataset: Dataset;
  nodes: Array<{
    id: string;
    type: 'DATASET' | 'DATASET_VERSION' | 'MODEL_VERSION' | 'EXPERIMENT';
    label: string;
    status?: string;
    framework?: string;
    accuracy?: number;
    metadata?: any;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
}

export interface VersionLineage {
  version_id: string;
  ancestry: Array<{
    id: string;
    dataset_id: string;
    version_number: number;
    version_label: string;
    parent_version_id?: string | null;
    checksum_sha256: string;
    depth: number;
    dataset_name: string;
  }>;
  descendants: Array<{
    id: string;
    dataset_id: string;
    version_number: number;
    version_label: string;
    parent_version_id?: string | null;
    checksum_sha256: string;
    depth: number;
    dataset_name: string;
  }>;
  trained_models: Array<{
    id: string;
    version: string;
    algorithm: string;
    model_name: string;
    framework: string;
  }>;
  experiments: Array<{
    id: string;
    name: string;
    status: string;
    accuracy?: number;
    loss?: number;
  }>;
}

export interface DatasetSimilarity {
  id: string;
  base_version_id: string;
  compared_version_id: string;
  similarity_score: number;
  drift_score: number;
  comparison_method: string;
  column_overlap_count?: number;
  schema_match_ratio?: number;
  shared_columns?: string[];
  details?: Record<string, any>;
  created_at: string;
}

export interface AnalyticsSummary {
  total_projects: string | number;
  total_datasets: string | number;
  total_dataset_versions: string | number;
  total_models: string | number;
  total_experiments: string | number;
  total_storage_bytes: string | number;
}

export interface ProjectAnalyticsItem {
  project_id: string;
  project_name: string;
  slug: string;
  owner_name: string;
  dataset_count: string | number;
  version_count: string | number;
  model_count: string | number;
  total_storage_bytes: string | number;
  created_at: string;
}

export interface DatasetAnalyticsResponse {
  projects: ProjectAnalyticsItem[];
  top_datasets: Dataset[];
}

export interface ExperimentAnalyticsResponse {
  status_distribution: Array<{ status: string; count: string | number }>;
  best_experiments: Array<{
    experiment_id: string;
    experiment_name: string;
    model_name: string;
    model_version_label: string;
    algorithm: string;
    dataset_name: string;
    dataset_version_label: string;
    accuracy: number;
    loss: number;
    model_rank: number;
  }>;
  high_performing_models: Array<{
    model_name: string;
    framework: string;
    completed_experiments: string | number;
    avg_accuracy: string | number;
    min_loss: string | number;
  }>;
}

export interface ActivityLog {
  id: string;
  project_id?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string | null;
  details?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface SystemHealth {
  status: string;
  database: string;
  database_latency_ms: number;
  timestamp: string;
  version: string;
}

