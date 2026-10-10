import React, { useEffect, useState } from 'react';
import {
  Database,
  GitBranch,
  Table,
  GitFork,
  Plus,
  ArrowRight,
  Sparkles,
  TrendingDown
} from 'lucide-react';
import { api } from '../api/client';
import type {
  Dataset,
  DatasetVersion,
  DatasetColumn,
  DatasetSimilarity,
  VersionLineage
} from '../types';
import { LoadingSpinner, ErrorState, Modal, ToastNotification } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface DatasetDetailPageProps {
  datasetId: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const DatasetDetailPage: React.FC<DatasetDetailPageProps> = ({ datasetId, onNavigate }) => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'versions' | 'schema' | 'drift' | 'lineage'>('overview');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [columns, setColumns] = useState<DatasetColumn[]>([]);

  // Similarity & Drift State
  const [compareVersionId, setCompareVersionId] = useState<string>('');
  const [similarityResult, setSimilarityResult] = useState<DatasetSimilarity | null>(null);
  const [driftResult, setDriftResult] = useState<DatasetSimilarity | null>(null);
  const [analyzingDrift, setAnalyzingDrift] = useState(false);

  // Lineage State
  const [lineageTree, setLineageTree] = useState<VersionLineage | null>(null);

  // New Version Modal
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [newCommitMessage, setNewCommitMessage] = useState('');
  const [submittingVersion, setSubmittingVersion] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchDatasetDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dsRes, verRes] = await Promise.all([
        api.getDataset(datasetId),
        api.getDatasetVersions(datasetId)
      ]);

      setDataset(dsRes);
      setVersions(verRes);
      if (verRes.length > 0) {
        const firstVer = verRes[0].id;
        setSelectedVersionId(firstVer);
        if (verRes.length > 1) {
          setCompareVersionId(verRes[1].id);
        }
        loadVersionColumns(firstVer);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  const loadVersionColumns = async (verId: string) => {
    try {
      const res = await api.getVersion(verId);
      setColumns(res.columns);
    } catch {
      // Ignored
    }
  };

  const loadVersionLineage = async (verId: string) => {
    try {
      const res = await api.getVersionLineage(verId);
      setLineageTree(res);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchDatasetDetails();
  }, [datasetId]);

  useEffect(() => {
    if (selectedVersionId) {
      loadVersionColumns(selectedVersionId);
      loadVersionLineage(selectedVersionId);
    }
  }, [selectedVersionId]);

  // Run Similarity & Drift Analysis
  const handleRunAnalysis = async () => {
    if (!selectedVersionId || !compareVersionId || selectedVersionId === compareVersionId) {
      setToast({ type: 'error', message: 'Please select two different versions to compare.' });
      return;
    }

    setAnalyzingDrift(true);
    try {
      const [simRes, driftRes] = await Promise.all([
        api.checkSimilarity({
          base_version_id: selectedVersionId,
          compared_version_id: compareVersionId
        }),
        api.calculateDrift({
          base_version_id: selectedVersionId,
          compared_version_id: compareVersionId
        })
      ]);

      setSimilarityResult(simRes);
      setDriftResult(driftRes);
      setToast({ type: 'success', message: 'Similarity and drift metrics computed successfully!' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Analysis calculation failed' });
    } finally {
      setAnalyzingDrift(false);
    }
  };

  // Submit New Dataset Version
  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionFile) {
      setToast({ type: 'error', message: 'Please select a CSV file.' });
      return;
    }

    setSubmittingVersion(true);
    try {
      const formData = new FormData();
      formData.append('file', newVersionFile);
      if (newVersionLabel.trim()) formData.append('version_label', newVersionLabel.trim());
      if (newCommitMessage.trim()) formData.append('commit_message', newCommitMessage.trim());
      if (selectedVersionId) formData.append('parent_version_id', selectedVersionId);

      const res = await api.createDatasetVersion(datasetId, formData);
      setToast({ type: 'success', message: `Version ${res.version.version_label} committed successfully!` });
      setIsVersionModalOpen(false);
      setNewVersionFile(null);
      setNewVersionLabel('');
      setNewCommitMessage('');
      await fetchDatasetDetails();
    } catch (err: any) {
      if (err.code === 'DUPLICATE_FILE') {
        setToast({ type: 'error', message: 'Duplicate file error: Identical SHA-256 hash already exists in this dataset.' });
      } else {
        setToast({ type: 'error', message: err.message || 'Error uploading file' });
      }
    } finally {
      setSubmittingVersion(false);
    }
  };

  if (loading) return <LoadingSpinner message="Retrieving dataset, version lineage, and schema metadata..." />;
  if (error || !dataset) return <ErrorState title="Dataset Load Failed" message={error || 'Dataset not found'} onRetry={fetchDatasetDetails} />;

  const formatBytes = (bytes: number | string) => {
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(b) || b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const selectedVersionObj = versions.find(v => v.id === selectedVersionId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(14, 165, 233, 0.1)',
              color: 'var(--accent-cyan)'
            }}>
              <Database size={20} />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {dataset.name}
            </h2>
            <span style={{
              fontSize: '12px',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--accent-cyan)',
              border: '1px solid var(--border)'
            }}>
              {dataset.type}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '720px' }}>
            {dataset.description || 'No description provided.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onNavigate('lineage', { datasetId })}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--accent-cyan)',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <GitFork size={16} />
            Explore Lineage Graph
          </button>
          <button
            onClick={() => setIsVersionModalOpen(true)}
            style={{
              backgroundColor: 'var(--accent-cyan)',
              color: '#FFFFFF',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus size={16} />
            Commit New Version
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '2px'
      }}>
        {[
          { id: 'overview', label: 'Version Overview', icon: Database },
          { id: 'versions', label: `Version History (${versions.length})`, icon: GitBranch },
          { id: 'schema', label: `Schema Columns (${columns.length})`, icon: Table },
          { id: 'drift', label: 'Drift & Similarity Analysis', icon: TrendingDown },
          { id: 'lineage', label: 'Ancestry Lineage Tree', icon: GitFork },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderBottom: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '14px',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          {/* Active Version Card */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={18} color="var(--accent-cyan)" />
              Active Version: {selectedVersionObj?.version_label || 'None'}
            </h3>

            {selectedVersionObj ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Row Count</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {selectedVersionObj.row_count} rows
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Column Count</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {selectedVersionObj.column_count} columns
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>File Size</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatBytes(selectedVersionObj.file_size_bytes)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>SHA-256 Checksum</span>
                  <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedVersionObj.checksum_sha256}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Commit Message</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {selectedVersionObj.commit_message || 'No commit message'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Committed On</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {new Date(selectedVersionObj.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No version selected.</div>
            )}
          </div>

          {/* Quick Version Selector */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Switch Inspected Version
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {versions.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVersionId(v.id)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: selectedVersionId === v.id ? 'var(--bg-card)' : 'transparent',
                    border: selectedVersionId === v.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <span style={{
                      fontWeight: 600,
                      color: selectedVersionId === v.id ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '13px'
                    }}>
                      {v.version_label}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>
                      ({v.row_count} rows)
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(v.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Version History */}
      {activeTab === 'versions' && (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '14px 20px' }}>Version</th>
                <th style={{ padding: '14px 16px' }}>Rows</th>
                <th style={{ padding: '14px 16px' }}>Cols</th>
                <th style={{ padding: '14px 16px' }}>Size</th>
                <th style={{ padding: '14px 16px' }}>SHA-256 Checksum</th>
                <th style={{ padding: '14px 16px' }}>Commit Message</th>
                <th style={{ padding: '14px 20px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {versions.map(v => (
                <tr
                  key={v.id}
                  style={{
                    borderBottom: '1px solid rgba(36, 48, 68, 0.4)',
                    backgroundColor: selectedVersionId === v.id ? 'rgba(14, 165, 233, 0.05)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '14px 20px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                    {v.version_label}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {v.row_count}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                    {v.column_count}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                    {formatBytes(v.file_size_bytes)}
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {v.checksum_sha256.slice(0, 16)}...
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                    {v.commit_message || '—'}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Schema Columns */}
      {activeTab === 'schema' && (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '14px 20px' }}>Column Order</th>
                <th style={{ padding: '14px 20px' }}>Column Name</th>
                <th style={{ padding: '14px 20px' }}>Data Type</th>
                <th style={{ padding: '14px 20px' }}>Nullable</th>
                <th style={{ padding: '14px 20px' }}>Distinct Values</th>
                <th style={{ padding: '14px 20px' }}>Null Count</th>
              </tr>
            </thead>
            <tbody>
              {columns.map(col => (
                <tr key={col.id} style={{ borderBottom: '1px solid rgba(36, 48, 68, 0.4)' }}>
                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    #{col.ordinal_position}
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {col.column_name}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      color: 'var(--accent-cyan)',
                      backgroundColor: 'rgba(14, 165, 233, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      {col.data_type}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                    {col.is_nullable ? 'YES' : 'NO'}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {col.distinct_count ?? '—'}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {col.null_count ?? '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Drift & Similarity Analysis */}
      {activeTab === 'drift' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Version Comparison Selector Bar */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Source:</span>
              <select
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px'
                }}
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.version_label} ({v.row_count} rows)</option>
                ))}
              </select>
            </div>

            <ArrowRight size={16} color="var(--text-muted)" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Target:</span>
              <select
                value={compareVersionId}
                onChange={(e) => setCompareVersionId(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px'
                }}
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.version_label} ({v.row_count} rows)</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunAnalysis}
              disabled={analyzingDrift}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#FFFFFF',
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginLeft: 'auto'
              }}
            >
              <Sparkles size={16} />
              {analyzingDrift ? 'Executing PostgreSQL Analysis...' : 'Run Similarity & Drift'}
            </button>
          </div>

          {/* Results Display */}
          {(similarityResult || driftResult) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Similarity Card */}
              {similarityResult && (
                <div style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px'
                }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Jaccard Schema Similarity
                  </h4>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: 700,
                    color: 'var(--accent-emerald)',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginBottom: '8px'
                  }}>
                    {(Number(similarityResult.similarity_score) * 100).toFixed(1)}%
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Method: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{similarityResult.comparison_method}</span>
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                    Overlap: {similarityResult.column_overlap_count ?? '—'} columns
                  </p>
                </div>
              )}

              {/* Drift Card */}
              {driftResult && (
                <div style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px'
                }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Feature Distribution Drift
                  </h4>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: 700,
                    color: Number(driftResult.drift_score) > 0.3 ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginBottom: '8px'
                  }}>
                    {(Number(driftResult.drift_score) * 100).toFixed(1)}%
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Method: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{driftResult.comparison_method}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Ancestry Tree */}
      {activeTab === 'lineage' && (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            PostgreSQL Recursive Version Lineage
          </h4>
          {lineageTree ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <GitBranch size={20} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    Inspected Version: {selectedVersionObj?.version_label}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {selectedVersionObj?.checksum_sha256}
                  </div>
                </div>
              </div>

              <div>
                <h5 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Ancestry Path ({lineageTree.ancestry.length} ancestor versions):
                </h5>
                {lineageTree.ancestry.length > 0 ? (
                  lineageTree.ancestry.map((anc, idx) => (
                    <div key={idx} style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderLeft: '2px solid var(--accent-cyan)',
                      marginBottom: '8px',
                      fontSize: '13px'
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {anc.version_label}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '12px' }}>
                        Depth: {anc.depth} &bull; Checksum: {anc.checksum_sha256.slice(0, 12)}...
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>This is the root version (no ancestors).</div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Loading lineage ancestry...</div>
          )}
        </div>
      )}

      {/* Modal: Commit New Version */}
      <Modal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        title="Commit New Dataset Version"
      >
        <form onSubmit={handleCreateVersion} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              CSV File <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Version Label
            </label>
            <input
              type="text"
              placeholder={`e.g. v1.${versions.length}.0`}
              value={newVersionLabel}
              onChange={(e) => setNewVersionLabel(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Commit Message
            </label>
            <textarea
              rows={2}
              placeholder="What changes or transformations were applied?"
              value={newCommitMessage}
              onChange={(e) => setNewCommitMessage(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsVersionModalOpen(false)}
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
              disabled={submittingVersion}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                opacity: submittingVersion ? 0.7 : 1
              }}
            >
              {submittingVersion ? 'Uploading & Committing...' : 'Commit Version'}
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

