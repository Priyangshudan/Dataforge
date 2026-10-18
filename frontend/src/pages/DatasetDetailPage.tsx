import React, { useEffect, useState } from 'react';
import {
  Database,
  GitBranch,
  GitFork,
  GitCompare,
  Plus,
  Edit3,
  ArrowLeft,
  ArrowUpRight,
  Brain,
  FlaskConical,
  Sparkles,
  Activity,
  Check,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  Dataset,
  DatasetVersion,
  DatasetColumn,
  VersionLineage,
  NavigationTab,
} from '../types';
import {
  LoadingSpinner,
  ErrorState,
  EmptyState,
  Modal,
  ToastNotification,
  PageHeader,
  Panel,
  StatusBadge,
  HashBadge,
  DeltaStat,
  formatBytes,
  formatDateTime,
} from '../components/Common';

interface DatasetDetailPageProps {
  datasetId: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const DatasetDetailPage: React.FC<DatasetDetailPageProps> = ({
  datasetId,
  onNavigate,
}) => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [versionLineage, setVersionLineage] = useState<VersionLineage | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Dataset Metadata State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('Active');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Commit New Version Modal
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [newCommitMessage, setNewCommitMessage] = useState('');
  const [submittingVersion, setSubmittingVersion] = useState(false);

  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const fetchDatasetDetails = async () => {
    if (!datasetId) {
      // Fallback: load first available dataset if navigated without datasetId
      try {
        const list = await api.getDatasets({ limit: 1 });
        if (list.length > 0) {
          loadSpecificDataset(list[0].id);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load dataset');
        setLoading(false);
      }
      return;
    }
    await loadSpecificDataset(datasetId);
  };

  const loadSpecificDataset = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [dsRes, verRes] = await Promise.all([
        api.getDataset(id),
        api.getDatasetVersions(id),
      ]);
      setDataset(dsRes);
      setEditName(dsRes.name);
      setEditDesc(dsRes.description || '');
      setEditStatus(dsRes.status || 'Active');
      setEditTags((dsRes.tags || []).join(', '));
      setVersions(verRes);

      if (verRes.length > 0) {
        const firstVerId = verRes[0].id;
        setSelectedVersionId(firstVerId);
        await loadVersionContext(firstVerId);
      } else {
        setSelectedVersionId('');
        setColumns([]);
        setVersionLineage(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset details from backend');
    } finally {
      setLoading(false);
    }
  };

  const loadVersionContext = async (verId: string) => {
    try {
      const [verDetail, linRes] = await Promise.all([
        api.getVersion(verId),
        api.getVersionLineage(verId),
      ]);
      setColumns(verDetail.columns || []);
      setVersionLineage(linRes);
    } catch {
      // Non-fatal if columns/lineage empty
    }
  };

  useEffect(() => {
    fetchDatasetDetails();
  }, [datasetId]);

  const handleSelectVersion = (verId: string) => {
    setSelectedVersionId(verId);
    loadVersionContext(verId);
  };

  const handleSaveDatasetEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataset || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const tagsArr = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const updated = await api.updateDataset(dataset.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        status: editStatus,
        tags: tagsArr,
      });
      setDataset({ ...dataset, ...updated });
      setIsEditing(false);
      setToast({ type: 'success', message: 'Dataset metadata updated in PostgreSQL.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to update dataset' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataset || !newVersionFile) {
      setToast({ type: 'error', message: 'Please select a CSV file to upload.' });
      return;
    }

    setSubmittingVersion(true);
    try {
      const formData = new FormData();
      formData.append('file', newVersionFile);
      if (newVersionLabel.trim()) formData.append('version_label', newVersionLabel.trim());
      if (newCommitMessage.trim()) formData.append('commit_message', newCommitMessage.trim());
      if (selectedVersionId) formData.append('parent_version_id', selectedVersionId);

      const res = await api.createDatasetVersion(dataset.id, formData);
      setToast({
        type: 'success',
        message: `Version ${res.version.version_label} committed and verified!`,
      });
      setIsVersionModalOpen(false);
      setNewVersionFile(null);
      setNewVersionLabel('');
      setNewCommitMessage('');
      await loadSpecificDataset(dataset.id);
    } catch (err: any) {
      setToast({
        type: 'error',
        message:
          err.code === 'DUPLICATE_FILE'
            ? 'Rejected: Exact duplicate SHA-256 checksum already exists in this dataset.'
            : err.message || 'Failed to commit version',
      });
    } finally {
      setSubmittingVersion(false);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner message="Loading dataset metadata, version history, and column statistics..." />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Dataset Inspection Failed"
        message={error}
        onRetry={fetchDatasetDetails}
      />
    );
  }

