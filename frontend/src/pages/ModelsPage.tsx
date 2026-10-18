import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  Model,
  ModelVersion,
  Project,
  Dataset,
  DatasetVersion,
  Experiment,
  NavigationTab,
} from '../types';
import {
  PageHeader,
  Panel,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  Modal,
  StatusBadge,
  ToastNotification,
  RingLegend,
  formatShortDate,
} from '../components/Common';
import {
  Cpu,
  Plus,
  Search,
  Database,
  FlaskConical,
  GitCommit,
  ExternalLink,
} from 'lucide-react';

interface ModelsPageProps {
  initialModelId?: string;
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

export const ModelsPage: React.FC<ModelsPageProps> = ({
  initialModelId,
  onNavigate,
}) => {
  const [models, setModels] = useState<Model[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);

  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
  const [selectedModelVersion, setSelectedModelVersion] = useState<ModelVersion | null>(null);

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Create Model Modal
  const [showCreateModel, setShowCreateModel] = useState(false);
  const [newModelProject, setNewModelProject] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelFramework, setNewModelFramework] = useState('PyTorch');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [creatingModel, setCreatingModel] = useState(false);

  // Create Model Version Modal
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [verLabel, setVerLabel] = useState('');
  const [verAlgorithm, setVerAlgorithm] = useState('');
  const [verDatasetId, setVerDatasetId] = useState('');
  const [verDatasetVersions, setVerDatasetVersions] = useState<DatasetVersion[]>([]);
  const [verDatasetVersionId, setVerDatasetVersionId] = useState('');
  const [verHyperparams, setVerHyperparams] = useState(
    '{\n  "learning_rate": 0.001,\n  "batch_size": 32\n}'
  );
  const [verEndpoint, setVerEndpoint] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  const loadModelsAndContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mList, pList, dList, eList] = await Promise.all([
        api.getModels({
          project_id: projectFilter || undefined,
        }),
        api.getProjects(),
        api.getDatasets(),
        api.getExperiments(),
      ]);

      setModels(mList || []);
      setProjects(pList || []);
      setDatasets(dList || []);
      setExperiments(eList || []);

      if (pList.length > 0 && !newModelProject) {
        setNewModelProject(pList[0].id);
      }

      if (initialModelId) {
        const match = mList.find((m) => m.id === initialModelId);
        if (match) setSelectedModel(match);
        else if (mList.length > 0) setSelectedModel(mList[0]);
      } else if (!selectedModel && mList.length > 0) {
        setSelectedModel(mList[0]);
      } else if (selectedModel) {
        const refreshed = mList.find((m) => m.id === selectedModel.id);
        setSelectedModel(refreshed || mList[0] || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load model registry');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, initialModelId]);

  useEffect(() => {
    loadModelsAndContext();
  }, [loadModelsAndContext]);

  const loadModelVersions = useCallback(async (modelId: string) => {
    setLoadingVersions(true);
    try {
      const vList = await api.getModelVersions(modelId);
      setModelVersions(vList || []);
      setSelectedModelVersion(vList[0] || null);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load model versions', type: 'error' });
    } finally {
      setLoadingVersions(false);
    }
  }, []);

  useEffect(() => {
    if (selectedModel) {
      loadModelVersions(selectedModel.id);
    } else {
      setModelVersions([]);
      setSelectedModelVersion(null);
    }
  }, [selectedModel, loadModelVersions]);

  useEffect(() => {
    if (!verDatasetId) {
      setVerDatasetVersions([]);
      setVerDatasetVersionId('');
      return;
    }
    api
      .getDatasetVersions(verDatasetId)
      .then((list) => {
        setVerDatasetVersions(list || []);
        if (list.length > 0) setVerDatasetVersionId(list[0].id);
      })
      .catch(() => {
        setVerDatasetVersions([]);
      });
  }, [verDatasetId]);

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelProject || !newModelName.trim()) return;
    setCreatingModel(true);
    try {
      const created = await api.createModel({
        project_id: newModelProject,
        name: newModelName.trim(),
        framework: newModelFramework.trim() || 'PyTorch',
        description: newModelDesc.trim() || undefined,
      });
      setToast({ message: `Model "${created.name}" registered`, type: 'success' });
      setShowCreateModel(false);
      setNewModelName('');
      setNewModelDesc('');
      await loadModelsAndContext();
      setSelectedModel(created);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to register model', type: 'error' });
    } finally {
      setCreatingModel(false);
    }
  };

  const openNewModelVersionModal = () => {
    if (!selectedModel) return;
    const nextPatch = modelVersions.length;
    setVerLabel(`v1.0.${nextPatch}`);
    setVerAlgorithm(
      selectedModel.framework
        ? `${selectedModel.framework} Architecture`
        : 'Transformer / Gradient Boost'
    );
    if (datasets.length > 0 && !verDatasetId) {
      setVerDatasetId(datasets[0].id);
    }
    setShowCreateVersion(true);
  };

  const handleCreateModelVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel || !verLabel.trim()) return;

    let parsedHyperparams: Record<string, any> | undefined;
    if (verHyperparams.trim()) {
      try {
        parsedHyperparams = JSON.parse(verHyperparams);
      } catch {
        setToast({ message: 'Hyperparameters must be valid JSON', type: 'error' });
        return;
      }
    }

    setCreatingVersion(true);
    try {
      await api.createModelVersion(selectedModel.id, {
        version: verLabel.trim(),
        algorithm: verAlgorithm.trim() || 'Custom Algorithm',
        dataset_version_id: verDatasetVersionId || undefined,
        hyperparameters: parsedHyperparams,
        endpoint_url: verEndpoint.trim() || undefined,
      });
      setToast({ message: `Model version ${verLabel} registered`, type: 'success' });
      setShowCreateVersion(false);
      await loadModelVersions(selectedModel.id);
      await loadModelsAndContext();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to create model version', type: 'error' });
    } finally {
      setCreatingVersion(false);
    }
  };

  const filteredModels = models.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.framework || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );
  });

  if (loading && models.length === 0 && !projectFilter) {
    return <LoadingSpinner message="Loading model registry..." />;
  }

  if (error && models.length === 0) {
    return <ErrorState message={error} onRetry={loadModelsAndContext} />;
  }

  const linkedExperiments = selectedModelVersion
    ? experiments.filter((exp) => exp.model_version_id === selectedModelVersion.id)
    : [];

  return (
    <div>
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <PageHeader
        eyebrow="MODEL REGISTRY & TRAINING LINEAGE"
        title="MODEL ARCHITECTURES"
        subtitle="Manage machine learning models, version checkpoints, hyperparameter configurations, and training dataset provenance."
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            {selectedModel && (
              <button
                type="button"
                className="df-btn df-btn--secondary"
                onClick={openNewModelVersionModal}
              >
                <GitCommit size={14} /> Register Checkpoint Version
              </button>
            )}
            <button
              type="button"
              className="df-btn df-btn--primary"
              onClick={() => setShowCreateModel(true)}
            >
              <Plus size={14} /> New Model Architecture
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Panel style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="df-input"
              placeholder="Search models by name, framework, or description..."
              style={{ paddingLeft: 34 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="df-select"
            style={{ width: 220 }}
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            aria-label="Filter models by project"
          >
            <option value="">All Research Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      {filteredModels.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Cpu size={24} />}
            title="No Models Registered"
            description="Register a model architecture to track model versions, hyperparameters, and training datasets."
            actionLabel="Register Model"
            onAction={() => setShowCreateModel(true)}
          />
        </Panel>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          {/* Left 4 cols: Model Registry List */}
          <div
            style={{
              gridColumn: 'span 4',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
            className="df-col-full-mobile"
          >
            {filteredModels.map((mod) => {
              const isSelected = selectedModel?.id === mod.id;
              return (
                <div
                  key={mod.id}
                  onClick={() => setSelectedModel(mod)}
                  style={{
                    padding: '16px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                    border: isSelected
                      ? '1px solid rgba(184, 255, 98, 0.45)'
                      : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Cpu
                        size={16}
                        color={isSelected ? 'var(--accent-lime)' : 'var(--text-secondary)'}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.96rem', color: '#FFF' }}>
                        {mod.name}
                      </span>
                    </div>
                    <StatusBadge status={mod.framework || 'CUSTOM'} size="sm" />
                  </div>

                  <p
                    style={{
                      margin: '8px 0 12px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    {mod.description || 'No architecture description provided.'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 10,
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>{mod.project_name || 'Workspace'}</span>
                    <span className="df-mono" style={{ color: 'var(--accent-lime)' }}>
                      {mod.status || 'ACTIVE'} · {formatShortDate(mod.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 8 cols: Model Detail & Version Inspector */}
          <div
            style={{
              gridColumn: 'span 8',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            className="df-col-full-mobile"
          >
            {selectedModel && (
              <>
                <Panel
                  title={selectedModel.name.toUpperCase()}
                  subtitle={`${selectedModel.project_name || 'Project'} · Registered on ${formatShortDate(selectedModel.created_at)}`}
                  rightSlot={
                    <div style={{ display: 'flex', gap: 8 }}>
                      <StatusBadge status={selectedModel.framework || 'CUSTOM'} />
                      <button
                        type="button"
                        className="df-btn df-btn--primary"
                        onClick={openNewModelVersionModal}
                      >
                        <Plus size={13} /> New Version
                      </button>
                    </div>
                  }
                >
                  <p
                    style={{
                      margin: '0 0 16px',
                      color: 'var(--text-secondary)',
                      fontSize: '0.88rem',
                    }}
                  >
                    {selectedModel.description || 'No description provided.'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="df-card-label" style={{ marginRight: 6 }}>
                      CHECKPOINT VERSIONS ({modelVersions.length}):
                    </span>
                    {loadingVersions ? (
                      <span
                        className="df-mono"
                        style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                      >
                        Loading versions...
                      </span>
                    ) : modelVersions.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        No versions registered yet. Click &ldquo;New Version&rdquo; to add one.
                      </span>
                    ) : (
                      modelVersions.map((mv) => {
                        const active = selectedModelVersion?.id === mv.id;
                        return (
                          <button
                            key={mv.id}
                            type="button"
                            onClick={() => setSelectedModelVersion(mv)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-pill)',
                              border: active
                                ? '1px solid var(--accent-lime)'
                                : '1px solid var(--border-subtle)',
                              background: active ? 'var(--accent-lime)' : 'var(--bg-elevated)',
                              color: active ? '#090A09' : 'var(--text-primary)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {mv.version}
                          </button>
                        );
                      })
                    )}
                  </div>
                </Panel>

                {selectedModelVersion ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                      gap: 16,
                    }}
                  >
                    <div style={{ gridColumn: 'span 6' }} className="df-col-full-mobile">
                      <Panel
                        title={`CHECKPOINT ${selectedModelVersion.version}`}
                        subtitle={selectedModelVersion.algorithm || 'Algorithm configuration'}
                        rightSlot={<RingLegend label="HYPERPARAMETERS" color="lime" />}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div
                            style={{
                              padding: 12,
                              borderRadius: 12,
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div className="df-card-label">ALGORITHM</div>
                            <div style={{ fontWeight: 600, color: '#FFF', marginTop: 4 }}>
                              {selectedModelVersion.algorithm || 'Unspecified'}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: 12,
                              borderRadius: 12,
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div className="df-card-label">TRAINING DATASET PROVENANCE</div>
                            {selectedModelVersion.dataset_version_id ? (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginTop: 6,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Database size={14} color="var(--accent-lime)" />
                                  <span className="df-mono" style={{ color: '#FFF', fontSize: '0.82rem' }}>
                                    {selectedModelVersion.dataset_version_label ||
                                      `Version ${selectedModelVersion.dataset_version_id.slice(0, 8)}`}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="df-btn df-btn--ghost df-btn--sm"
                                  onClick={() => onNavigate('versions')}
                                >
                                  Inspect <ExternalLink size={11} />
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--text-muted)',
                                  marginTop: 4,
                                }}
                              >
                                Not linked to a specific dataset version
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="df-card-label" style={{ marginBottom: 8 }}>
                              HYPERPARAMETER SPECIFICATION
                            </div>
                            {selectedModelVersion.hyperparameters &&
                            Object.keys(selectedModelVersion.hyperparameters).length > 0 ? (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(2, 1fr)',
                                  gap: 8,
                                }}
                              >
                                {Object.entries(selectedModelVersion.hyperparameters).map(
                                  ([key, val]) => (
                                    <div
                                      key={key}
                                      style={{
                                        padding: '9px 12px',
                                        borderRadius: 10,
                                        background: 'rgba(9, 10, 9, 0.55)',
                                        border: '1px solid var(--border-subtle)',
                                      }}
                                    >
                                      <div
                                        className="df-mono"
                                        style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}
                                      >
                                        {key}
                                      </div>
                                      <div
                                        className="df-mono"
                                        style={{
                                          fontSize: '0.84rem',
                                          fontWeight: 600,
                                          color: 'var(--accent-lime)',
                                          marginTop: 2,
                                        }}
                                      >
                                        {String(val)}
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                No hyperparameters recorded for this version.
                              </div>
                            )}
                          </div>
                        </div>
                      </Panel>
                    </div>

                    <div style={{ gridColumn: 'span 6' }} className="df-col-full-mobile">
                      <Panel
                        title="EVALUATION EXPERIMENTS"
                        subtitle={`Runs evaluating ${selectedModel.name} (${selectedModelVersion.version})`}
                        rightSlot={
                          <button
                            type="button"
                            className="df-btn df-btn--secondary df-btn--sm"
                            onClick={() =>
                              onNavigate('experiments', {
                                modelVersionId: selectedModelVersion.id,
                              })
                            }
                          >
                            <FlaskConical size={12} /> Track Run
                          </button>
                        }
                      >
                        {linkedExperiments.length === 0 ? (
                          <EmptyState
                            icon={<FlaskConical size={20} />}
                            title="No Experiment Runs Yet"
                            description="Launch an experiment run against this model checkpoint to record accuracy, F1, and loss."
                            actionLabel="Go to Experiments"
                            onAction={() =>
                              onNavigate('experiments', {
                                modelVersionId: selectedModelVersion.id,
                              })
                            }
                          />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {linkedExperiments.map((exp) => (
                              <div
                                key={exp.id}
                                onClick={() => onNavigate('experiments', { experimentId: exp.id })}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: 12,
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border-subtle)',
                                  cursor: 'pointer',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      color: '#FFF',
                                      fontSize: '0.86rem',
                                    }}
                                  >
                                    {exp.name}
                                  </span>
                                  <StatusBadge status={exp.status} size="sm" />
                                </div>
                                <div
                                  className="df-mono"
                                  style={{
                                    display: 'flex',
                                    gap: 14,
                                    marginTop: 8,
                                    fontSize: '0.74rem',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  <span>
                                    ACC:{' '}
                                    <strong style={{ color: 'var(--accent-lime)' }}>
                                      {exp.accuracy !== null && exp.accuracy !== undefined
                                        ? `${(Number(exp.accuracy) * 100).toFixed(1)}%`
                                        : '—'}
                                    </strong>
                                  </span>
                                  <span>
                                    F1:{' '}
                                    <strong style={{ color: '#FFF' }}>
                                      {exp.f1_score !== null && exp.f1_score !== undefined
                                        ? Number(exp.f1_score).toFixed(3)
                                        : '—'}
                                    </strong>
                                  </span>
                                  <span>
                                    LOSS:{' '}
                                    <strong style={{ color: 'var(--accent-amber)' }}>
                                      {exp.loss !== null && exp.loss !== undefined
                                        ? Number(exp.loss).toFixed(4)
                                        : '—'}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Panel>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Model Modal */}
      <Modal
        isOpen={showCreateModel}
        onClose={() => setShowCreateModel(false)}
        title="REGISTER MODEL ARCHITECTURE"
        subtitle="Create a new model entry in the registry"
      >
        <form
          onSubmit={handleCreateModel}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <label className="df-label">PROJECT *</label>
            <select
              className="df-select"
              value={newModelProject}
              onChange={(e) => setNewModelProject(e.target.value)}
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-label">MODEL NAME *</label>
            <input
              type="text"
              className="df-input"
              placeholder="e.g., ResNet50-Classifier or BERT-Sentiment-Base"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="df-label">ML FRAMEWORK *</label>
            <input
              type="text"
              className="df-input"
              placeholder="PyTorch, TensorFlow, HuggingFace, XGBoost, Scikit-Learn..."
              value={newModelFramework}
              onChange={(e) => setNewModelFramework(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="df-label">ARCHITECTURE DESCRIPTION</label>
            <textarea
              className="df-textarea"
              rows={3}
              placeholder="Describe the model topology, target task, and input expectations..."
              value={newModelDesc}
              onChange={(e) => setNewModelDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={() => setShowCreateModel(false)}
            >
              Cancel
            </button>
            <button type="submit" className="df-btn df-btn--primary" disabled={creatingModel}>
              {creatingModel ? 'Registering...' : 'Register Model'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Model Version Modal */}
      <Modal
        isOpen={showCreateVersion}
        onClose={() => setShowCreateVersion(false)}
        title={`NEW CHECKPOINT — ${selectedModel?.name || ''}`}
        subtitle="Link a model version to a training dataset snapshot and hyperparameter dictionary"
      >
        <form
          onSubmit={handleCreateModelVersion}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="df-label">VERSION TAG *</label>
              <input
                type="text"
                className="df-input df-mono"
                placeholder="v1.0.0"
                value={verLabel}
                onChange={(e) => setVerLabel(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="df-label">ALGORITHM *</label>
              <input
                type="text"
                className="df-input"
                placeholder="e.g., Fine-tuned BERT, XGBoost"
                value={verAlgorithm}
                onChange={(e) => setVerAlgorithm(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="df-label">TRAINING DATASET</label>
              <select
                className="df-select"
                value={verDatasetId}
                onChange={(e) => setVerDatasetId(e.target.value)}
              >
                <option value="">None / External</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="df-label">DATASET VERSION SNAPSHOT</label>
              <select
                className="df-select"
                value={verDatasetVersionId}
                onChange={(e) => setVerDatasetVersionId(e.target.value)}
                disabled={!verDatasetId || verDatasetVersions.length === 0}
              >
                <option value="">Select version...</option>
                {verDatasetVersions.map((dv) => (
                  <option key={dv.id} value={dv.id}>
                    {dv.version_label} ({dv.row_count} rows)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="df-label">HYPERPARAMETERS (JSON)</label>
            <textarea
              className="df-textarea df-mono"
              rows={4}
              value={verHyperparams}
              onChange={(e) => setVerHyperparams(e.target.value)}
            />
          </div>

          <div>
            <label className="df-label">INFERENCE ENDPOINT URL (OPTIONAL)</label>
            <input
              type="text"
              className="df-input df-mono"
              placeholder="https://inference.internal/models/v1"
              value={verEndpoint}
              onChange={(e) => setVerEndpoint(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={() => setShowCreateVersion(false)}
            >
              Cancel
            </button>
            <button type="submit" className="df-btn df-btn--primary" disabled={creatingVersion}>
              {creatingVersion ? 'Saving...' : 'Commit Model Version'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
