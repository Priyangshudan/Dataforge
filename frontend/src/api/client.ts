import type {
  ApiResponse,
  SystemHealth,
  User,
  Project,
  ProjectMember,
  Dataset,
  DatasetVersion,
  VersionDetailResponse,
  VersionComparison,
  Model,
  ModelVersion,
  Experiment,
  ExperimentMetric,
  LineageGraph,
  VersionLineage,
  DatasetSimilarity,
  AnalyticsSummary,
  DatasetAnalyticsResponse,
  ExperimentAnalyticsResponse,
  ActivityLog,
} from '../types';

class ApiError extends Error {
  code: string;
  details?: any;
  status: number;

  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('/api') ? path : `/api${path}`;
  const response = await fetch(url, options);

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      'PARSE_ERROR',
      `Failed to parse server response (${response.status} ${response.statusText})`
    );
  }

  if (!response.ok || !json.success) {
    throw new ApiError(
      response.status,
      json.error?.code || 'API_ERROR',
      json.error?.message || `Request failed with status ${response.status}`,
      json.error?.details
    );
  }

  return json.data;
}

export const api = {
  // Health
  getHealth: () => request<SystemHealth>('/health'),

  // Users
  getUsers: (params?: { role?: string; status?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.role) query.append('role', params.role);
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const qs = query.toString();
    return request<User[]>(`/users${qs ? `?${qs}` : ''}`);
  },

  getUser: (id: string) => request<User>(`/users/${id}`),

  createUser: (data: { name: string; email: string; role?: string; avatar?: string }) =>
    request<User>('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Projects
  getProjects: (params?: { search?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const qs = query.toString();
    return request<Project[]>(`/projects${qs ? `?${qs}` : ''}`);
  },

  getProject: (id: string) => request<Project>(`/projects/${id}`),

  createProject: (data: { name: string; slug?: string; description?: string; owner_id: string }) =>
    request<Project>('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateProject: (id: string, data: { name?: string; description?: string }) =>
    request<Project>(`/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getProjectMembers: (projectId: string) => request<ProjectMember[]>(`/projects/${projectId}/members`),

  addProjectMember: (projectId: string, data: { user_id: string; role?: string }) =>
    request<ProjectMember>(`/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getProjectDatasets: (projectId: string) => request<Dataset[]>(`/projects/${projectId}/datasets`),

  // Datasets
  getDatasets: (params?: {
    project_id?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.project_id) query.append('project_id', params.project_id);
    if (params?.search) query.append('search', params.search);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.sortOrder) query.append('sortOrder', params.sortOrder);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const qs = query.toString();
    return request<Dataset[]>(`/datasets${qs ? `?${qs}` : ''}`);
  },

  getDataset: (id: string) => request<Dataset>(`/datasets/${id}`),

  createDataset: (data: {
    name: string;
    project_id: string;
    description?: string;
    source?: string;
    type?: string;
    tags?: string[];
    created_by?: string;
  }) =>
    request<Dataset>('/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateDataset: (
    id: string,
    data: { name?: string; description?: string; status?: string; tags?: string[] }
  ) =>
    request<Dataset>(`/datasets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getDatasetVersions: (datasetId: string) => request<DatasetVersion[]>(`/datasets/${datasetId}/versions`),

  createDatasetVersion: (datasetId: string, formData: FormData) =>
    request<VersionDetailResponse>(`/datasets/${datasetId}/versions`, {
      method: 'POST',
      // Note: Browser automatically sets multipart/form-data boundary
      body: formData,
    }),

  // Versions
  getVersion: (id: string) => request<VersionDetailResponse>(`/versions/${id}`),

  compareVersions: (versionId: string, otherVersionId: string) =>
    request<VersionComparison>(`/versions/${versionId}/compare/${otherVersionId}`),

  // Models
  getModels: (params?: { project_id?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.project_id) query.append('project_id', params.project_id);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const qs = query.toString();
    return request<Model[]>(`/models${qs ? `?${qs}` : ''}`);
  },

  getModel: (id: string) => request<Model>(`/models/${id}`),

  createModel: (data: {
    project_id: string;
    name: string;
    description?: string;
    framework: string;
    task_type?: string;
    created_by?: string;
  }) =>
    request<Model>('/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getModelVersions: (modelId: string) => request<ModelVersion[]>(`/models/${modelId}/versions`),

  createModelVersion: (
    modelId: string,
    data: {
      version: string;
      dataset_version_id?: string;
      algorithm: string;
      hyperparameters?: Record<string, any>;
      endpoint_url?: string;
      created_by?: string;
    }
  ) =>
    request<ModelVersion>(`/models/${modelId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getModelVersion: (id: string) => request<ModelVersion>(`/models/versions/${id}`),

  // Experiments
  getExperiments: (params?: {
    model_version_id?: string;
    dataset_version_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.model_version_id) query.append('model_version_id', params.model_version_id);
    if (params?.dataset_version_id) query.append('dataset_version_id', params.dataset_version_id);
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const qs = query.toString();
    return request<Experiment[]>(`/experiments${qs ? `?${qs}` : ''}`);
  },

  getExperiment: (id: string) => request<Experiment>(`/experiments/${id}`),

  createExperiment: (data: {
    name: string;
    dataset_version_id: string;
    model_version_id: string;
    notes?: string;
    status?: string;
    created_by?: string;
  }) =>
    request<Experiment>('/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateExperiment: (id: string, data: { status?: string; notes?: string }) =>
    request<Experiment>(`/experiments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  addExperimentMetrics: (
    experimentId: string,
    data: {
      accuracy?: number;
      precision_score?: number;
      recall_score?: number;
      f1_score?: number;
      loss?: number;
      roc_auc?: number;
      extra_metrics?: Record<string, any>;
    }
  ) =>
    request<ExperimentMetric>(`/experiments/${experimentId}/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getExperimentMetrics: (experimentId: string) =>
    request<ExperimentMetric[]>(`/experiments/${experimentId}/metrics`),

  // Lineage
  getDatasetLineage: (datasetId: string) => request<LineageGraph>(`/lineage/datasets/${datasetId}`),

  getVersionLineage: (versionId: string) => request<VersionLineage>(`/lineage/versions/${versionId}`),

  // Similarity & Drift
  checkSimilarity: (data: { base_version_id: string; compared_version_id: string }) =>
    request<DatasetSimilarity>('/ai/check-similarity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  calculateDrift: (data: { base_version_id: string; compared_version_id: string }) =>
    request<DatasetSimilarity>('/analysis/drift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Analytics
  getAnalyticsSummary: () => request<AnalyticsSummary>('/analytics/summary'),

  getDatasetAnalytics: () => request<DatasetAnalyticsResponse>('/analytics/datasets'),

  getExperimentAnalytics: () => request<ExperimentAnalyticsResponse>('/analytics/experiments'),

  // Activity Logs
  getActivityLogs: (params?: {
    project_id?: string;
    entity_type?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.project_id) query.append('project_id', params.project_id);
    if (params?.entity_type) query.append('entity_type', params.entity_type);
    if (params?.user_id) query.append('user_id', params.user_id);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const qs = query.toString();
    return request<ActivityLog[]>(`/activity-logs${qs ? `?${qs}` : ''}`);
  },
};
export { ApiError };