  if (!dataset) {
    return (
      <EmptyState
        title="No Dataset Selected"
        description="Select a dataset from the catalog or register a new CSV dataset."
        actionText="Browse Dataset Catalog"
        onAction={() => onNavigate('datasets')}
        icon={<Database size={28} />}
      />
    );
  }

  const activeVersion = versions.find((v) => v.id === selectedVersionId) || versions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title={dataset.name}
        badge={dataset.type || 'TABULAR'}
        subtitle={dataset.description || 'No description provided for this dataset.'}
        actions={
          <>
            <button
              type="button"
              onClick={() => onNavigate('datasets')}
              className="df-btn df-btn-secondary"
            >
              <ArrowLeft size={14} /> Catalog
            </button>
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="df-btn df-btn-secondary"
            >
              <Edit3 size={14} /> {isEditing ? 'Cancel Edit' : 'Edit Metadata'}
            </button>
            <button
              type="button"
              onClick={() =>
                onNavigate('versions', {
                  datasetId: dataset.id,
                  versionId: selectedVersionId,
                })
              }
              className="df-btn df-btn-secondary"
            >
              <GitCompare size={14} /> Version Diff
            </button>
            <button
              type="button"
              onClick={() => onNavigate('lineage', { datasetId: dataset.id })}
              className="df-btn df-btn-secondary"
            >
              <GitFork size={14} /> Lineage DAG
            </button>
            <button
              type="button"
              onClick={() => setIsVersionModalOpen(true)}
              className="df-btn df-btn-lime"
            >
              <Plus size={15} /> Commit New Version
            </button>
          </>
        }
      />

