import React, { useEffect, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Plus,
  ArrowLeft,
  ArrowUpRight,
  Database,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  Project,
  User,
  Dataset,
  DatasetVersion,
  VersionDetailResponse,
  NavigationTab,
} from '../types';
import {
  LoadingSpinner,
  ErrorState,
  ToastNotification,
  Modal,
  PageHeader,
  Panel,
  StatusBadge,
  HashBadge,
  formatBytes,
} from '../components/Common';

interface DatasetRegistrationPageProps {
  initialProjectId?: string;
  initialDatasetId?: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const DatasetRegistrationPage: React.FC<DatasetRegistrationPageProps> = ({
  initialProjectId,
  initialDatasetId,
  onNavigate,
}) => {
  const [mode, setMode] = useState<'new-dataset' | 'existing-dataset'>(
    initialDatasetId ? 'existing-dataset' : 'new-dataset'
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [existingDatasets, setExistingDatasets] = useState<Dataset[]>([]);
  const [existingVersions, setExistingVersions] = useState<DatasetVersion[]>([]);
  const [loadingPrereqs, setLoadingPrereqs] = useState(true);
  const [prereqError, setPrereqError] = useState<string | null>(null);

  // New Dataset Form Fields
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [datasetName, setDatasetName] = useState('');
  const [datasetDesc, setDatasetDesc] = useState('');
  const [datasetSource, setDatasetSource] = useState('MANUAL_UPLOAD');
  const [datasetType, setDatasetType] = useState('TABULAR');
  const [datasetTags, setDatasetTags] = useState('tabular, benchmark');

  // Existing Dataset Mode Fields
  const [targetDatasetId, setTargetDatasetId] = useState(initialDatasetId || '');
  const [parentVersionId, setParentVersionId] = useState('');

  // Version & File Upload Fields
  const [file, setFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('v1.0.0');
  const [commitMessage, setCommitMessage] = useState(
    'Initial CSV ingestion and schema extraction'
  );
  const [selectedUserId, setSelectedUserId] = useState('');

  // Client-Side CSV Inspection Preview
  const [filePreview, setFilePreview] = useState<{
    estimatedRows: number;
    headers: string[];
    sampleRows: string[][];
    inferredTypes: { name: string; type: string }[];
  } | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);

  // Submission & Confirmed Result State
  const [submitting, setSubmitting] = useState(false);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<{
    dataset: Dataset;
    versionDetail?: VersionDetailResponse;
  } | null>(null);
  const [submitError, setSubmitError] = useState<{
    code?: string;
    message: string;
  } | null>(null);

  // Quick Create Project Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const fetchPrereqs = async () => {
    setLoadingPrereqs(true);
    setPrereqError(null);
    try {
      const [projRes, usersRes, dsRes] = await Promise.all([
        api.getProjects(),
        api.getUsers(),
        api.getDatasets(),
      ]);
      setProjects(projRes);
      if (!selectedProjectId && projRes.length > 0) {
        setSelectedProjectId(projRes[0].id);
      }
      setUsers(usersRes);
      if (usersRes.length > 0) {
        setSelectedUserId(usersRes[0].id);
      }
      setExistingDatasets(dsRes);
      if (!targetDatasetId && dsRes.length > 0) {
        setTargetDatasetId(dsRes[0].id);
      }
    } catch (err: any) {
      setPrereqError(
        err.message || 'Unable to load workspace projects and users from backend'
      );
    } finally {
      setLoadingPrereqs(false);
    }
  };

  useEffect(() => {
    fetchPrereqs();
  }, []);

  // Load versions when existing dataset changes
  useEffect(() => {
    if (mode === 'existing-dataset' && targetDatasetId) {
      api
        .getDatasetVersions(targetDatasetId)
        .then((vers) => {
          setExistingVersions(vers);
          if (vers.length > 0) {
            setParentVersionId(vers[0].id);
            const nextNum = Number(vers[0].version_number || vers.length) + 1;
            setVersionLabel(`v${nextNum}.0.0`);
          } else {
            setParentVersionId('');
            setVersionLabel('v1.0.0');
          }
        })
        .catch(() => {
          setExistingVersions([]);
          setParentVersionId('');
        });
    }
  }, [mode, targetDatasetId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileValidationError(null);
    setSubmitError(null);
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setFilePreview(null);
      return;
    }

    if (!selected.name.toLowerCase().endsWith('.csv') && selected.type !== 'text/csv') {
      setFileValidationError('Only comma-separated values (.csv) files are accepted.');
      setFile(null);
      setFilePreview(null);
      return;
    }

    if (selected.size === 0) {
      setFileValidationError('The selected CSV file is empty (0 bytes).');
      setFile(null);
      setFilePreview(null);
      return;
    }

    setFile(selected);

    if (mode === 'new-dataset' && !datasetName.trim()) {
      const cleanName = selected.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ');
      setDatasetName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        setFileValidationError(
          'CSV file must include a header row and at least one data row.'
        );
        return;
      }

      const headers = lines[0]
        .split(',')
        .map((h) => h.trim().replace(/^"|"$/g, ''));
      const sampleRows = lines.slice(1, 6).map((line) =>
        line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      );

      const inferredTypes = headers.map((header, colIdx) => {
        let isNumeric = true;
        let isInteger = true;
        let isBoolean = true;
        for (const row of sampleRows) {
          const val = row[colIdx];
          if (val === undefined || val === '') continue;
          const lower = val.toLowerCase();
          if (lower !== 'true' && lower !== 'false') isBoolean = false;
          if (isNaN(Number(val))) {
            isNumeric = false;
            isInteger = false;
          } else if (!Number.isInteger(Number(val))) {
            isInteger = false;
          }
        }
        let type = 'TEXT';
        if (isBoolean) type = 'BOOLEAN';
        else if (isInteger) type = 'INTEGER';
        else if (isNumeric) type = 'NUMERIC';
        return { name: header, type };
      });

      setFilePreview({
        estimatedRows: lines.length - 1,
        headers,
        sampleRows,
        inferredTypes,
      });
    };
    reader.readAsText(selected.slice(0, 65536));
  };

