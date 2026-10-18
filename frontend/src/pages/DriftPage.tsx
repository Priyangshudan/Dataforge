import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  Dataset,
  DatasetVersion,
  DatasetSimilarity,
  ColumnDriftDetail,
  NavigationTab,
} from '../types';
import {
  PageHeader,
  Panel,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  StatusBadge,
  RingLegend,
  ToastNotification,
} from '../components/Common';
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  GitCompare,
} from 'lucide-react';

interface DriftPageProps {
  initialBaseVersionId?: string;
  initialCompareVersionId?: string;
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

export const DriftPage: React.FC<DriftPageProps> = ({
  initialBaseVersionId,
  initialCompareVersionId,
  onNavigate,
}) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [versions, setVersions] = useState<DatasetVersion[]>([]);

  const [baseVersionId, setBaseVersionId] = useState<string>(initialBaseVersionId || '');
  const [compareVersionId, setCompareVersionId] = useState<string>(initialCompareVersionId || '');

  const [driftRecord, setDriftRecord] = useState<DatasetSimilarity | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const loadDatasets = useCallback(async () => {
    setLoadingInit(true);
    setError(null);
    try {
      const list = await api.getDatasets({ sortBy: 'updated_at', sortOrder: 'DESC' });
      setDatasets(list || []);
      if (list.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets for drift analysis');
    } finally {
      setLoadingInit(false);
    }
  }, [selectedDatasetId]);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    if (!selectedDatasetId) return;
    api
      .getDatasetVersions(selectedDatasetId)
      .then((list) => {
        setVersions(list || []);
        if (list.length >= 2) {
          if (!initialBaseVersionId || !list.some((v) => v.id === initialBaseVersionId)) {
            setBaseVersionId(list[1].id);
          }
          if (!initialCompareVersionId || !list.some((v) => v.id === initialCompareVersionId)) {
            setCompareVersionId(list[0].id);
          }
        } else if (list.length === 1) {
          setBaseVersionId(list[0].id);
          setCompareVersionId(list[0].id);
          setDriftRecord(null);
        }
      })
      .catch(() => setVersions([]));
  }, [selectedDatasetId, initialBaseVersionId, initialCompareVersionId]);

  const runDriftCalculation = useCallback(async (bId: string, cId: string) => {
    if (!bId || !cId || bId === cId) return;
    setCalculating(true);
    try {
      const res = await api.calculateDrift({
        base_version_id: bId,
        compared_version_id: cId,
      });
      setDriftRecord(res);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to calculate statistical drift', type: 'error' });
    } finally {
      setCalculating(false);
    }
  }, []);

  useEffect(() => {
    if (baseVersionId && compareVersionId && baseVersionId !== compareVersionId) {
      runDriftCalculation(baseVersionId, compareVersionId);
    }
  }, [baseVersionId, compareVersionId, runDriftCalculation]);

  if (loadingInit && datasets.length === 0) {
    return <LoadingSpinner message="Initializing statistical drift analyzer..." />;
  }

  if (error && datasets.length === 0) {
    return <ErrorState message={error} onRetry={loadDatasets} />;
  }

  const baseVerLabel =
    versions.find((v) => v.id === baseVersionId)?.version_label || 'Base A';
  const compareVerLabel =
    versions.find((v) => v.id === compareVersionId)?.version_label || 'Target B';

  const details = driftRecord?.details || {};
  const columnDrift: ColumnDriftDetail[] = details.column_drift || [];
  const driftedColumnsCount = columnDrift.filter((c) => c.drift_detected).length;
  const driftStatus = details.drift_status || (Number(driftRecord?.drift_score || 0) > 0.35 ? 'HIGH' : Number(driftRecord?.drift_score || 0) > 0.15 ? 'MODERATE' : 'LOW');
  const addedCount = (details.added_columns || []).length;
  const removedCount = (details.removed_columns || []).length;
  const rowDiff = Number(details.row_count_diff || 0);
  const baseRows = Number(details.base_rows || 1);
  const rowDriftPct = baseRows > 0 ? Math.round((rowDiff / baseRows) * 100) : 0;

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
        eyebrow="DISTRIBUTION SHIFT & STATISTICAL TELEMETRY"
        title="DATA DRIFT ANALYSIS"
        subtitle="Quantify composite distribution drift (40% schema shift, 20% row volume shift, 40% numeric feature mean shift) across dataset versions."
        actions={
          baseVersionId &&
          compareVersionId &&
          baseVersionId !== compareVersionId && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="df-btn df-btn--secondary"
                onClick={() =>
                  onNavigate('similarity', {
                    baseVersionId,
                    compareVersionId,
                  })
                }
              >
                <Sparkles size={14} /> Jaccard Similarity
              </button>
              <button
                type="button"
                className="df-btn df-btn--secondary"
                onClick={() =>
                  onNavigate('versions', {
                    datasetId: selectedDatasetId,
                    baseVersionId,
                    compareVersionId,
                  })
                }
              >
                <GitCompare size={14} /> Version Explorer
              </button>
            </div>
          )
        }
      />

      {/* Version Selector Bar */}
      <Panel style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr auto 1fr auto',
            gap: 14,
            alignItems: 'end',
          }}
        >
          <div>
            <label className="df-label">DATASET</label>
            <select
              className="df-select"
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.total_versions || 0}v)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-label" style={{ color: 'var(--accent-amber)' }}>
              BASELINE SNAPSHOT (A)
            </label>
            <select
              className="df-select"
              value={baseVersionId}
              onChange={(e) => setBaseVersionId(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_label} ({v.row_count} rows)
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
              color: 'var(--text-secondary)',
            }}
          >
            <ArrowRight size={15} />
          </div>

          <div>
            <label className="df-label" style={{ color: 'var(--accent-lime)' }}>
              CANDIDATE SNAPSHOT (B)
            </label>
            <select
              className="df-select"
              value={compareVersionId}
              onChange={(e) => setCompareVersionId(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_label} ({v.row_count} rows)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="df-btn df-btn--primary"
            style={{ height: 42 }}
            disabled={
              calculating ||
              !baseVersionId ||
              !compareVersionId ||
              baseVersionId === compareVersionId
            }
            onClick={() => runDriftCalculation(baseVersionId, compareVersionId)}
          >
            <Activity size={14} /> {calculating ? 'Analyzing...' : 'Evaluate Drift'}
          </button>
        </div>

        {versions.length < 2 && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255, 158, 39, 0.1)',
              border: '1px solid rgba(255, 158, 39, 0.35)',
              color: 'var(--accent-amber)',
              fontSize: '0.82rem',
            }}
          >
            This dataset currently has {versions.length} version. Commit a second version to
            evaluate distribution drift.
          </div>
        )}
      </Panel>

      {calculating ? (
        <LoadingSpinner message="Computing feature distribution shifts & composite drift score..." />
      ) : driftRecord ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <Panel>
              <div className="df-card-label">COMPOSITE DRIFT SCORE</div>
              <div
                className="df-stat-number df-stat-number--lg"
                style={{
                  marginTop: 8,
                  color:
                    driftStatus === 'NONE' || driftStatus === 'LOW'
                      ? 'var(--accent-lime)'
                      : 'var(--accent-amber)',
                }}
              >
                {(Number(driftRecord.drift_score || 0) * 100).toFixed(1)}%
              </div>
              <div style={{ marginTop: 10 }}>
                <StatusBadge status={driftStatus} />
              </div>
            </Panel>

            <Panel>
              <div className="df-card-label">SCHEMA SIMILARITY</div>
              <div className="df-stat-number df-stat-number--lg" style={{ marginTop: 8 }}>
                {(Number(driftRecord.similarity_score || 0) * 100).toFixed(1)}%
              </div>
              <div
                className="df-mono"
                style={{ marginTop: 10, fontSize: '0.74rem', color: 'var(--text-secondary)' }}
              >
                +{addedCount} added · −{removedCount} removed
              </div>
            </Panel>

            <Panel>
              <div className="df-card-label">ROW VOLUME SHIFT</div>
              <div
                className="df-stat-number df-stat-number--lg"
                style={{
                  marginTop: 8,
                  color: Math.abs(rowDriftPct) > 25 ? 'var(--accent-amber)' : '#FFF',
                }}
              >
                {rowDriftPct > 0 ? '+' : ''}
                {rowDriftPct}%
              </div>
              <div
                className="df-mono"
                style={{ marginTop: 10, fontSize: '0.74rem', color: 'var(--text-secondary)' }}
              >
                Delta: {rowDiff > 0 ? '+' : ''}
                {rowDiff.toLocaleString()} rows
              </div>
            </Panel>

            <Panel>
              <div className="df-card-label">DRIFTED FEATURES (&gt;15% SHIFT)</div>
              <div
                className="df-stat-number df-stat-number--lg"
                style={{
                  marginTop: 8,
                  color:
                    driftedColumnsCount > 0 ? 'var(--accent-amber)' : 'var(--accent-lime)',
                }}
              >
                {driftedColumnsCount} / {columnDrift.length}
              </div>
              <div
                style={{ marginTop: 10, fontSize: '0.74rem', color: 'var(--text-secondary)' }}
              >
                {driftedColumnsCount > 0
                  ? 'Distribution shift detected in numeric columns'
                  : 'All shared columns within 15% mean tolerance'}
              </div>
            </Panel>
          </div>

          <Panel
            title={`COLUMN DISTRIBUTION SHIFT (${baseVerLabel} → ${compareVerLabel})`}
            subtitle="Relative mean shift across shared columns (threshold: 15% relative shift triggers DRIFT alert)"
            rightSlot={
              <div style={{ display: 'flex', gap: 14 }}>
                <RingLegend label="STABLE (≤15%)" color="lime" />
                <RingLegend label="DRIFT DETECTED (>15%)" color="amber" />
              </div>
            }
          >
            {columnDrift.length === 0 ? (
              <EmptyState
                icon={<Activity size={20} />}
                title="No Numeric Column Drift Recorded"
                description="Shared columns are categorical/text or have identical statistical distributions."
              />
            ) : (
              <div className="df-table-wrapper">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th>COLUMN NAME</th>
                      <th>DATA TYPE</th>
                      <th>BASE MEAN ({baseVerLabel})</th>
                      <th>TARGET MEAN ({compareVerLabel})</th>
                      <th>ABSOLUTE SHIFT</th>
                      <th>RELATIVE SHIFT VISUALIZATION</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnDrift.map((col) => {
                      const relPct =
                        col.relative_shift !== null && col.relative_shift !== undefined
                          ? Math.min(100, Math.abs(col.relative_shift * 100))
                          : 0;

                      return (
                        <tr key={col.column_name}>
                          <td className="df-mono" style={{ fontWeight: 700, color: '#FFF' }}>
                            {col.column_name}
                          </td>
                          <td>
                            <StatusBadge status={col.data_type} size="sm" />
                          </td>
                          <td className="df-mono">
                            {col.base_mean !== null && col.base_mean !== undefined
                              ? Number(col.base_mean).toFixed(4)
                              : '—'}
                          </td>
                          <td className="df-mono">
                            {col.comp_mean !== null && col.comp_mean !== undefined
                              ? Number(col.comp_mean).toFixed(4)
                              : '—'}
                          </td>
                          <td
                            className="df-mono"
                            style={{
                              color:
                                col.mean_shift && col.mean_shift > 0
                                  ? 'var(--accent-lime)'
                                  : col.mean_shift && col.mean_shift < 0
                                    ? 'var(--accent-amber)'
                                    : 'var(--text-secondary)',
                            }}
                          >
                            {col.mean_shift !== null && col.mean_shift !== undefined
                              ? `${col.mean_shift > 0 ? '+' : ''}${Number(col.mean_shift).toFixed(4)}`
                              : 'Non-numeric'}
                          </td>
                          <td style={{ minWidth: 190 }}>
                            {col.relative_shift !== null && col.relative_shift !== undefined ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div
                                  style={{
                                    flex: 1,
                                    height: 8,
                                    borderRadius: 999,
                                    background: 'rgba(255,255,255,0.06)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${Math.max(4, relPct)}%`,
                                      height: '100%',
                                      borderRadius: 999,
                                      background: col.drift_detected
                                        ? 'var(--accent-amber)'
                                        : 'var(--accent-lime)',
                                    }}
                                  />
                                </div>
                                <span
                                  className="df-mono"
                                  style={{
                                    fontSize: '0.74rem',
                                    width: 52,
                                    textAlign: 'right',
                                    color: col.drift_detected
                                      ? 'var(--accent-amber)'
                                      : 'var(--accent-lime)',
                                  }}
                                >
                                  {(col.relative_shift * 100).toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Categorical / Text
                              </span>
                            )}
                          </td>
                          <td>
                            {col.drift_detected ? (
                              <span className="df-badge df-badge--amber">
                                <AlertTriangle size={11} /> DRIFT
                              </span>
                            ) : (
                              <span className="df-badge df-badge--lime">
                                <CheckCircle2 size={11} /> STABLE
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
};