      {/* Inline Metadata Edit Panel */}
      {isEditing && (
        <Panel title="EDIT DATASET METADATA">
          <form
            onSubmit={handleSaveDatasetEdit}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div className="df-subgrid-2">
              <div>
                <label className="df-label">Dataset Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="df-input"
                  required
                />
              </div>
              <div>
                <label className="df-label">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="df-select"
                >
                  <option value="Active">Active</option>
                  <option value="Validated">Validated</option>
                  <option value="Deprecated">Deprecated</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>
            <div>
              <label className="df-label">Description</label>
              <textarea
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="df-textarea"
              />
            </div>
            <div>
              <label className="df-label">Tags (comma-separated)</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="df-input"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="df-btn df-btn-secondary"
              >
                <X size={14} /> Cancel
              </button>
              <button type="submit" disabled={savingEdit} className="df-btn df-btn-lime">
                <Check size={14} /> {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Top Asymmetric Summary Row */}
      <div className="df-dashboard-grid">
        {/* Left: Active Version Cryptographic & Structural Identity */}
        <Panel
          title={
            activeVersion
              ? `INSPECTED VERSION: ${activeVersion.version_label}`
              : 'NO VERSIONS COMMITTED'
          }
          subtitle="Immutable content-addressed version record and SHA-256 fingerprint"
          rightSlot={<StatusBadge status={dataset.status || 'Active'} />}
        >
          {activeVersion ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <DeltaStat
                  direction="up"
                  accent="lime"
                  value={Number(activeVersion.row_count || 0).toLocaleString()}
                  label="Row Count"
                  sublabel={activeVersion.file_name}
                />
                <DeltaStat
                  direction="up"
                  accent="white"
                  value={activeVersion.column_count}
                  label="Schema Columns"
                  sublabel={`#${activeVersion.version_number} in chain`}
                />
                <DeltaStat
                  direction="down"
                  accent="amber"
                  value={formatBytes(activeVersion.file_size_bytes)}
                  label="Version Size"
                  sublabel={formatBytes(dataset.total_storage_bytes) + ' total'}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '12.5px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    SHA-256 Checksum
                  </span>
                  <HashBadge hash={activeVersion.checksum_sha256} chars={20} />
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Schema Fingerprint
                  </span>
                  <HashBadge hash={activeVersion.schema_fingerprint} chars={16} />
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Associated Project
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('projects', { projectId: dataset.project_id })}
                    style={{
                      color: 'var(--accent-lime)',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {dataset.project_name || 'Inspect Project'} <ArrowUpRight size={13} />
                  </button>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Committed At
                  </span>
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {formatDateTime(activeVersion.created_at)}
                  </span>
                </div>
              </div>

              {activeVersion.commit_message && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>Commit Note:</strong>{' '}
                  {activeVersion.commit_message}
                </div>
              )}

              {/* Quick Analysis Shortcuts for this Version */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('similarity', {
                      datasetId: dataset.id,
                      baseVersionId: activeVersion.id,
                    })
                  }
                  className="df-btn df-btn-secondary"
                  style={{ fontSize: '12px', padding: '7px 14px' }}
                >
                  <Sparkles size={13} color="var(--accent-lime)" /> Run Similarity Check
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('drift', {
                      datasetId: dataset.id,
                      baseVersionId: activeVersion.id,
                    })
                  }
                  className="df-btn df-btn-secondary"
                  style={{ fontSize: '12px', padding: '7px 14px' }}
                >
                  <Activity size={13} color="var(--accent-amber)" /> Run Statistical Drift
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Versions Committed"
              description="Upload a CSV file to create v1.0.0 of this dataset."
              actionText="Commit Version v1.0.0"
              onAction={() => setIsVersionModalOpen(true)}
            />
          )}
        </Panel>