  const handleQuickCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !selectedUserId) return;
    try {
      const res = await api.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
        owner_id: selectedUserId,
      });
      setProjects((prev) => [res, ...prev]);
      setSelectedProjectId(res.id);
      setIsProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setToast({
        type: 'success',
        message: `Project "${res.name}" created and selected.`,
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to create project',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setConfirmedResult(null);

    if (mode === 'new-dataset') {
      if (!selectedProjectId || !datasetName.trim()) {
        setSubmitError({
          message: 'Project and Dataset Name are required to register a dataset.',
        });
        return;
      }
    } else {
      if (!targetDatasetId || !file) {
        setSubmitError({
          message: 'Target Dataset and CSV file are required to commit a version.',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      let targetDataset: Dataset;

      if (mode === 'new-dataset') {
        setStageMessage('Step 1/2: Registering dataset record in PostgreSQL...');
        const tagsArray = datasetTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        targetDataset = await api.createDataset({
          project_id: selectedProjectId,
          name: datasetName.trim(),
          description: datasetDesc.trim() || undefined,
          source: datasetSource.trim() || 'MANUAL_UPLOAD',
          type: datasetType.trim() || 'TABULAR',
          tags: tagsArray,
          created_by: selectedUserId || undefined,
        });
      } else {
        targetDataset =
          existingDatasets.find((d) => d.id === targetDatasetId) ||
          (await api.getDataset(targetDatasetId));
      }

      let versionResponse: VersionDetailResponse | undefined;
      if (file) {
        setStageMessage(
          'Step 2/2: Uploading multipart CSV, verifying SHA-256 deduplication & profiling columns...'
        );
        const formData = new FormData();
        formData.append('file', file);
        if (versionLabel.trim()) formData.append('version_label', versionLabel.trim());
        if (commitMessage.trim()) formData.append('commit_message', commitMessage.trim());
        if (mode === 'existing-dataset' && parentVersionId) {
          formData.append('parent_version_id', parentVersionId);
        }
        if (selectedUserId) {
          formData.append('created_by', selectedUserId);
        }

        versionResponse = await api.createDatasetVersion(targetDataset.id, formData);
      }

      setConfirmedResult({
        dataset: targetDataset,
        versionDetail: versionResponse,
      });
      setToast({
        type: 'success',
        message: versionResponse
          ? `Dataset "${targetDataset.name}" (${versionResponse.version.version_label}) confirmed by PostgreSQL!`
          : `Dataset "${targetDataset.name}" registered in catalog!`,
      });
    } catch (err: any) {
      setSubmitError({
        code: err.code || 'UPLOAD_ERROR',
        message:
          err.code === 'DUPLICATE_FILE'
            ? `Exact duplicate CSV rejected by SHA-256 deduplication policy: ${err.message}`
            : err.message || 'Dataset registration or file upload failed.',
      });
    } finally {
      setSubmitting(false);
      setStageMessage(null);
    }
  };

  if (loadingPrereqs) {
    return <LoadingSpinner message="Loading workspace projects and user identities..." />;
  }

  if (prereqError) {
    return (
      <ErrorState
        title="Registration Prerequisites Unavailable"
        message={prereqError}
        onRetry={fetchPrereqs}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="DATASET REGISTRATION & CSV UPLOAD"
        badge="SHA-256 VERIFIED"
        subtitle="Register a new dataset or commit an immutable CSV version with automatic column schema extraction."
        actions={
          <button
            type="button"
            onClick={() => onNavigate('datasets')}
            className="df-btn df-btn-secondary"
          >
            <ArrowLeft size={15} /> Back to Catalog
          </button>
        }
      />

      {/* Mode Switcher Pills */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setMode('new-dataset');
            setConfirmedResult(null);
            setSubmitError(null);
          }}
          className={`df-pill-control ${mode === 'new-dataset' ? 'active' : ''}`}
        >
          <Database size={15} color={mode === 'new-dataset' ? 'var(--accent-lime)' : undefined} />
          <span>Register New Dataset + Upload CSV</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('existing-dataset');
            setConfirmedResult(null);
            setSubmitError(null);
          }}
          className={`df-pill-control ${mode === 'existing-dataset' ? 'active' : ''}`}
        >
          <GitBranch
            size={15}
            color={mode === 'existing-dataset' ? 'var(--accent-lime)' : undefined}
          />
          <span>Commit New Version to Existing Dataset</span>
        </button>
      </div>

      {/* Confirmed Backend Receipt Banner */}
      {confirmedResult && (
        <div
          className="df-panel"
          style={{
            borderColor: 'var(--accent-lime)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-lime)',
                  color: 'var(--text-on-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3
                  className="font-display"
                  style={{ fontSize: '22px', color: 'var(--accent-lime)' }}
                >
                  POSTGRESQL TRANSACTION CONFIRMED
                </h3>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginTop: '4px' }}>
                  Dataset <strong>{confirmedResult.dataset.name}</strong> has been persisted.
                </p>
                {confirmedResult.versionDetail && (
                  <div
                    className="font-mono"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '14px',
                      marginTop: '12px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>
                      Version:{' '}
                      <strong style={{ color: 'var(--accent-lime)' }}>
                        {confirmedResult.versionDetail.version.version_label}
                      </strong>
                    </span>
                    <span>
                      Rows:{' '}
                      <strong>
                        {Number(
                          confirmedResult.versionDetail.version.row_count
                        ).toLocaleString()}
                      </strong>
                    </span>
                    <span>
                      Columns:{' '}
                      <strong>{confirmedResult.versionDetail.columns.length}</strong>
                    </span>
                    <span>
                      Size:{' '}
                      <strong>
                        {formatBytes(
                          confirmedResult.versionDetail.version.file_size_bytes
                        )}
                      </strong>
                    </span>
                    <span>
                      SHA-256:{' '}
                      <HashBadge
                        hash={confirmedResult.versionDetail.version.checksum_sha256}
                        chars={16}
                      />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() =>
                  onNavigate('dataset-detail', {
                    datasetId: confirmedResult.dataset.id,
                  })
                }
                className="df-btn df-btn-lime"
              >
                Inspect Dataset Details <ArrowUpRight size={15} />
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigate('lineage', {
                    datasetId: confirmedResult.dataset.id,
                  })
                }
                className="df-btn df-btn-secondary"
              >
                Open Lineage Graph
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Error Banner */}
      {submitError && (
        <div
          role="alert"
          className="df-panel"
          style={{
            borderColor: 'var(--accent-amber)',
            padding: '20px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="var(--accent-amber)" />
            <div>
              <div
                className="font-display"
                style={{ fontSize: '18px', color: 'var(--accent-amber)' }}
              >
                REGISTRATION / UPLOAD REJECTED ({submitError.code || 'ERROR'})
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '13.5px', marginTop: '2px' }}>
                {submitError.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Registration & File Upload Grid */}
      <form onSubmit={handleSubmit} className="df-dashboard-grid">
        {/* Left Column: Dataset & Version Metadata Form */}
        <Panel
          title={
            mode === 'new-dataset'
              ? '1. DATASET IDENTITY & OWNERSHIP'
              : '1. TARGET DATASET & LINEAGE PARENT'
          }
          subtitle="Specify relational project ownership and version commit parameters"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'new-dataset' ? (
              <>
                <div>
                  <label className="df-label">Target Project Workspace *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      aria-label="Target Project Workspace"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      required
                      className="df-select"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (/{p.slug})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsProjectModalOpen(true)}
                      className="df-btn df-btn-secondary"
                    >
                      <Plus size={14} /> New
                    </button>
                  </div>
                </div>

                <div>
                  <label className="df-label">Dataset Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Financial Transaction Streams"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    required
                    className="df-input"
                  />
                </div>

                <div className="df-subgrid-2">
                  <div>
                    <label className="df-label">Data Type</label>
                    <select
                      value={datasetType}
                      onChange={(e) => setDatasetType(e.target.value)}
                      className="df-select"
                    >
                      <option value="TABULAR">TABULAR</option>
                      <option value="TIMESERIES">TIMESERIES</option>
                      <option value="FEATURE_MATRIX">FEATURE_MATRIX</option>
                      <option value="BENCHMARK">BENCHMARK</option>
                    </select>
                  </div>
                  <div>
                    <label className="df-label">Ingestion Source</label>
                    <input
                      type="text"
                      value={datasetSource}
                      onChange={(e) => setDatasetSource(e.target.value)}
                      placeholder="MANUAL_UPLOAD, KAFKA_STREAM..."
                      className="df-input font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="df-label">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Document dataset provenance, collection methodology, and target features..."
                    value={datasetDesc}
                    onChange={(e) => setDatasetDesc(e.target.value)}
                    className="df-textarea"
                  />
                </div>

                <div>
                  <label className="df-label">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={datasetTags}
                    onChange={(e) => setDatasetTags(e.target.value)}
                    className="df-input"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="df-label">Select Existing Dataset *</label>
                  <select
                    value={targetDatasetId}
                    onChange={(e) => setTargetDatasetId(e.target.value)}
                    required
                    className="df-select"
                  >
                    {existingDatasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.project_name || 'Project'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="df-label">Parent Version (Lineage Derivation)</label>
                  <select
                    value={parentVersionId}
                    onChange={(e) => setParentVersionId(e.target.value)}
                    className="df-select font-mono"
                  >
                    <option value="">None (Root Version)</option>
                    {existingVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.version_label} ({v.row_count} rows • {v.file_name})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div className="df-subgrid-2">
                <div>
                  <label className="df-label">Version Label</label>
                  <input
                    type="text"
                    value={versionLabel}
                    onChange={(e) => setVersionLabel(e.target.value)}
                    placeholder="v1.0.0"
                    className="df-input font-mono"
                  />
                </div>
                <div>
                  <label className="df-label">Committed By (User)</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="df-select"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="df-label">Version Commit Message</label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Describe the schema or row modifications in this version..."
                  className="df-input"
                />
              </div>
            </div>
          </div>
        </Panel>

        {/* Right Column: Multipart File Dropzone & Client-Side Schema Profiler */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <Panel
            title="2. MULTIPART CSV UPLOAD & VALIDATION"
            subtitle="Backend parses CSV rows, computes SHA-256 hash, and enforces deduplication"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label
                style={{
                  border: `2px dashed ${
                    file
                      ? 'var(--accent-lime)'
                      : fileValidationError
                        ? 'var(--accent-amber)'
                        : 'var(--border-strong)'
                  }`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '36px 24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-input)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    backgroundColor: file
                      ? 'var(--accent-lime-dim)'
                      : 'var(--bg-surface)',
                    border: `1px solid ${
                      file ? 'var(--accent-lime)' : 'var(--border)'
                    }`,
                    color: file ? 'var(--accent-lime)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {file ? <FileSpreadsheet size={24} /> : <Upload size={24} />}
                </div>

                {file ? (
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '15px',
                        color: 'var(--accent-lime)',
                      }}
                    >
                      {file.name}
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginTop: '4px',
                      }}
                    >
                      {formatBytes(file.size)} &bull;{' '}
                      {filePreview?.headers.length || 0} columns detected
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '15px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Select a CSV file to upload
                    </div>
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--text-muted)',
                        marginTop: '4px',
                      }}
                    >
                      Standard comma-separated values (.csv) up to 50 MB
                    </div>
                  </div>
                )}
              </label>

              {fileValidationError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-amber-dim)',
                    border: '1px solid var(--accent-amber-border)',
                    color: 'var(--accent-amber)',
                    fontSize: '12.5px',
                  }}
                >
                  {fileValidationError}
                </div>
              )}

              {/* Inferred Schema Preview */}
              {filePreview && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
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
                      className="font-display"
                      style={{ fontSize: '15px', color: 'var(--text-secondary)' }}
                    >
                      INFERRED COLUMN SCHEMA ({filePreview.inferredTypes.length})
                    </span>
                    <StatusBadge status="CSV READY" />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {filePreview.inferredTypes.map((col, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{col.name}</span>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--accent-lime)',
                          }}
                        >
                          {col.type}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Sample Rows Preview Table */}
                  <div
                    className="df-table-wrapper"
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      maxHeight: '190px',
                    }}
                  >
                    <table className="df-table" style={{ fontSize: '11.5px' }}>
                      <thead>
                        <tr>
                          {filePreview.headers.map((h, i) => (
                            <th key={i} style={{ padding: '8px 12px' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filePreview.sampleRows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((val, cIdx) => (
                              <td
                                key={cIdx}
                                className="font-mono"
                                style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}
                              >
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Submit Button & Progress Feedback */}
              <div style={{ marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={submitting || (mode === 'existing-dataset' && !file)}
                  className="df-btn df-btn-lime"
                  style={{ width: '100%', padding: '13px 20px', fontSize: '14px' }}
                >
                  <Upload size={16} />
                  {submitting
                    ? stageMessage || 'Processing Multipart Upload...'
                    : mode === 'new-dataset'
                      ? file
                        ? 'Register Dataset & Commit CSV Version'
                        : 'Register Dataset Metadata Only'
                      : 'Upload & Commit New Dataset Version'}
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </form>

      {/* Modal: Quick Create Project */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title="QUICK CREATE PROJECT"
      >
        <form
          onSubmit={handleQuickCreateProject}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div>
            <label className="df-label">Project Name *</label>
            <input
              type="text"
              placeholder="e.g. Genomic Variant Benchmark"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              required
              className="df-input"
            />
          </div>
          <div>
            <label className="df-label">Description</label>
            <textarea
              rows={2}
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="df-textarea"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsProjectModalOpen(false)}
              className="df-btn df-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="df-btn df-btn-lime">
              Create &amp; Select
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
