import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  Dataset,
  DatasetVersion,
  DatasetSimilarity,
  VersionComparison,
  NavigationTab,
} from '../types';
import {
  PageHeader,
  Panel,
  LoadingSpinner,
  ErrorState,
  StatusBadge,
  RingLegend,
  ToastNotification,
  formatBytes,
} from '../components/Common';
import {
  Sparkles,
  ArrowRight,
  Activity,
} from 'lucide-react';

interface SimilarityPageProps {
  initialBaseVersionId?: string;
  initialCompareVersionId?: string;
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

export const SimilarityPage: React.FC<SimilarityPageProps> = ({
  initialBaseVersionId,
  initialCompareVersionId,
  onNavigate,
}) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const [datasetAId, setDatasetAId] = useState<string>('');
  const [versionsA, setVersionsA] = useState<DatasetVersion[]>([]);
  const [baseVersionId, setBaseVersionId] = useState<string>(initialBaseVersionId || '');

  const [datasetBId, setDatasetBId] = useState<string>('');
  const [versionsB, setVersionsB] = useState<DatasetVersion[]>([]);
  const [compareVersionId, setCompareVersionId] = useState<string>(initialCompareVersionId || '');

  const [simRecord, setSimRecord] = useState<DatasetSimilarity | null>(null);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [runningCheck, setRunningCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const loadInitialDatasets = useCallback(async () => {
    setLoadingInit(true);
    setError(null);
    try {
      const list = await api.getDatasets({ sortBy: 'updated_at', sortOrder: 'DESC' });
      setDatasets(list || []);
      if (list.length > 0) {
        setDatasetAId(list[0].id);
        setDatasetBId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets for similarity engine');
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    loadInitialDatasets();
  }, [loadInitialDatasets]);

  useEffect(() => {
    if (!datasetAId) return;
    api
      .getDatasetVersions(datasetAId)
      .then((vList) => {
        setVersionsA(vList || []);
        if (vList.length > 0) {
          setBaseVersionId((prev) =>
            prev && vList.some((v) => v.id === prev)
              ? prev
              : vList[vList.length > 1 ? 1 : 0].id
          );
        }
      })
      .catch(() => setVersionsA([]));
  }, [datasetAId]);

  useEffect(() => {
    if (!datasetBId) return;
    api
      .getDatasetVersions(datasetBId)
      .then((vList) => {
        setVersionsB(vList || []);
        if (vList.length > 0) {
          setCompareVersionId((prev) =>
            prev && vList.some((v) => v.id === prev) ? prev : vList[0].id
          );
        }
      })
      .catch(() => setVersionsB([]));
  }, [datasetBId]);

  const handleRunSimilarity = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!baseVersionId || !compareVersionId) {
        setToast({
          message: 'Select both a Base Version and a Compared Version',
          type: 'error',
        });
        return;
      }
      if (baseVersionId === compareVersionId) {
        setToast({
          message: 'Base version and compared version must be distinct snapshots',
          type: 'error',
        });
        return;
      }

      setRunningCheck(true);
      try {
        const [simRes, compRes] = await Promise.all([
          api.checkSimilarity({
            base_version_id: baseVersionId,
            compared_version_id: compareVersionId,
          }),
          api.compareVersions(baseVersionId, compareVersionId),
        ]);
        setSimRecord(simRes);
        setComparison(compRes);
      } catch (err: any) {
        setToast({ message: err.message || 'Similarity check failed', type: 'error' });
      } finally {
        setRunningCheck(false);
      }
    },
    [baseVersionId, compareVersionId]
  );

  useEffect(() => {
    if (baseVersionId && compareVersionId && baseVersionId !== compareVersionId && !comparison) {
      handleRunSimilarity();
    }
  }, [baseVersionId, compareVersionId, comparison, handleRunSimilarity]);

  if (loadingInit && datasets.length === 0) {
    return <LoadingSpinner message="Initializing Jaccard similarity engine..." />;
  }

  if (error && datasets.length === 0) {
    return <ErrorState message={error} onRetry={loadInitialDatasets} />;
  }