        {/* Right: Version History Selector & Connected Models / Experiments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <Panel
            title={`VERSION TIMELINE (${versions.length})`}
            subtitle="Select any version checkpoint to inspect its schema and downstream models"
            rightSlot={
              <button
                type="button"
                onClick={() =>
                  onNavigate('versions', {
                    datasetId: dataset.id,
                    versionId: selectedVersionId,
                  })
                }
                className="df-btn-ghost"
                style={{ fontSize: '12px', borderRadius: '999px' }}
              >
                Compare Diff <ArrowUpRight size={13} />
              </button>
            }
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              {versions.map((v) => {
                const isSelected = v.id === selectedVersionId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVersion(v.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 14px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: isSelected
                        ? 'var(--accent-lime)'
                        : 'var(--bg-card)',
                      color: isSelected
                        ? 'var(--text-on-accent)'
                        : 'var(--text-primary)',
                      border: `1px solid ${
                        isSelected ? 'var(--accent-lime)' : 'var(--border-subtle)'
                      }`,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <GitBranch size={15} />
                      <span className="font-mono" style={{ fontWeight: 700, fontSize: '13px' }}>
                        {v.version_label}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          opacity: isSelected ? 0.85 : 0.65,
                        }}
                      >
                        {Number(v.row_count).toLocaleString()} rows &bull; {v.column_count} cols
                      </span>
                    </div>
                    <span
                      className="font-mono"
                      style={{ fontSize: '11px', opacity: isSelected ? 0.9 : 0.6 }}
                    >
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Connected Models & Experiments for Selected Version */}
          <Panel
            title="CONNECTED MODELS & EXPERIMENTS"
            subtitle="Downstream ML artifacts trained or evaluated on the selected version"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: '14px',
                    color: 'var(--accent-lime)',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Brain size={14} /> TRAINED MODELS (
                  {versionLineage?.trained_models?.length || 0})
                </div>
                {versionLineage?.trained_models &&
                versionLineage.trained_models.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {versionLineage.trained_models.map((tm) => (
                      <button
                        key={tm.id}
                        type="button"
                        onClick={() => onNavigate('models')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          textAlign: 'left',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{tm.model_name}</div>
                        <div className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {tm.version} &bull; {tm.algorithm}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No model versions linked to this dataset version yet.
                  </div>
                )}
              </div>

              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: '14px',
                    color: 'var(--accent-amber)',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FlaskConical size={14} /> EXPERIMENTS (
                  {versionLineage?.experiments?.length || 0})
                </div>
                {versionLineage?.experiments && versionLineage.experiments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {versionLineage.experiments.map((exp) => (
                      <button
                        key={exp.id}
                        type="button"
                        onClick={() =>
                          onNavigate('experiments', { experimentId: exp.id })
                        }
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          textAlign: 'left',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{exp.name}</div>
                        <div className="font-mono" style={{ color: 'var(--accent-lime)', fontSize: '11px' }}>
                          {exp.status}
                          {exp.accuracy !== undefined && exp.accuracy !== null
                            ? ` • ${(Number(exp.accuracy) * 100).toFixed(1)}% acc`
                            : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No experiments recorded for this version yet.
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* Bottom: Extracted Column Schema Profiler Table */}
      <Panel
        title={`EXTRACTED RELATIONAL SCHEMA (${columns.length} COLUMNS)`}
        subtitle="Column types, nullability, cardinality, and sample values extracted at commit time"
        flush
      >
        {columns.length === 0 ? (
          <div style={{ padding: '28px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No column schema records found for this version.
          </div>
        ) : (
          <div className="df-table-wrapper">
            <table className="df-table">
              <thead>
                <tr>
                  <th>Ordinal</th>
                  <th>Column Name</th>
                  <th>Data Type</th>
                  <th>Nullable</th>
                  <th>Distinct Count</th>
                  <th>Null Count</th>
                  <th>Sample Values</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.id}>
                    <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                      #{col.ordinal_position}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      {col.column_name}
                    </td>
                    <td>
                      <span
                        className="font-mono"
                        style={{
                          padding: '3px 9px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor:
                            col.data_type === 'NUMERIC' || col.data_type === 'INTEGER'
                              ? 'var(--accent-lime-dim)'
                              : 'var(--bg-card)',
                          color:
                            col.data_type === 'NUMERIC' || col.data_type === 'INTEGER'
                              ? 'var(--accent-lime)'
                              : 'var(--text-primary)',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {col.data_type}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '12px' }}>
                      {col.is_nullable ? (
                        <span style={{ color: 'var(--accent-amber)' }}>NULLABLE</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>NOT NULL</span>
                      )}
                    </td>
                    <td className="font-mono">{col.distinct_count ?? '—'}</td>
                    <td className="font-mono">{col.null_count ?? 0}</td>
                    <td
                      className="font-mono"
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--text-secondary)',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {Array.isArray(col.sample_values) && col.sample_values.length > 0
                        ? col.sample_values.slice(0, 4).map(String).join(', ')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Modal: Commit New Dataset Version */}
      <Modal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        title="COMMIT NEW DATASET VERSION"
        subtitle={`Upload a CSV file to create a new version derived from ${
          activeVersion?.version_label || 'root'
        }`}
      >
        <form
          onSubmit={handleCreateVersion}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div>
            <label className="df-label">CSV File *</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
              required
              className="df-input"
            />
          </div>
          <div>
            <label className="df-label">Version Label</label>
            <input
              type="text"
              placeholder={`e.g. v${versions.length + 1}.0.0`}
              value={newVersionLabel}
              onChange={(e) => setNewVersionLabel(e.target.value)}
              className="df-input font-mono"
            />
          </div>
          <div>
            <label className="df-label">Commit Message</label>
            <textarea
              rows={2}
              placeholder="Document what changed in this dataset version..."
              value={newCommitMessage}
              onChange={(e) => setNewCommitMessage(e.target.value)}
              className="df-textarea"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsVersionModalOpen(false)}
              className="df-btn df-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingVersion}
              className="df-btn df-btn-lime"
            >
              {submittingVersion ? 'Uploading & Hashing...' : 'Commit Version'}
            </button>
          </div>
        </form>
      </Modal>

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
