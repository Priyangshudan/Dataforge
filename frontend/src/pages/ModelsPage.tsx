import React, { useEffect, useState } from 'react';
import {
  Brain,
  Plus,
  Search,
  GitBranch,
  ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import type { Model, ModelVersion, Project } from '../types';
import { LoadingSpinner, ErrorState, EmptyState, Modal, ToastNotification } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface ModelsPageProps {
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const ModelsPage: React.FC<ModelsPageProps> = ({ onNavigate }) => {
  const [models, setModels] = useState<Model[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected Model Drawer / Details
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Create Model Modal
  const [isCreateModelOpen, setIsCreateModelOpen] = useState(false);
  const [modelName, setModelName] = useState('');
  const [modelDesc, setModelDesc] = useState('');
  const [modelFramework, setModelFramework] = useState('PyTorch');
  const [taskType, setTaskType] = useState('Classification');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [submittingModel, setSubmittingModel] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelsRes, projRes] = await Promise.all([
        api.getModels(),
        api.getProjects()
      ]);

      setModels(modelsRes);
      setProjects(projRes);
      if (projRes.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  const loadModelVersions = async (model: Model) => {
    setSelectedModel(model);
    setLoadingVersions(true);
    try {
      const res = await api.getModelVersions(model.id);
      setModelVersions(res);
    } catch {
      // Ignored
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim() || !selectedProjectId) {
      setToast({ type: 'error', message: 'Model Name and Project are required.' });
      return;
    }

    setSubmittingModel(true);
    try {
      const res = await api.createModel({
        project_id: selectedProjectId,
        name: modelName.trim(),
        description: modelDesc.trim() || undefined,
        framework: modelFramework.trim() || 'PyTorch',
        task_type: taskType.trim() || 'Classification'
      });

      setToast({ type: 'success', message: `Model "${res.name}" registered successfully!` });
      setIsCreateModelOpen(false);
      setModelName('');
      setModelDesc('');
      await fetchModels();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error submitting model creation' });
    } finally {
      setSubmittingModel(false);
    }
  };

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.framework && m.framework.toLowerCase().includes(search.toLowerCase())) ||
    (m.task_type && m.task_type.toLowerCase().includes(search.toLowerCase())) ||
    (m.description && m.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Machine Learning Models
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Model registry tracking architectures, framework environments, and version checkpoints.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModelOpen(true)}
          style={{
            backgroundColor: 'var(--accent-cyan)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Plus size={18} />
          Register Model
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', maxWidth: '420px', width: '100%' }}>
        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
        <input
          type="text"
          placeholder="Filter models by name, framework, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px 10px 38px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* Main Content: Split grid if a model is selected */}
      {loading ? (
        <LoadingSpinner message="Querying ML Model registry from PostgreSQL..." />
      ) : error ? (
        <ErrorState title="Models Loading Error" message={error} onRetry={fetchModels} />
      ) : filteredModels.length === 0 ? (
        <EmptyState
          title="No Models Registered"
          description={search ? `No models matching "${search}"` : "You haven't registered any ML models yet."}
          actionText="Register Model"
          onAction={() => setIsCreateModelOpen(true)}
          icon={<Brain size={36} />}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedModel ? '1.2fr 1fr' : '1fr', gap: '24px' }}>
          {/* Models Table */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '14px 20px' }}>Model</th>
                  <th style={{ padding: '14px 16px' }}>Framework</th>
                  <th style={{ padding: '14px 16px' }}>Task Type</th>
                  <th style={{ padding: '14px 16px' }}>Status</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => loadModelVersions(m)}
                    style={{
                      borderBottom: '1px solid rgba(36, 48, 68, 0.4)',
                      cursor: 'pointer',
                      backgroundColor: selectedModel?.id === m.id ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Brain size={18} color="var(--accent-indigo)" />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{m.description || 'No description'}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px 16px' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: 'var(--accent-indigo)',
                        fontFamily: 'JetBrains Mono, monospace'
                      }}>
                        {m.framework || 'Scikit-Learn'}
                      </span>
                    </td>

                    <td style={{ padding: '16px 16px', color: 'var(--text-secondary)' }}>
                      {m.task_type || 'Classification'}
                    </td>

                    <td style={{ padding: '16px 16px', color: 'var(--text-muted)' }}>
                      {m.status || 'Active'}
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadModelVersions(m);
                        }}
                        style={{
                          color: 'var(--accent-cyan)',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Model Versions Drawer */}
          {selectedModel && (
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedModel.name}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {selectedModel.description || 'No description provided.'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedModel(null)}
                  style={{ color: 'var(--text-muted)', fontSize: '20px' }}
                >
                  &times;
                </button>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border)',
                paddingTop: '16px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitBranch size={16} color="var(--accent-cyan)" />
                  Model Versions & Checkpoints ({modelVersions.length})
                </h4>
                <button
                  onClick={() => onNavigate('experiments', { modelId: selectedModel.id })}
                  style={{
                    fontSize: '12px',
                    color: 'var(--accent-cyan)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  View Experiments <ArrowRight size={13} />
                </button>
              </div>

              {loadingVersions ? (
                <LoadingSpinner message="Loading model checkpoints..." />
              ) : modelVersions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No versions registered for this model yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {modelVersions.map((mv) => (
                    <div
                      key={mv.id}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 600,
                          color: 'var(--accent-cyan)',
                          fontSize: '13px'
                        }}>
                          {mv.version}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(mv.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Algorithm: {mv.algorithm}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Model */}
      <Modal
        isOpen={isCreateModelOpen}
        onClose={() => setIsCreateModelOpen(false)}
        title="Register ML Model"
      >
        <form onSubmit={handleCreateModel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Project <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Model Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. XGBoost Transaction Classifier"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Framework
              </label>
              <input
                type="text"
                placeholder="PyTorch, XGBoost, Scikit-Learn"
                value={modelFramework}
                onChange={(e) => setModelFramework(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Task Type
              </label>
              <input
                type="text"
                placeholder="Classification, Regression, LLM"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Architecture, hyperparameters, and target objectives..."
              value={modelDesc}
              onChange={(e) => setModelDesc(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsCreateModelOpen(false)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '13px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingModel}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                opacity: submittingModel ? 0.7 : 1
              }}
            >
              {submittingModel ? 'Registering...' : 'Register Model'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast Alert */}
      {toast && (
        <ToastNotification
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