  const sharedCols = comparison?.shared_columns || simRecord?.shared_columns || [];
  const addedCols = comparison?.added_columns || simRecord?.details?.added_columns || [];
  const removedCols = comparison?.removed_columns || simRecord?.details?.removed_columns || [];
  const jaccardScore = Number(
    comparison?.jaccard_similarity ?? simRecord?.similarity_score ?? 0
  );
  const totalUnionColumns = sharedCols.length + addedCols.length + removedCols.length;

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
        eyebrow="SCHEMA OVERLAP & STRUCTURAL COMPATIBILITY"
        title="JACCARD SIMILARITY ENGINE"
        subtitle="Evaluate structural schema compatibility, column set intersections, and byte-level checksum identity across any two dataset versions."
        actions={
          comparison && (
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={() =>
                onNavigate('drift', {
                  baseVersionId,
                  compareVersionId,
                })
              }
            >
              <Activity size={14} /> Run Drift Analysis on Pair
            </button>
          )
        }
      />

      <Panel
        title="SELECT DATASET SNAPSHOT PAIR"
        subtitle="Compare two versions within the same dataset or across distinct datasets via POST /api/ai/check-similarity"
        style={{ marginBottom: 16 }}
      >
        <form onSubmit={handleRunSimilarity}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr auto',
              gap: 16,
              alignItems: 'end',
            }}
          >
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(255, 158, 39, 0.3)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div>
                <label className="df-label" style={{ color: 'var(--accent-amber)' }}>
                  BASE DATASET (A)
                </label>
                <select
                  className="df-select"
                  value={datasetAId}
                  onChange={(e) => setDatasetAId(e.target.value)}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="df-label" style={{ color: 'var(--accent-amber)' }}>
                  BASE VERSION (A)
                </label>
                <select
                  className="df-select"
                  value={baseVersionId}
                  onChange={(e) => setBaseVersionId(e.target.value)}
                >
                  {versionsA.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version_label} ({v.column_count} cols · {v.row_count}r)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
                color: 'var(--text-secondary)',
              }}
            >
              <ArrowRight size={16} />
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(184, 255, 98, 0.3)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div>
                <label className="df-label" style={{ color: 'var(--accent-lime)' }}>
                  COMPARED DATASET (B)
                </label>
                <select
                  className="df-select"
                  value={datasetBId}
                  onChange={(e) => setDatasetBId(e.target.value)}
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="df-label" style={{ color: 'var(--accent-lime)' }}>
                  COMPARED VERSION (B)
                </label>
                <select
                  className="df-select"
                  value={compareVersionId}
                  onChange={(e) => setCompareVersionId(e.target.value)}
                >
                  {versionsB.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version_label} ({v.column_count} cols · {v.row_count}r)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <button
                type="submit"
                className="df-btn df-btn--primary df-btn--lg"
                disabled={runningCheck || baseVersionId === compareVersionId}
              >
                <Sparkles size={15} /> {runningCheck ? 'Computing...' : 'Compute Similarity'}
              </button>
            </div>
          </div>

          {baseVersionId && compareVersionId && baseVersionId === compareVersionId && (
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
              Select two distinct dataset versions to compute Jaccard schema similarity.
            </div>
          )}
        </form>
      </Panel>

      {runningCheck ? (
        <LoadingSpinner message="Evaluating Jaccard index |A ∩ B| / |A ∪ B|..." />
      ) : comparison ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          <div style={{ gridColumn: 'span 5' }} className="df-col-full-mobile">
            <Panel
              title="JACCARD SIMILARITY COEFFICIENT"
              subtitle={`J(A, B) = |Shared| / |Union| (${sharedCols.length} / ${totalUnionColumns} columns)`}
              rightSlot={
                <StatusBadge
                  status={
                    jaccardScore >= 0.85
                      ? 'HIGH_COMPATIBILITY'
                      : jaccardScore >= 0.5
                        ? 'PARTIAL_OVERLAP'
                        : 'DIVERGENT_SCHEMA'
                  }
                />
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 14,
                  margin: '12px 0 18px',
                }}
              >
                <div
                  className="df-stat-number df-stat-number--xl"
                  style={{
                    color:
                      jaccardScore >= 0.75 ? 'var(--accent-lime)' : 'var(--accent-amber)',
                  }}
                >
                  {(jaccardScore * 100).toFixed(1)}%
                </div>
                <span
                  className="df-mono"
                  style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}
                >
                  ({jaccardScore.toFixed(4)} index)
                </span>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <RingLegend label={`SHARED (${sharedCols.length})`} color="lime" />
                  <RingLegend label={`ADDED (${addedCols.length})`} color="white" />
                  <RingLegend label={`REMOVED (${removedCols.length})`} color="amber" />
                </div>
                <div
                  style={{
                    height: 16,
                    borderRadius: 999,
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    overflow: 'hidden',
                    gap: 2,
                  }}
                >
                  {totalUnionColumns > 0 && (
                    <>
                      <div
                        style={{
                          width: `${(sharedCols.length / totalUnionColumns) * 100}%`,
                          background: 'var(--accent-lime)',
                        }}
                      />
                      <div
                        style={{
                          width: `${(addedCols.length / totalUnionColumns) * 100}%`,
                          background: '#F4F5F4',
                        }}
                      />
                      <div
                        style={{
                          width: `${(removedCols.length / totalUnionColumns) * 100}%`,
                          background: 'var(--accent-amber)',
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                <div style={{ padding: 12, borderRadius: 12, background: 'var(--bg-elevated)' }}>
                  <div className="df-card-label">ROW COUNT DELTA</div>
                  <div className="df-stat-number df-stat-number--sm" style={{ marginTop: 4 }}>
                    {comparison.row_count_diff > 0 ? '+' : ''}
                    {comparison.row_count_diff.toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 12, background: 'var(--bg-elevated)' }}>
                  <div className="df-card-label">FILE SIZE DELTA</div>
                  <div className="df-stat-number df-stat-number--sm" style={{ marginTop: 4 }}>
                    {comparison.file_size_diff_bytes > 0 ? '+' : ''}
                    {formatBytes(Math.abs(comparison.file_size_diff_bytes))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div style={{ gridColumn: 'span 7' }} className="df-col-full-mobile">
            <Panel
              title="COLUMN SET PARTITIONING"
              subtitle={`${comparison.base_version.version_label} vs ${comparison.compared_version.version_label} schema breakdown`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: 'rgba(184, 255, 98, 0.05)',
                    border: '1px solid rgba(184, 255, 98, 0.22)',
                  }}
                >
                  <div
                    className="df-card-label"
                    style={{ color: 'var(--accent-lime)', marginBottom: 10 }}
                  >
                    SHARED INTERSECTION (A ∩ B) — {sharedCols.length} COLUMNS
                  </div>
                  {sharedCols.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Zero shared columns between selected versions.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {sharedCols.map((c) => (
                        <span
                          key={c}
                          className="df-mono"
                          style={{
                            padding: '4px 11px',
                            borderRadius: 'var(--radius-pill)',
                            background: 'rgba(184, 255, 98, 0.14)',
                            color: 'var(--accent-lime)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="df-card-label" style={{ color: '#FFF', marginBottom: 8 }}>
                      ONLY IN TARGET B ({comparison.compared_version.version_label}) —{' '}
                      {addedCols.length}
                    </div>
                    {addedCols.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {addedCols.map((c) => (
                          <span
                            key={c}
                            className="df-mono"
                            style={{
                              padding: '3px 9px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'rgba(255,255,255,0.08)',
                              color: '#FFF',
                              fontSize: '0.74rem',
                            }}
                          >
                            + {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      background: 'rgba(255, 158, 39, 0.05)',
                      border: '1px solid rgba(255, 158, 39, 0.22)',
                    }}
                  >
                    <div
                      className="df-card-label"
                      style={{ color: 'var(--accent-amber)', marginBottom: 8 }}
                    >
                      ONLY IN BASE A ({comparison.base_version.version_label}) —{' '}
                      {removedCols.length}
                    </div>
                    {removedCols.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {removedCols.map((c) => (
                          <span
                            key={c}
                            className="df-mono"
                            style={{
                              padding: '3px 9px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'rgba(255, 158, 39, 0.15)',
                              color: 'var(--accent-amber)',
                              fontSize: '0.74rem',
                            }}
                          >
                            − {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
};
