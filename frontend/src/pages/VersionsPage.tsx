import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  Dataset,
  DatasetVersion,
  VersionDetailResponse,
  VersionComparison,
  NavigationTab,
} from '../types';
import {
  PageHeader,
  Panel,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  StatusBadge,
  HashBadge,
  RingLegend,
  formatBytes,
  formatDateTime,
} from '../components/Common';
import {
  GitCommit,
  ArrowRight,
  Plus,
  Minus,
  Layers,
  GitFork,
  Activity,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';

interface VersionsPageProps {
  initialDatasetId?: string;
  initialBaseVersionId?: string;
  initialCompareVersionId?: string;
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

export const VersionsPage: React.FC<VersionsPageProps> = ({
  initialDatasetId,
  initialBaseVersionId,
  initialCompareVersionId,
  onNavigate,
}) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(initialDatasetId || '');
  const [versions, setVersions] = useState<DatasetVersion[]>([]);

  const [baseVersionId, setBaseVersionId] = useState<string>(initialBaseVersionId || '');
  const [compareVersionId, setCompareVersionId] = useState<string>(initialCompareVersionId || '');

  const [baseDetail, setBaseDetail] = useState<VersionDetailResponse | null>(null);
  const [compareDetail, setCompareDetail] = useState<VersionDetailResponse | null>(null);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);

  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDatasets = useCallback(async () => {
    setLoadingDatasets(true);
    setError(null);
    try {
      const list = await api.getDatasets({ sortBy: 'updated_at', sortOrder: 'DESC' });
      setDatasets(list || []);
      if (initialDatasetId && list.some((d) => d.id === initialDatasetId)) {
        setSelectedDatasetId(initialDatasetId);
      } else if (!selectedDatasetId && list.length > 0) {
        setSelectedDatasetId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets for version history');
    } finally {
      setLoadingDatasets(false);
    }
  }, [initialDatasetId, selectedDatasetId]);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    if (initialDatasetId && initialDatasetId !== selectedDatasetId) {
      setSelectedDatasetId(initialDatasetId);
    }
  }, [initialDatasetId, selectedDatasetId]);

  const loadVersions = useCallback(
    async (datasetId: string) => {
      if (!datasetId) return;
      setLoadingVersions(true);
      try {
        const vList = await api.getDatasetVersions(datasetId);
        setVersions(vList || []);

        if (vList.length >= 2) {
          const defaultCompare =
            initialCompareVersionId && vList.some((v) => v.id === initialCompareVersionId)
              ? initialCompareVersionId
              : vList[0].id;
          const defaultBase =
            initialBaseVersionId &&
            vList.some((v) => v.id === initialBaseVersionId) &&
            initialBaseVersionId !== defaultCompare
              ? initialBaseVersionId
              : vList[1].id;
          setBaseVersionId(defaultBase);
          setCompareVersionId(defaultCompare);
        } else if (vList.length === 1) {
          setBaseVersionId(vList[0].id);
          setCompareVersionId(vList[0].id);
          setComparison(null);
        } else {
          setBaseVersionId('');
          setCompareVersionId('');
          setComparison(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load dataset versions');
      } finally {
        setLoadingVersions(false);
      }
    },
    [initialBaseVersionId, initialCompareVersionId]
  );

  useEffect(() => {
    if (selectedDatasetId) {
      loadVersions(selectedDatasetId);
    }
  }, [selectedDatasetId, loadVersions]);

  const runComparison = useCallback(async (bId: string, cId: string) => {
    if (!bId || !cId) return;
    setLoadingDiff(true);
    try {
      const [bRes, cRes] = await Promise.all([
        api.getVersion(bId),
        bId === cId ? Promise.resolve(null) : api.getVersion(cId),
      ]);
      setBaseDetail(bRes);
      setCompareDetail(bId === cId ? bRes : cRes);

      if (bId !== cId) {
        const diffRes = await api.compareVersions(bId, cId);
        setComparison(diffRes);
      } else {
        setComparison(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to compare versions');
    } finally {
      setLoadingDiff(false);
    }
  }, []);

  useEffect(() => {
    if (baseVersionId && compareVersionId) {
      runComparison(baseVersionId, compareVersionId);
    }
  }, [baseVersionId, compareVersionId, runComparison]);

  if (loadingDatasets && datasets.length === 0) {
    return <LoadingSpinner message="Loading dataset version explorer..." />;
  }

  if (error && datasets.length === 0) {
    return <ErrorState message={error} onRetry={loadDatasets} />;
  }

  const currentDataset = datasets.find((d) => d.id === selectedDatasetId);

  return (
    <div>
      <PageHeader
        eyebrow="SIGNATURE MODULE · IMMUTABLE VERSIONING & SCHEMA DIFF"
        title="VERSION HISTORY & COMPARISON"
        subtitle="Inspect chronological version chains, parent-child derivations, SHA-256 checksums, and side-by-side schema diffs."
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="df-select"
              style={{ width: 240, borderRadius: 'var(--radius-pill)' }}
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              aria-label="Select Dataset"
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.total_versions || 0}v)
                </option>
              ))}
            </select>
            {selectedDatasetId && (
              <>
                <button
                  type="button"
                  className="df-btn df-btn--secondary"
                  onClick={() => onNavigate('dataset-detail', { datasetId: selectedDatasetId })}
                >
                  <FileSpreadsheet size={13} /> Dataset Inspector
                </button>
                <button
                  type="button"
                  className="df-btn df-btn--primary"
                  onClick={() => onNavigate('register-dataset', { datasetId: selectedDatasetId })}
                >
                  <Upload size={13} /> Commit Version
                </button>
              </>
            )}
          </div>
        }
      />

      {datasets.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<GitCommit size={24} />}
            title="No Datasets Registered"
            description="Register a dataset first to inspect version chains and compare structural schema shifts."
            actionLabel="Register Dataset"
            onAction={() => onNavigate('register-dataset')}
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
          {/* Left 4 cols: Visual Chronological Version Chain */}
          <div style={{ gridColumn: 'span 4' }} className="df-col-full-mobile">
            <Panel
              title="VERSION LINEAGE CHAIN"
              subtitle={`${currentDataset?.name || 'Dataset'} · ${versions.length} immutable commits`}
              rightSlot={<RingLegend label="ACTIVE DIFF" color="lime" />}
            >
              {loadingVersions ? (
                <LoadingSpinner message="Loading version history..." />
              ) : versions.length === 0 ? (
                <EmptyState
                  icon={<GitCommit size={22} />}
                  title="No Versions Found"
                  description="Commit a CSV file to generate version v1.0.0."
                />
              ) : (
                <div
                  style={{
                    position: 'relative',
                    paddingLeft: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 7,
                      top: 16,
                      bottom: 16,
                      width: 2,
                      background:
                        'linear-gradient(180deg, var(--accent-lime), var(--accent-amber), rgba(255,255,255,0.12))',
                    }}
                  />

                  {versions.map((ver, idx) => {
                    const isBase = ver.id === baseVersionId;
                    const isCompare = ver.id === compareVersionId;
                    const parentVer = versions.find((v) => v.id === ver.parent_version_id);

                    return (
                      <div
                        key={ver.id}
                        style={{
                          position: 'relative',
                          padding: '14px 16px',
                          borderRadius: 16,
                          background:
                            isBase || isCompare
                              ? 'rgba(184, 255, 98, 0.06)'
                              : 'var(--bg-elevated)',
                          border: isCompare
                            ? '1px solid rgba(184, 255, 98, 0.45)'
                            : isBase
                              ? '1px solid rgba(255, 158, 39, 0.45)'
                              : '1px solid var(--border-subtle)',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            left: -18,
                            top: 20,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#090A09',
                            border: `2.5px solid ${
                              isCompare
                                ? 'var(--accent-lime)'
                                : isBase
                                  ? 'var(--accent-amber)'
                                  : '#6D716D'
                            }`,
                          }}
                        />

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              className="df-mono"
                              style={{
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                color: isCompare
                                  ? 'var(--accent-lime)'
                                  : isBase
                                    ? 'var(--accent-amber)'
                                    : '#FFF',
                              }}
                            >
                              {ver.version_label}
                            </span>
                            {idx === 0 && <StatusBadge status="LATEST" size="sm" />}
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => setBaseVersionId(ver.id)}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                fontSize: '0.66rem',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                border: isBase
                                  ? '1px solid var(--accent-amber)'
                                  : '1px solid var(--border-subtle)',
                                background: isBase ? 'var(--accent-amber)' : 'transparent',
                                color: isBase ? '#090A09' : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                              title="Select as Base Version (A)"
                            >
                              BASE A
                            </button>
                            <button
                              type="button"
                              onClick={() => setCompareVersionId(ver.id)}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                fontSize: '0.66rem',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                border: isCompare
                                  ? '1px solid var(--accent-lime)'
                                  : '1px solid var(--border-subtle)',
                                background: isCompare ? 'var(--accent-lime)' : 'transparent',
                                color: isCompare ? '#090A09' : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                              title="Select as Target Version (B)"
                            >
                              TARGET B
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            marginBottom: 8,
                          }}
                        >
                          {ver.commit_message || 'Dataset version snapshot'}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          <span
                            className="df-mono"
                            style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
                          >
                            {Number(ver.row_count || 0).toLocaleString()} rows ·{' '}
                            {ver.column_count || 0} cols · {formatBytes(ver.file_size_bytes)}
                          </span>
                          <HashBadge hash={ver.checksum_sha256} prefix="SHA" />
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 6,
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.68rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <span>v#{ver.version_number}</span>
                          <span className="df-mono">{formatDateTime(ver.created_at)}</span>
                        </div>

                        {parentVer && (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: '0.68rem',
                              color: 'var(--accent-amber)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            ↳ parent: {parentVer.version_label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          {/* Right 8 cols: Version Comparison & Schema Diff */}
          <div
            style={{
              gridColumn: 'span 8',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            className="df-col-full-mobile"
          >
            <Panel>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    flex: 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div className="df-label" style={{ color: 'var(--accent-amber)' }}>
                      BASE VERSION (A)
                    </div>
                    <select
                      className="df-select"
                      value={baseVersionId}
                      onChange={(e) => setBaseVersionId(e.target.value)}
                      aria-label="Base Version A"
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.version_label} — {Number(v.row_count || 0).toLocaleString()} rows (
                          {v.column_count} cols)
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
                      marginTop: 18,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <ArrowRight size={16} />
                  </div>

                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div className="df-label" style={{ color: 'var(--accent-lime)' }}>
                      TARGET VERSION (B)
                    </div>
                    <select
                      className="df-select"
                      value={compareVersionId}
                      onChange={(e) => setCompareVersionId(e.target.value)}
                      aria-label="Target Version B"
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.version_label} — {Number(v.row_count || 0).toLocaleString()} rows (
                          {v.column_count} cols)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {baseVersionId && compareVersionId && baseVersionId !== compareVersionId && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
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
                      <Activity size={13} /> Statistical Drift
                    </button>
                    <button
                      type="button"
                      className="df-btn df-btn--secondary"
                      onClick={() =>
                        onNavigate('lineage', {
                          datasetId: selectedDatasetId,
                        })
                      }
                    >
                      <GitFork size={13} /> Lineage Graph
                    </button>
                  </div>
                )}
              </div>
            </Panel>

            {loadingDiff ? (
              <LoadingSpinner message="Computing structural and schema comparison..." />
            ) : baseVersionId === compareVersionId && baseDetail ? (
              <Panel
                title={`SINGLE VERSION SNAPSHOT — ${baseDetail.version.version_label}`}
                subtitle="Select two different versions in the left chain or dropdowns above to compute a structural diff."
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-elevated)' }}>
                    <div className="df-card-label">ROW COUNT</div>
                    <div className="df-stat-number df-stat-number--sm" style={{ marginTop: 4 }}>
                      {Number(baseDetail.version.row_count || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-elevated)' }}>
                    <div className="df-card-label">COLUMN COUNT</div>
                    <div
                      className="df-stat-number df-stat-number--sm"
                      style={{ marginTop: 4, color: 'var(--accent-lime)' }}
                    >
                      {baseDetail.version.column_count || 0}
                    </div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-elevated)' }}>
                    <div className="df-card-label">FILE SIZE</div>
                    <div className="df-stat-number df-stat-number--sm" style={{ marginTop: 4 }}>
                      {formatBytes(baseDetail.version.file_size_bytes)}
                    </div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-elevated)' }}>
                    <div className="df-card-label">SHA-256 HASH</div>
                    <div style={{ marginTop: 8 }}>
                      <HashBadge hash={baseDetail.version.checksum_sha256} />
                    </div>
                  </div>
                </div>

                {baseDetail.columns && baseDetail.columns.length > 0 && (
                  <div className="df-table-wrapper">
                    <table className="df-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>COLUMN</th>
                          <th>DATA TYPE</th>
                          <th>DISTINCT</th>
                          <th>NULLS</th>
                          <th>NULLABLE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {baseDetail.columns.map((c) => (
                          <tr key={c.id}>
                            <td className="df-mono">{c.ordinal_position}</td>
                            <td className="df-mono" style={{ color: '#FFF', fontWeight: 600 }}>
                              {c.column_name}
                            </td>
                            <td>
                              <StatusBadge status={c.data_type} size="sm" />
                            </td>
                            <td className="df-mono">{c.distinct_count ?? '—'}</td>
                            <td className="df-mono">{c.null_count ?? '—'}</td>
                            <td className="df-mono">{c.is_nullable ? 'YES' : 'NO'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            ) : comparison && baseDetail && compareDetail ? (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 12,
                  }}
                >
                  <Panel>
                    <div className="df-card-label">JACCARD SCHEMA SIMILARITY</div>
                    <div
                      className="df-stat-number df-stat-number--md"
                      style={{
                        marginTop: 6,
                        color:
                          comparison.jaccard_similarity >= 0.8
                            ? 'var(--accent-lime)'
                            : 'var(--accent-amber)',
                      }}
                    >
                      {(comparison.jaccard_similarity * 100).toFixed(1)}%
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {comparison.shared_columns.length} shared columns
                    </div>
                  </Panel>

                  <Panel>
                    <div className="df-card-label">ROW DELTA (B − A)</div>
                    <div
                      className="df-stat-number df-stat-number--md"
                      style={{
                        marginTop: 6,
                        color:
                          comparison.row_count_diff > 0
                            ? 'var(--accent-lime)'
                            : comparison.row_count_diff < 0
                              ? 'var(--accent-amber)'
                              : '#FFF',
                      }}
                    >
                      {comparison.row_count_diff > 0 ? '+' : ''}
                      {comparison.row_count_diff.toLocaleString()}
                    </div>
                    <div
                      className="df-mono"
                      style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}
                    >
                      {Number(baseDetail.version.row_count || 0).toLocaleString()} →{' '}
                      {Number(compareDetail.version.row_count || 0).toLocaleString()}
                    </div>
                  </Panel>

                  <Panel>
                    <div className="df-card-label">BYTE DELTA (B − A)</div>
                    <div className="df-stat-number df-stat-number--md" style={{ marginTop: 6 }}>
                      {comparison.file_size_diff_bytes > 0 ? '+' : ''}
                      {formatBytes(Math.abs(comparison.file_size_diff_bytes))}
                    </div>
                    <div
                      className="df-mono"
                      style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}
                    >
                      {formatBytes(baseDetail.version.file_size_bytes)} →{' '}
                      {formatBytes(compareDetail.version.file_size_bytes)}
                    </div>
                  </Panel>

                  <Panel>
                    <div className="df-card-label">BINARY INTEGRITY</div>
                    <div style={{ marginTop: 10 }}>
                      <StatusBadge
                        status={comparison.exact_checksum_match ? 'EXACT_MATCH' : 'MODIFIED'}
                      />
                    </div>
                    <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {comparison.exact_checksum_match
                        ? 'Identical SHA-256 payload'
                        : 'Distinct SHA-256 content hashes'}
                    </div>
                  </Panel>
                </div>

                <Panel
                  title={`SCHEMA DIFF: ${comparison.base_version.version_label} → ${comparison.compared_version.version_label}`}
                  subtitle="Column additions, removals, and retained intersections"
                  rightSlot={
                    <div style={{ display: 'flex', gap: 14 }}>
                      <RingLegend
                        label={`ADDED (+${comparison.added_columns.length})`}
                        color="lime"
                      />
                      <RingLegend
                        label={`REMOVED (-${comparison.removed_columns.length})`}
                        color="amber"
                      />
                      <RingLegend
                        label={`SHARED (${comparison.shared_columns.length})`}
                        color="white"
                      />
                    </div>
                  }
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 12,
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        background: 'rgba(184, 255, 98, 0.05)',
                        border: '1px solid rgba(184, 255, 98, 0.22)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        <Plus size={14} color="var(--accent-lime)" />
                        <span
                          className="df-mono"
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: 'var(--accent-lime)',
                          }}
                        >
                          ADDED IN {comparison.compared_version.version_label} (
                          {comparison.added_columns.length})
                        </span>
                      </div>
                      {comparison.added_columns.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          No added columns
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {comparison.added_columns.map((col) => (
                            <span
                              key={col}
                              className="df-mono"
                              style={{
                                padding: '3px 9px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(184, 255, 98, 0.14)',
                                color: 'var(--accent-lime)',
                                fontSize: '0.74rem',
                              }}
                            >
                              + {col}
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
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        <Minus size={14} color="var(--accent-amber)" />
                        <span
                          className="df-mono"
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: 'var(--accent-amber)',
                          }}
                        >
                          REMOVED FROM {comparison.base_version.version_label} (
                          {comparison.removed_columns.length})
                        </span>
                      </div>
                      {comparison.removed_columns.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          No removed columns
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {comparison.removed_columns.map((col) => (
                            <span
                              key={col}
                              className="df-mono"
                              style={{
                                padding: '3px 9px',
                                borderRadius: 'var(--radius-pill)',
                                background: 'rgba(255, 158, 39, 0.14)',
                                color: 'var(--accent-amber)',
                                fontSize: '0.74rem',
                              }}
                            >
                              − {col}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        <Layers size={14} color="#F4F5F4" />
                        <span
                          className="df-mono"
                          style={{ fontSize: '0.74rem', fontWeight: 700, color: '#F4F5F4' }}
                        >
                          SHARED INTERSECTION ({comparison.shared_columns.length})
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {comparison.shared_columns.map((col) => (
                          <span
                            key={col}
                            className="df-mono"
                            style={{
                              padding: '3px 9px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'rgba(255,255,255,0.06)',
                              color: 'var(--text-primary)',
                              fontSize: '0.74rem',
                            }}
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Side-by-Side Column Profile Table */}
                  <div className="df-table-wrapper">
                    <table className="df-table">
                      <thead>
                        <tr>
                          <th>COLUMN NAME</th>
                          <th>STATUS</th>
                          <th>TYPE ({baseDetail.version.version_label})</th>
                          <th>TYPE ({compareDetail.version.version_label})</th>
                          <th>
                            NULLS ({baseDetail.version.version_label} →{' '}
                            {compareDetail.version.version_label})
                          </th>
                          <th>
                            DISTINCT ({baseDetail.version.version_label} →{' '}
                            {compareDetail.version.version_label})
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(
                          new Set([
                            ...(baseDetail.columns || []).map((c) => c.column_name),
                            ...(compareDetail.columns || []).map((c) => c.column_name),
                          ])
                        ).map((colName) => {
                          const bCol = baseDetail.columns?.find((c) => c.column_name === colName);
                          const cCol = compareDetail.columns?.find(
                            (c) => c.column_name === colName
                          );
                          const diffState =
                            bCol && cCol ? 'SHARED' : cCol ? 'ADDED' : 'REMOVED';

                          return (
                            <tr key={colName}>
                              <td className="df-mono" style={{ fontWeight: 600, color: '#FFF' }}>
                                {colName}
                              </td>
                              <td>
                                <StatusBadge status={diffState} size="sm" />
                              </td>
                              <td className="df-mono">{bCol ? bCol.data_type : '—'}</td>
                              <td className="df-mono">{cCol ? cCol.data_type : '—'}</td>
                              <td className="df-mono">
                                {bCol?.null_count ?? '—'} → {cCol?.null_count ?? '—'}
                              </td>
                              <td className="df-mono">
                                {bCol?.distinct_count ?? '—'} → {cCol?.distinct_count ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
