import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Upload,
  FileSpreadsheet,
  Layers,
  GitBranch,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Hash,
  Plus
} from 'lucide-react';
import { api } from '../api/client';
import type { Project, User } from '../types';
import { LoadingSpinner, ToastNotification, Modal } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface DatasetRegistrationPageProps {
  initialProjectId?: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const DatasetRegistrationPage: React.FC<DatasetRegistrationPageProps> = ({
  initialProjectId,
  onNavigate,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form State
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [datasetName, setDatasetName] = useState('');
  const [datasetDesc, setDatasetDesc] = useState('');
  const [datasetTags, setDatasetTags] = useState('raw, benchmark');

  // File & Parsing State
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{
    rowCount: number;
    headers: string[];
    sampleRows: string[][];
    inferredTypes: { name: string; type: string }[];
  } | null>(null);

  // Version Commit State
  const [versionLabel, setVersionLabel] = useState('v1.0.0');
  const [commitMessage, setCommitMessage] = useState('Initial dataset registration');
  const [selectedUserId, setSelectedUserId] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create Project In-Wizard Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  useEffect(() => {
    const fetchPrereqs = async () => {
      try {
        const [projRes, usersRes] = await Promise.all([
          api.getProjects(),
          api.getUsers()
        ]);
        setProjects(projRes);
        if (!selectedProjectId && projRes.length > 0) {
          setSelectedProjectId(projRes[0].id);
        }
        setUsers(usersRes);
        if (usersRes.length > 0) {
          setSelectedUserId(usersRes[0].id);
        }
      } catch (err: any) {
        setToast({ type: 'error', message: err.message || 'Failed to load projects/users' });
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchPrereqs();
  }, []);

  // Quick Create Project without leaving wizard
  const handleQuickCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !selectedUserId) return;
    try {
      const res = await api.createProject({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
        owner_id: selectedUserId
      });
      setProjects(prev => [res, ...prev]);
      setSelectedProjectId(res.id);
      setIsProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setToast({ type: 'success', message: `Project "${res.name}" created and selected!` });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to create project' });
    }
  };

  // CSV Parsing Client-Side for instant preview & validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);

      if (!datasetName) {
        const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setDatasetName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }

      // Read first chunk for schema inference & preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          const sampleRows = lines.slice(1, 6).map(line =>
            line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
          );

          // Infer types based on samples
          const inferred = headers.map((header, colIdx) => {
            let isNumeric = true;
            let isBoolean = true;
            for (const row of sampleRows) {
              const val = row[colIdx];
              if (!val) continue;
              if (isNaN(Number(val))) isNumeric = false;
              if (val !== 'true' && val !== 'false' && val !== '1' && val !== '0') isBoolean = false;
            }
            let type = 'VARCHAR';
            if (isBoolean) type = 'BOOLEAN';
            else if (isNumeric) type = 'NUMERIC';
            return { name: header, type };
          });

          setFilePreview({
            rowCount: lines.length - 1,
            headers,
            sampleRows,
            inferredTypes: inferred
          });
        }
      };
      reader.readAsText(selected.slice(0, 50000));
    }
  };

  // Final Submission Step: Create Dataset -> Upload Version
  const handleFinalSubmit = async () => {
    if (!file || !selectedProjectId || !datasetName.trim()) {
      setToast({ type: 'error', message: 'Missing required registration details.' });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Dataset Entity
      const tagsArray = datasetTags.split(',').map(t => t.trim()).filter(Boolean);
      const newDataset = await api.createDataset({
        project_id: selectedProjectId,
        name: datasetName.trim(),
        description: datasetDesc.trim() || undefined,
        tags: tagsArray,
        created_by: selectedUserId || undefined
      });

      // 2. Upload CSV & Create Immutable Version Record via FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('version_label', versionLabel.trim() || 'v1.0.0');
      formData.append('commit_message', commitMessage.trim() || 'Initial registration');
      if (selectedUserId) {
        formData.append('created_by', selectedUserId);
      }

      await api.createDatasetVersion(newDataset.id, formData);

      // Success! Navigate directly to the dataset detail view
      setToast({ type: 'success', message: 'Dataset successfully registered and version committed!' });
      setTimeout(() => {
        onNavigate('dataset-detail', { datasetId: newDataset.id });
      }, 1000);
    } catch (err: any) {
      if (err.code === 'DUPLICATE_FILE') {
        setToast({ type: 'error', message: 'Exact duplicate file detected (matching SHA-256 hash).' });
      } else {
        setToast({ type: 'error', message: err.message || 'Registration transaction failed.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { number: 1, title: 'Project Context', icon: FolderGit2 },
    { number: 2, title: 'CSV Ingestion', icon: Upload },
    { number: 3, title: 'Dataset Metadata', icon: Layers },
    { number: 4, title: 'Schema Verification', icon: Hash },
    { number: 5, title: 'Version Configuration', icon: GitBranch },
    { number: 6, title: 'Confirm & Commit', icon: CheckCircle },
  ];

  if (loadingInitial) return <LoadingSpinner message="Setting up Dataset Registration Wizard..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Wizard Header */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Register Dataset
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          6-Step guided pipeline to ingest, validate, profile, and commit a dataset version.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 24px',
        overflowX: 'auto',
        gap: '12px'
      }}>
        {steps.map((s, idx) => {
          const isDone = currentStep > s.number;
          const isCurrent = currentStep === s.number;
          return (
            <React.Fragment key={s.number}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: isCurrent ? 1 : isDone ? 0.8 : 0.4,
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isCurrent ? 'var(--accent-cyan)' : isDone ? 'var(--accent-emerald)' : 'var(--bg-card)',
                  color: isCurrent || isDone ? '#FFFFFF' : 'var(--text-muted)',
                  border: isCurrent ? 'none' : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  {isDone ? <CheckCircle size={16} /> : s.number}
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>
                  {s.title}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: isDone ? 'var(--accent-emerald)' : 'var(--border)',
                  minWidth: '24px'
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content Container */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        minHeight: '400px'
      }}>
        {/* Step 1: Project Selection */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Step 1: Assign Project Context
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Select the DataForge project workspace that will own this dataset.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Target Project <span style={{ color: 'var(--accent-rose)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(true)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--accent-cyan)',
                    padding: '0 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={16} /> New
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Author / User Context
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: File Upload */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Step 2: Upload CSV File
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Select a valid tabular CSV file. The backend will calculate its SHA-256 checksum and extract schema metadata.
            </p>

            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: 'rgba(21, 30, 46, 0.5)',
              position: 'relative',
              cursor: 'pointer'
            }}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  padding: '16px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  color: 'var(--accent-cyan)'
                }}>
                  <FileSpreadsheet size={36} />
                </div>
                {file ? (
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                      Selected: {file.name}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                      {(file.size / 1024).toFixed(1)} KB &bull; Type: {file.type || 'text/csv'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Click or drag and drop your CSV file here
                    </h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      Accepts standard comma-delimited .csv files up to 50MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Dataset Metadata */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Step 3: Define Dataset Metadata
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Dataset Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Credit Card Transaction Logs"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Purpose, data gathering methodology, and feature characteristics..."
                value={datasetDesc}
                onChange={(e) => setDatasetDesc(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={datasetTags}
                onChange={(e) => setDatasetTags(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Step 4: Schema Verification & Sample Table */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Step 4: Schema Verification & Inspection
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Inferred columns and data types from the file preview. The backend will persist these column types into the PostgreSQL relational schema table.
            </p>

            {filePreview ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Columns Inferred */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {filePreview.inferredTypes.map((col, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{col.name}</span>
                      <span style={{
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--accent-cyan)',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {col.type}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Sample Data Preview Table */}
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  overflowX: 'auto',
                  backgroundColor: 'var(--bg-card)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        {filePreview.headers.map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filePreview.sampleRows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid rgba(36, 48, 68, 0.4)' }}>
                          {row.map((val, cIdx) => (
                            <td key={cIdx} style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--accent-rose)' }}>No preview available. Please upload a valid CSV.</div>
            )}
          </div>
        )}

        {/* Step 5: Version Configuration */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Step 5: Version & Commit Details
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Version Label <span style={{ color: 'var(--accent-rose)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. v1.0.0"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Commit Message
              </label>
              <textarea
                rows={3}
                placeholder="Why is this dataset version being committed?"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Step 6: Confirmation & Final Commit */}
        {currentStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Step 6: Review & Finalize Commit
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Confirm all details before committing to PostgreSQL and the DataForge repository.
            </p>

            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {projects.find(p => p.id === selectedProjectId)?.name}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dataset Name:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{datasetName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Source File:</span>
                <span style={{ color: 'var(--text-primary)' }}>{file?.name} ({(Number(file?.size || 0) / 1024).toFixed(1)} KB)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Columns Detected:</span>
                <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {filePreview?.headers.length || 0} columns
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Version Label:</span>
                <span style={{ color: 'var(--accent-emerald)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                  {versionLabel}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Commit Message:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{commitMessage}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          disabled={currentStep === 1 || submitting}
          onClick={() => setCurrentStep(prev => prev - 1)}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            color: currentStep === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: currentStep === 1 ? 'not-allowed' : 'pointer'
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {currentStep < 6 ? (
          <button
            type="button"
            disabled={
              (currentStep === 1 && !selectedProjectId) ||
              (currentStep === 2 && !file) ||
              (currentStep === 3 && !datasetName.trim())
            }
            onClick={() => setCurrentStep(prev => prev + 1)}
            style={{
              backgroundColor: 'var(--accent-cyan)',
              color: '#FFFFFF',
              padding: '10px 22px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleFinalSubmit}
            style={{
              backgroundColor: 'var(--accent-emerald)',
              color: '#FFFFFF',
              padding: '10px 24px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? 'Registering & Committing...' : 'Commit Dataset Version'}
          </button>
        )}
      </div>

      {/* Modal: Quick Create Project */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title="Add New Project"
      >
        <form onSubmit={handleQuickCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Project Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. LLM Benchmark Suite"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              placeholder="Project purpose..."
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsProjectModalOpen(false)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Save Project
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
