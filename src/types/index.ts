export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'DATA_ENGINEER' | 'VIEWER' | 'Admin' | 'Data Engineer' | 'Viewer';
  avatar?: string | null;
  status: 'Active' | 'Suspended' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  owner_id: string;
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
  description?: string | null;
  source?: string | null;
  type: string;
  status: string;
  tags?: string[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  latest_version_number?: number;
  total_versions?: number;
  total_storage_bytes?: number;
}

export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version_number: number;
  version_label: string;
  parent_version_id?: string | null;
  file_name: string;
  storage_path: string;
  file_size_bytes: number;
  row_count: number;
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

export interface Model {
  id: string;
  name: string;
  project_id: string;
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

export interface DatasetLineage {
  id: string;
  source_version_id: string;
  target_version_id?: string | null;
  model_version_id?: string | null;
  transformation_type: string;
  created_at: string;
}

export interface DatasetSimilarity {
  id: string;
  base_version_id: string;
  compared_version_id: string;
  similarity_score: number;
  drift_score: number;
  comparison_method: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  project_id?: string | null;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string | null;
  details?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

