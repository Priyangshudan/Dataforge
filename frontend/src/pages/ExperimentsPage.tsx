import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  Experiment,
  ExperimentMetric,
  Model,
  ModelVersion,
  Dataset,
  DatasetVersion,
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
  formatDateTime,
  formatShortDate,
} from '../components/Common';
import {
  FlaskConical,
  Plus,
  Search,
  BarChart3,
  Edit3,
} from 'lucide-react';

interface ExperimentsPageProps {
  initialExperimentId?: string;
  initialModelVersionId?: string;
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

export const ExperimentsPage: React.FC<ExperimentsPageProps> = ({
  initialExperimentId,
  initialModelVersionId,
}) => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const [selectedExp, setSelectedExp] = useState<Experiment | null>(null);
  const [expMetrics, setExpMetrics] = useState<ExperimentMetric[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'accuracy' | 'f1_score' | 'loss'>(
    'created_at'
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Create Experiment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpStatus, setNewExpStatus] = useState('RUNNING');
  const [newExpNotes, setNewExpNotes] = useState('');
  const [selectedModelForExp, setSelectedModelForExp] = useState('');
  const [availableModelVersions, setAvailableModelVersions] = useState<ModelVersion[]>([]);
  const [newExpModelVersionId, setNewExpModelVersionId] = useState(initialModelVersionId || '');
  const [selectedDatasetForExp, setSelectedDatasetForExp] = useState('');
  const [availableDatasetVersions, setAvailableDatasetVersions] = useState<DatasetVersion[]>([]);
  const [newExpDatasetVersionId, setNewExpDatasetVersionId] = useState('');
  const [creatingExp, setCreatingExp] = useState(false);

  // Update Status / Notes Modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [updatingExp, setUpdatingExp] = useState(false);

  // Log Metrics Modal
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [mAccuracy, setMAccuracy] = useState('');
  const [mPrecision, setMPrecision] = useState('');
  const [mRecall, setMRecall] = useState('');
  const [mF1, setMF1] = useState('');
  const [mLoss, setMLoss] = useState('');
  const [mRocAuc, setMRocAuc] = useState('');
  const [mExtraJson, setMExtraJson] = useState('{\n  "epoch": 10,\n  "runtime_sec": 142.5\n}');
  const [submittingMetrics, setSubmittingMetrics] = useState(false);

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eList, mList, dList] = await Promise.all([
        api.getExperiments({
          status: statusFilter || undefined,
        }),
        api.getModels(),
        api.getDatasets(),
      ]);

      setExperiments(eList || []);
      setModels(mList || []);
      setDatasets(dList || []);

      if (mList.length > 0 && !selectedModelForExp) setSelectedModelForExp(mList[0].id);
      if (dList.length > 0 && !selectedDatasetForExp) setSelectedDatasetForExp(dList[0].id);

