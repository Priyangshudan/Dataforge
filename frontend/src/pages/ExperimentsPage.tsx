import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  TrendingUp
} from 'lucide-react';
import { api } from '../api/client';
import type { Experiment, ExperimentMetric, Model, ModelVersion, Dataset, DatasetVersion } from '../types';
import { LoadingSpinner, ErrorState, EmptyState, Modal, ToastNotification } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface ExperimentsPageProps {
  initialModelId?: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const ExperimentsPage: React.FC<ExperimentsPageProps> = ({ initialModelId }) => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Metrics Drawer State
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [metrics, setMetrics] = useState<ExperimentMetric[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Add Metric Modal
  const [isAddMetricOpen, setIsAddMetricOpen] = useState(false);
  const [accuracyVal, setAccuracyVal] = useState('0.9540');
  const [lossVal, setLossVal] = useState('0.0420');
  const [submittingMetric, setSubmittingMetric] = useState(false);

  // Create Experiment Modal
  const [isCreateExpOpen, setIsCreateExpOpen] = useState(false);
  const [expName, setExpName] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [selectedModelId, setSelectedModelId] = useState(initialModelId || '');
  const [selectedModelVersionId, setSelectedModelVersionId] = useState('');
  const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [datasetVersions, setDatasetVersions] = useState<DatasetVersion[]>([]);
  const [selectedDatasetVersionId, setSelectedDatasetVersionId] = useState('');
  const [submittingExp, setSubmittingExp] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchExperiments = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, modelsRes, dsRes] = await Promise.all([
        api.getExperiments(selectedStatus ? { status: selectedStatus } : undefined),
        api.getModels(),
        api.getDatasets()
      ]);

      setExperiments(expRes);
      setModels(modelsRes);
      if (modelsRes.length > 0 && !selectedModelId) {
        setSelectedModelId(modelsRes[0].id);
      }
      setDatasets(dsRes);
      if (dsRes.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(dsRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, [selectedStatus]);

  // Load Model Versions when model changes
  useEffect(() => {
    if (selectedModelId) {
      api.getModelVersions(selectedModelId).then(res => {
        if (res.length > 0) {
          setModelVersions(res);
          setSelectedModelVersionId(res[0].id);
        } else {
          setModelVersions([]);
          setSelectedModelVersionId('');
        }
      });
    }
  }, [selectedModelId]);

  // Load Dataset Versions when dataset changes
  useEffect(() => {
    if (selectedDatasetId) {
      api.getDatasetVersions(selectedDatasetId).then(res => {
        if (res.length > 0) {
          setDatasetVersions(res);
          setSelectedDatasetVersionId(res[0].id);
        } else {
          setDatasetVersions([]);
          setSelectedDatasetVersionId('');
        }
      });
    }
  }, [selectedDatasetId]);

  const loadMetrics = async (exp: Experiment) => {
    setSelectedExperiment(exp);
    setLoadingMetrics(true);
    try {
      const res = await api.getExperimentMetrics(exp.id);
      setMetrics(res);
    } catch {
      // Ignored
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim() || !selectedModelVersionId || !selectedDatasetVersionId) {
      setToast({ type: 'error', message: 'Name, Model Version, and Dataset Version are required.' });
      return;
    }

    setSubmittingExp(true);
    try {
      const res = await api.createExperiment({
        name: expName.trim(),
        notes: expNotes.trim() || undefined,
        model_version_id: selectedModelVersionId,
        dataset_version_id: selectedDatasetVersionId,
        status: 'COMPLETED'
      });

      setToast({ type: 'success', message: `Experiment "${res.name}" created successfully!` });
      setIsCreateExpOpen(false);
      setExpName('');
      setExpNotes('');
      await fetchExperiments();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error creating experiment' });
    } finally {
      setSubmittingExp(false);
    }
  };

  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExperiment) return;

    setSubmittingMetric(true);
    try {
      const acc = parseFloat(accuracyVal);
      const loss = parseFloat(lossVal);

      await api.addExperimentMetrics(selectedExperiment.id, {
        accuracy: isNaN(acc) ? undefined : acc,
        loss: isNaN(loss) ? undefined : loss
      });

      setToast({ type: 'success', message: `Metrics recorded!` });
      setIsAddMetricOpen(false);
      await loadMetrics(selectedExperiment);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error recording metric' });
    } finally {
      setSubmittingMetric(false);
    }
  };

  const filteredExperiments = experiments.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.notes && e.notes.toLowerCase().includes(search.toLowerCase())) ||
    (e.model_name && e.model_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Experiment Tracking
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Reproducible ML training runs binding exact dataset versions to model checkpoints.
          </p>
        </div>

        <button
          onClick={() => setIsCreateExpOpen(true)}
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
          Create Experiment
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {/* Status Selector */}
        <div style={{ minWidth: '180px' }}>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="RUNNING">Running</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            placeholder="Search experiments by name, model, or notes..."
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
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Querying ML experiments from PostgreSQL..." />
      ) : error ? (
        <ErrorState title="Experiments Loading Error" message={error} onRetry={fetchExperiments} />
      ) : filteredExperiments.length === 0 ? (
        <EmptyState
          title="No Experiments Found"
          description={search ? `No experiments matching "${search}"` : "You haven't run any ML experiments yet."}
          actionText="Create Experiment"
          onAction={() => setIsCreateExpOpen(true)}
          icon={<FlaskConical size={36} />}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedExperiment ? '1.3fr 1fr' : '1fr', gap: '24px' }}>
          {/* Experiments Table */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '14px 20px' }}>Experiment</th>
                  <th style={{ padding: '14px 16px' }}>Status</th>
                  <th style={{ padding: '14px 16px' }}>Model</th>
                  <th style={{ padding: '14px 16px' }}>Dataset</th>
                  <th style={{ padding: '14px 16px' }}>Accuracy</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExperiments.map((exp) => (
                  <tr
                    key={exp.id}
                    onClick={() => loadMetrics(exp)}
                    style={{
                      borderBottom: '1px solid rgba(36, 48, 68, 0.4)',
                      cursor: 'pointer',
                      backgroundColor: selectedExperiment?.id === exp.id ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{exp.name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{exp.notes || 'No notes'}</div>
                    </td>

                    <td style={{ padding: '16px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: exp.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                        color: exp.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                      }}>
                        {exp.status === 'COMPLETED' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {exp.status}
                      </span>
                    </td>

                    <td style={{ padding: '16px 16px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-indigo)' }}>
                      {exp.model_name || exp.model_version_id.slice(0, 8)} ({exp.model_version_label || 'v1.0.0'})
                    </td>

                    <td style={{ padding: '16px 16px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                      {exp.dataset_name || exp.dataset_version_id.slice(0, 8)} ({exp.dataset_version_label || 'v1.0.0'})
                    </td>

                    <td style={{ padding: '16px 16px', color: 'var(--accent-emerald)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      {exp.accuracy ? Number(exp.accuracy).toFixed(4) : '—'}
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadMetrics(exp);
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
                        Metrics
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Metrics Drawer */}
          {selectedExperiment && (
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
                    {selectedExperiment.name}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Metrics & Evaluation Parameters
                  </p>
                </div>
                <button
                  onClick={() => setSelectedExperiment(null)}
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
                  <TrendingUp size={16} color="var(--accent-emerald)" />
                  Performance Metrics ({metrics.length})
                </h4>
                <button
                  onClick={() => setIsAddMetricOpen(true)}
                  style={{
                    fontSize: '12px',
                    color: 'var(--accent-cyan)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={14} /> Add Metric
                </button>
              </div>

              {loadingMetrics ? (
                <LoadingSpinner message="Querying experiment metrics..." />
              ) : metrics.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No metrics logged for this experiment yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {metrics.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          Accuracy: {m.accuracy ? Number(m.accuracy).toFixed(4) : '—'}
                        </span>
                        {m.loss !== undefined && m.loss !== null && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Loss: {Number(m.loss).toFixed(4)}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(m.recorded_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Experiment */}
      <Modal
        isOpen={isCreateExpOpen}
        onClose={() => setIsCreateExpOpen(false)}
        title="Create New Experiment"
      >
        <form onSubmit={handleCreateExperiment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Experiment Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Fine-tuned Classifier Run #4"
              value={expName}
              onChange={(e) => setExpName(e.target.value)}
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

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Target Model
            </label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
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
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.framework})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Model Version Checkpoint <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <select
              value={selectedModelVersionId}
              onChange={(e) => setSelectedModelVersionId(e.target.value)}
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
              {modelVersions.map(mv => (
                <option key={mv.id} value={mv.id}>{mv.version} ({mv.algorithm})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Dataset
            </label>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
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
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Dataset Version Used <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <select
              value={selectedDatasetVersionId}
              onChange={(e) => setSelectedDatasetVersionId(e.target.value)}
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
              {datasetVersions.map(dv => (
                <option key={dv.id} value={dv.id}>{dv.version_label} ({dv.row_count} rows)</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Notes
            </label>
            <textarea
              rows={2}
              placeholder="Hypothesis or training objective..."
              value={expNotes}
              onChange={(e) => setExpNotes(e.target.value)}
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
              onClick={() => setIsCreateExpOpen(false)}
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
              disabled={submittingExp}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                opacity: submittingExp ? 0.7 : 1
              }}
            >
              {submittingExp ? 'Creating...' : 'Create Experiment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Metric */}
      <Modal
        isOpen={isAddMetricOpen}
        onClose={() => setIsAddMetricOpen(false)}
        title="Log Experiment Metric"
      >
        <form onSubmit={handleAddMetric} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Accuracy (0.0 to 1.0)
            </label>
            <input
              type="number"
              step="any"
              placeholder="0.9540"
              value={accuracyVal}
              onChange={(e) => setAccuracyVal(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Loss Value
            </label>
            <input
              type="number"
              step="any"
              placeholder="0.0420"
              value={lossVal}
              onChange={(e) => setLossVal(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsAddMetricOpen(false)}
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
              disabled={submittingMetric}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                opacity: submittingMetric ? 0.7 : 1
              }}
            >
              {submittingMetric ? 'Saving...' : 'Save Metric'}
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