      if (initialExperimentId) {
        const found = eList.find((x) => x.id === initialExperimentId);
        if (found) setSelectedExp(found);
        else if (eList.length > 0) setSelectedExp(eList[0]);
      } else if (!selectedExp && eList.length > 0) {
        setSelectedExp(eList[0]);
      } else if (selectedExp) {
        const refreshed = eList.find((x) => x.id === selectedExp.id);
        setSelectedExp(refreshed || eList[0] || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, initialExperimentId]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const loadSelectedExpMetrics = useCallback(async (expId: string) => {
    try {
      const metrics = await api.getExperimentMetrics(expId);
      setExpMetrics(metrics || []);
    } catch {
      setExpMetrics([]);
    }
  }, []);

  useEffect(() => {
    if (selectedExp) {
      loadSelectedExpMetrics(selectedExp.id);
    } else {
      setExpMetrics([]);
    }
  }, [selectedExp, loadSelectedExpMetrics]);

  useEffect(() => {
    if (!selectedModelForExp) return;
    api
      .getModelVersions(selectedModelForExp)
      .then((list) => {
        setAvailableModelVersions(list || []);
        if (list.length > 0) setNewExpModelVersionId(list[0].id);
      })
      .catch(() => setAvailableModelVersions([]));
  }, [selectedModelForExp]);

  useEffect(() => {
    if (!selectedDatasetForExp) return;
    api
      .getDatasetVersions(selectedDatasetForExp)
      .then((list) => {
        setAvailableDatasetVersions(list || []);
        if (list.length > 0) setNewExpDatasetVersionId(list[0].id);
      })
      .catch(() => setAvailableDatasetVersions([]));
  }, [selectedDatasetForExp]);

  const handleCreateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpModelVersionId || !newExpDatasetVersionId || !newExpName.trim()) {
      setToast({
        message: 'Please select model version, dataset version, and experiment name',
        type: 'error',
      });
      return;
    }
    setCreatingExp(true);
    try {
      const created = await api.createExperiment({
        model_version_id: newExpModelVersionId,
        dataset_version_id: newExpDatasetVersionId,
        name: newExpName.trim(),
        status: newExpStatus,
        notes: newExpNotes.trim() || undefined,
      });
      setToast({ message: `Experiment "${created.name}" initialized`, type: 'success' });
      setShowCreateModal(false);
      setNewExpName('');
      setNewExpNotes('');
      await loadExperiments();
      setSelectedExp(created);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to create experiment', type: 'error' });
    } finally {
      setCreatingExp(false);
    }
  };

  const openUpdateModal = () => {
    if (!selectedExp) return;
    setEditStatus(selectedExp.status);
    setEditNotes(selectedExp.notes || '');
    setShowUpdateModal(true);
  };

  const handleUpdateExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExp) return;
    setUpdatingExp(true);
    try {
      await api.updateExperiment(selectedExp.id, {
        status: editStatus,
        notes: editNotes,
      });
      setToast({ message: 'Experiment status & notes updated', type: 'success' });
      setShowUpdateModal(false);
      await loadExperiments();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update experiment', type: 'error' });
    } finally {
      setUpdatingExp(false);
    }
  };

  const openLogMetricsModal = () => {
    if (!selectedExp) return;
    setMAccuracy(
      selectedExp.accuracy !== null && selectedExp.accuracy !== undefined
        ? String(selectedExp.accuracy)
        : ''
    );
    setMPrecision(
      selectedExp.precision_score !== null && selectedExp.precision_score !== undefined
        ? String(selectedExp.precision_score)
        : ''
    );
    setMRecall(
      selectedExp.recall_score !== null && selectedExp.recall_score !== undefined
        ? String(selectedExp.recall_score)
        : ''
    );
    setMF1(
      selectedExp.f1_score !== null && selectedExp.f1_score !== undefined
        ? String(selectedExp.f1_score)
        : ''
    );
    setMLoss(
      selectedExp.loss !== null && selectedExp.loss !== undefined ? String(selectedExp.loss) : ''
    );
    setMRocAuc(
      selectedExp.roc_auc !== null && selectedExp.roc_auc !== undefined
        ? String(selectedExp.roc_auc)
        : ''
    );
    setShowMetricsModal(true);
  };

  const handleLogMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExp) return;

    let parsedExtra: Record<string, any> | undefined;
    if (mExtraJson.trim()) {
      try {
        parsedExtra = JSON.parse(mExtraJson);
      } catch {
        setToast({ message: 'Extra metrics must be valid JSON', type: 'error' });
        return;
      }
    }

    setSubmittingMetrics(true);
    try {
      await api.addExperimentMetrics(selectedExp.id, {
        accuracy: mAccuracy !== '' ? parseFloat(mAccuracy) : undefined,
        precision_score: mPrecision !== '' ? parseFloat(mPrecision) : undefined,
        recall_score: mRecall !== '' ? parseFloat(mRecall) : undefined,
        f1_score: mF1 !== '' ? parseFloat(mF1) : undefined,
        loss: mLoss !== '' ? parseFloat(mLoss) : undefined,
        roc_auc: mRocAuc !== '' ? parseFloat(mRocAuc) : undefined,
        extra_metrics: parsedExtra,
      });
      setToast({ message: 'Evaluation metrics recorded', type: 'success' });
      setShowMetricsModal(false);
      await loadExperiments();
      await loadSelectedExpMetrics(selectedExp.id);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to record metrics', type: 'error' });
    } finally {
      setSubmittingMetrics(false);
    }
  };

  const filteredExperiments = experiments
    .filter((exp) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        exp.name.toLowerCase().includes(q) ||
        (exp.model_name || '').toLowerCase().includes(q) ||
        (exp.dataset_name || '').toLowerCase().includes(q) ||
        (exp.notes || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'accuracy') return Number(b.accuracy || -1) - Number(a.accuracy || -1);
      if (sortBy === 'f1_score') return Number(b.f1_score || -1) - Number(a.f1_score || -1);
      if (sortBy === 'loss') return Number(a.loss ?? 9999) - Number(b.loss ?? 9999);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (loading && experiments.length === 0) {
    return <LoadingSpinner message="Loading experiment runs..." />;
  }

  if (error && experiments.length === 0) {
    return <ErrorState message={error} onRetry={loadExperiments} />;
  }

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
        eyebrow="EXPERIMENT TRACKING & METRIC TELEMETRY"
        title="EXPERIMENT RUNS"
        subtitle="Track machine learning training runs, compare accuracy/F1/ROC-AUC/loss metrics, and trace model-to-dataset execution pairs."
        actions={
          <button
            type="button"
            className="df-btn df-btn--primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={14} /> Launch Experiment Run
          </button>
        }
      />

      {/* Comparative Metric Bar Panel */}
      {filteredExperiments.some((e) => e.accuracy !== null && e.accuracy !== undefined) && (
        <Panel
          title="COMPARATIVE RUN BENCHMARK"
          subtitle="Accuracy vs F1-Score vs Loss across active evaluation runs"
          style={{ marginBottom: 16 }}
          rightSlot={
            <div style={{ display: 'flex', gap: 14 }}>
              <RingLegend label="ACCURACY" color="lime" />
              <RingLegend label="F1 SCORE" color="white" />
              <RingLegend label="LOSS" color="amber" />
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredExperiments
              .filter((e) => e.accuracy !== null && e.accuracy !== undefined)
              .slice(0, 5)
              .map((exp) => {
                const acc = Math.max(0, Math.min(100, Number(exp.accuracy || 0) * 100));
                const f1 = Math.max(0, Math.min(100, Number(exp.f1_score || 0) * 100));
                const lossVal =
                  exp.loss !== null && exp.loss !== undefined ? Number(exp.loss) : null;
                const isSelected = selectedExp?.id === exp.id;

                return (
                  <div
                    key={exp.id}
                    onClick={() => setSelectedExp(exp)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '220px 1fr 180px',
                      alignItems: 'center',
                      gap: 14,
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: isSelected ? 'rgba(184, 255, 98, 0.06)' : 'var(--bg-elevated)',
                      border: isSelected
                        ? '1px solid rgba(184, 255, 98, 0.35)'
                        : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#FFF' }}>
                        {exp.name}
                      </div>
                      <div
                        className="df-mono"
                        style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}
                      >
                        {exp.model_name} ({exp.model_version_label})
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${acc}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: 'var(--accent-lime)',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${f1}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: '#F4F5F4',
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="df-mono"
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10,
                        fontSize: '0.74rem',
                      }}
                    >
                      <span style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>
                        {acc.toFixed(1)}%
                      </span>
                      <span style={{ color: '#FFF' }}>
                        F1 {Number(exp.f1_score || 0).toFixed(2)}
                      </span>
                      {lossVal !== null && (
                        <span style={{ color: 'var(--accent-amber)' }}>
                          L {lossVal.toFixed(3)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </Panel>
      )}

      {/* Filter & Sort Controls */}
      <Panel style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
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
              placeholder="Filter runs by name, model, dataset, or notes..."
              style={{ paddingLeft: 34 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="df-select"
            style={{ width: 170 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="RUNNING">RUNNING</option>
            <option value="PLANNED">PLANNED</option>
            <option value="FAILED">FAILED</option>
          </select>

          <select
            className="df-select"
            style={{ width: 180 }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort experiments"
          >
            <option value="created_at">Sort: Most Recent</option>
            <option value="accuracy">Sort: Highest Accuracy</option>
            <option value="f1_score">Sort: Highest F1 Score</option>
            <option value="loss">Sort: Lowest Loss</option>
          </select>
        </div>
      </Panel>

      {/* Main Split View */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        <div style={{ gridColumn: 'span 7' }} className="df-col-full-mobile">
          <Panel
            title={`EXPERIMENT REGISTRY (${filteredExperiments.length})`}
            subtitle="Click any experiment run to inspect metric history or log new evaluation results"
          >
            {filteredExperiments.length === 0 ? (
              <EmptyState
                icon={<FlaskConical size={22} />}
                title="No Experiments Match Filters"
                description="Launch a new experiment run or clear active filters."
                actionLabel="Launch Experiment"
                onAction={() => setShowCreateModal(true)}
              />
            ) : (
              <div className="df-table-wrapper">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th>EXPERIMENT RUN</th>
                      <th>MODEL · DATASET</th>
                      <th>STATUS</th>
                      <th>ACCURACY</th>
                      <th>F1 / LOSS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExperiments.map((exp) => {
                      const isSelected = selectedExp?.id === exp.id;
                      const hasAcc = exp.accuracy !== null && exp.accuracy !== undefined;

                      return (
                        <tr
                          key={exp.id}
                          onClick={() => setSelectedExp(exp)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(184, 255, 98, 0.06)' : undefined,
                          }}
                        >
                          <td>
                            <div style={{ fontWeight: 700, color: '#FFF', fontSize: '0.86rem' }}>
                              {exp.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {formatShortDate(exp.created_at)}
                            </div>
                          </td>
                          <td>
                            <div
                              className="df-mono"
                              style={{ fontSize: '0.76rem', color: 'var(--text-primary)' }}
                            >
                              {exp.model_name} ({exp.model_version_label})
                            </div>
                            <div
                              className="df-mono"
                              style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                            >
                              on {exp.dataset_name} ({exp.dataset_version_label})
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={exp.status} size="sm" />
                          </td>
                          <td className="df-mono">
                            {hasAcc ? (
                              <span style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>
                                {(Number(exp.accuracy) * 100).toFixed(2)}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                            )}
                          </td>
                          <td className="df-mono" style={{ fontSize: '0.76rem' }}>
                            <div>
                              F1:{' '}
                              {exp.f1_score !== null && exp.f1_score !== undefined
                                ? Number(exp.f1_score).toFixed(3)
                                : '—'}
                            </div>
                            <div style={{ color: 'var(--accent-amber)' }}>
                              Loss:{' '}
                              {exp.loss !== null && exp.loss !== undefined
                                ? Number(exp.loss).toFixed(4)
                                : '—'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Right 5 cols: Experiment Run Detail & Metric Submission */}
        <div style={{ gridColumn: 'span 5' }} className="df-col-full-mobile">
          {selectedExp ? (
            <Panel
              title={selectedExp.name.toUpperCase()}
              subtitle={`Run ID: ${selectedExp.id.slice(0, 8)}`}
              rightSlot={
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="df-btn df-btn--secondary df-btn--sm"
                    onClick={openUpdateModal}
                  >
                    <Edit3 size={12} /> Status
                  </button>
                  <button
                    type="button"
                    className="df-btn df-btn--primary df-btn--sm"
                    onClick={openLogMetricsModal}
                  >
                    <BarChart3 size={12} /> Log Metrics
                  </button>
                </div>
              }
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <StatusBadge status={selectedExp.status} />
                <span
                  className="df-mono"
                  style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}
                >
                  Started {formatDateTime(selectedExp.started_at || selectedExp.created_at)}
                </span>
              </div>

              {selectedExp.notes && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    marginBottom: 16,
                  }}
                >
                  {selectedExp.notes}
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="df-card-label">MODEL CHECKPOINT</div>
                  <div style={{ fontWeight: 700, color: '#FFF', fontSize: '0.86rem', marginTop: 4 }}>
                    {selectedExp.model_name || 'Model'}
                  </div>
                  <div
                    className="df-mono"
                    style={{ fontSize: '0.74rem', color: 'var(--accent-lime)' }}
                  >
                    {selectedExp.model_version_label}
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
                  <div className="df-card-label">EVALUATION DATASET</div>
                  <div style={{ fontWeight: 700, color: '#FFF', fontSize: '0.86rem', marginTop: 4 }}>
                    {selectedExp.dataset_name || 'Dataset'}
                  </div>
                  <div
                    className="df-mono"
                    style={{ fontSize: '0.74rem', color: 'var(--accent-amber)' }}
                  >
                    {selectedExp.dataset_version_label}
                  </div>
                </div>
              </div>

              <div className="df-card-label" style={{ marginBottom: 8 }}>
                LATEST EVALUATION TELEMETRY
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                {[
                  {
                    label: 'ACCURACY',
                    value:
                      selectedExp.accuracy !== null && selectedExp.accuracy !== undefined
                        ? `${(Number(selectedExp.accuracy) * 100).toFixed(2)}%`
                        : '—',
                    color: 'var(--accent-lime)',
                  },
                  {
                    label: 'PRECISION',
                    value:
                      selectedExp.precision_score !== null &&
                      selectedExp.precision_score !== undefined
                        ? Number(selectedExp.precision_score).toFixed(4)
                        : '—',
                    color: '#FFF',
                  },
                  {
                    label: 'RECALL',
                    value:
                      selectedExp.recall_score !== null && selectedExp.recall_score !== undefined
                        ? Number(selectedExp.recall_score).toFixed(4)
                        : '—',
                    color: '#FFF',
                  },
                  {
                    label: 'F1 SCORE',
                    value:
                      selectedExp.f1_score !== null && selectedExp.f1_score !== undefined
                        ? Number(selectedExp.f1_score).toFixed(4)
                        : '—',
                    color: 'var(--accent-lime)',
                  },
                  {
                    label: 'LOSS',
                    value:
                      selectedExp.loss !== null && selectedExp.loss !== undefined
                        ? Number(selectedExp.loss).toFixed(4)
                        : '—',
                    color: 'var(--accent-amber)',
                  },
                  {
                    label: 'ROC-AUC',
                    value:
                      selectedExp.roc_auc !== null && selectedExp.roc_auc !== undefined
                        ? Number(selectedExp.roc_auc).toFixed(4)
                        : '—',
                    color: '#FFF',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'rgba(9, 10, 9, 0.5)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="df-card-label" style={{ fontSize: '0.62rem' }}>
                      {m.label}
                    </div>
                    <div
                      className="df-stat-number df-stat-number--sm"
                      style={{ color: m.color, marginTop: 4 }}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="df-card-label" style={{ marginBottom: 8 }}>
                  RECORDED METRIC SNAPSHOTS ({expMetrics.length})
                </div>
                {expMetrics.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No metric snapshots logged yet. Click &ldquo;Log Metrics&rdquo; to submit
                    evaluation scores.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {expMetrics.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.76rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 4,
                          }}
                        >
                          <span
                            className="df-mono"
                            style={{ color: 'var(--accent-lime)', fontWeight: 600 }}
                          >
                            Snapshot #{expMetrics.length - idx}
                          </span>
                          <span
                            className="df-mono"
                            style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}
                          >
                            {formatDateTime(m.recorded_at)}
                          </span>
                        </div>
                        <div
                          className="df-mono"
                          style={{
                            display: 'flex',
                            gap: 12,
                            flexWrap: 'wrap',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span>
                            ACC:{' '}
                            {m.accuracy !== null && m.accuracy !== undefined
                              ? Number(m.accuracy).toFixed(4)
                              : '—'}
                          </span>
                          <span>
                            F1:{' '}
                            {m.f1_score !== null && m.f1_score !== undefined
                              ? Number(m.f1_score).toFixed(4)
                              : '—'}
                          </span>
                          <span>
                            LOSS:{' '}
                            {m.loss !== null && m.loss !== undefined
                              ? Number(m.loss).toFixed(4)
                              : '—'}
                          </span>
                          <span>
                            AUC:{' '}
                            {m.roc_auc !== null && m.roc_auc !== undefined
                              ? Number(m.roc_auc).toFixed(4)
                              : '—'}
                          </span>
                        </div>
                        {m.extra_metrics && Object.keys(m.extra_metrics).length > 0 && (
                          <div
                            className="df-mono"
                            style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}
                          >
                            Extra: {JSON.stringify(m.extra_metrics)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* Launch Experiment Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="LAUNCH EXPERIMENT RUN"
        subtitle="Bind a model checkpoint to an immutable dataset version and begin tracking"
      >
        <form
          onSubmit={handleCreateExperiment}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label className="df-label">EXPERIMENT RUN NAME *</label>
              <input
                type="text"
                className="df-input"
                placeholder="e.g., Exp-12: ResNet50 Augmentation Ablation"
                value={newExpName}
                onChange={(e) => setNewExpName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="df-label">INITIAL STATUS</label>
              <select
                className="df-select"
                value={newExpStatus}
                onChange={(e) => setNewExpStatus(e.target.value)}
              >
                <option value="RUNNING">RUNNING</option>
                <option value="PLANNED">PLANNED</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="df-label">MODEL ARCHITECTURE *</label>
              <select
                className="df-select"
                value={selectedModelForExp}
                onChange={(e) => setSelectedModelForExp(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="df-label">MODEL VERSION *</label>
              <select
                className="df-select"
                value={newExpModelVersionId}
                onChange={(e) => setNewExpModelVersionId(e.target.value)}
                required
              >
                {availableModelVersions.map((mv) => (
                  <option key={mv.id} value={mv.id}>
                    {mv.version} ({mv.algorithm || 'checkpoint'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="df-label">DATASET *</label>
              <select
                className="df-select"
                value={selectedDatasetForExp}
                onChange={(e) => setSelectedDatasetForExp(e.target.value)}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="df-label">DATASET VERSION *</label>
              <select
                className="df-select"
                value={newExpDatasetVersionId}
                onChange={(e) => setNewExpDatasetVersionId(e.target.value)}
                required
              >
                {availableDatasetVersions.map((dv) => (
                  <option key={dv.id} value={dv.id}>
                    {dv.version_label} ({dv.row_count} rows)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="df-label">HYPOTHESIS & RUN NOTES</label>
            <textarea
              className="df-textarea"
              rows={3}
              placeholder="Document hyperparameters, hardware environment, or validation strategy..."
              value={newExpNotes}
              onChange={(e) => setNewExpNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="df-btn df-btn--primary" disabled={creatingExp}>
              {creatingExp ? 'Launching...' : 'Start Experiment Run'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Experiment Status Modal */}
      <Modal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        title="UPDATE EXPERIMENT RUN"
        subtitle={selectedExp?.name}
      >
        <form
          onSubmit={handleUpdateExperiment}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <label className="df-label">EXECUTION STATUS</label>
            <select
              className="df-select"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              <option value="PLANNED">PLANNED</option>
              <option value="RUNNING">RUNNING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
          <div>
            <label className="df-label">RUN NOTES</label>
            <textarea
              className="df-textarea"
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={() => setShowUpdateModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="df-btn df-btn--primary" disabled={updatingExp}>
              {updatingExp ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Metrics Modal */}
      <Modal
        isOpen={showMetricsModal}
        onClose={() => setShowMetricsModal(false)}
        title={`LOG EVALUATION METRICS — ${selectedExp?.name || ''}`}
        subtitle="Submit evaluation scores (0.0 to 1.0 for ratios) to the experiment telemetry table"
      >
        <form
          onSubmit={handleLogMetrics}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div>
              <label className="df-label">ACCURACY (0-1)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                className="df-input df-mono"
                placeholder="0.9420"
                value={mAccuracy}
                onChange={(e) => setMAccuracy(e.target.value)}
              />
            </div>
            <div>
              <label className="df-label">PRECISION (0-1)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                className="df-input df-mono"
                placeholder="0.9380"
                value={mPrecision}
                onChange={(e) => setMPrecision(e.target.value)}
              />
            </div>
            <div>
              <label className="df-label">RECALL (0-1)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                className="df-input df-mono"
                placeholder="0.9450"
                value={mRecall}
                onChange={(e) => setMRecall(e.target.value)}
              />
            </div>
            <div>
              <label className="df-label">F1 SCORE (0-1)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                className="df-input df-mono"
                placeholder="0.9415"
                value={mF1}
                onChange={(e) => setMF1(e.target.value)}
              />
            </div>
            <div>
              <label className="df-label">LOSS (≥ 0)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                className="df-input df-mono"
                placeholder="0.1650"
                value={mLoss}
                onChange={(e) => setMLoss(e.target.value)}
              />
            </div>
            <div>
              <label className="df-label">ROC-AUC (0-1)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                className="df-input df-mono"
                placeholder="0.9780"
                value={mRocAuc}
                onChange={(e) => setMRocAuc(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="df-label">EXTRA METRICS (JSON)</label>
            <textarea
              className="df-textarea df-mono"
              rows={3}
              value={mExtraJson}
              onChange={(e) => setMExtraJson(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={() => setShowMetricsModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="df-btn df-btn--primary" disabled={submittingMetrics}>
              {submittingMetrics ? 'Recording...' : 'Record Metrics'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
