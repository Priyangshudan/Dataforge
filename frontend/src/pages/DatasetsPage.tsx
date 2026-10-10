import React, { useEffect, useState } from 'react';
import {
  Database,
  Plus,
  Search,
  ArrowRight,
  GitBranch
} from 'lucide-react';
import { api } from '../api/client';
import type { Dataset, Project } from '../types';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface DatasetsPageProps {
  initialProjectId?: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const DatasetsPage: React.FC<DatasetsPageProps> = ({ initialProjectId, onNavigate }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dsRes, projRes] = await Promise.all([
        api.getDatasets(selectedProjectId ? { project_id: selectedProjectId } : undefined),
        api.getProjects()
      ]);

      setDatasets(dsRes);
      setProjects(projRes);
    } catch (err: any) {
      setError(err.message || 'Error communicating with DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [selectedProjectId]);

  const filteredDatasets = datasets.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(search.toLowerCase())) ||
    (d.tags && d.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Dataset Catalog
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Version-controlled datasets backed by immutable SHA-256 hashes and relational schemas.
          </p>
        </div>

        <button
          onClick={() => onNavigate('register-dataset', { projectId: selectedProjectId || undefined })}
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
          Register New Dataset
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {/* Project Selector */}
        <div style={{ minWidth: '220px' }}>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
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
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            placeholder="Search datasets by name, description, or tag..."
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

      {/* Datasets Table / List */}
      {loading ? (
        <LoadingSpinner message="Querying dataset catalog and latest version stats..." />
      ) : error ? (
        <ErrorState title="Datasets Loading Error" message={error} onRetry={fetchDatasets} />
      ) : filteredDatasets.length === 0 ? (
        <EmptyState
          title="No Datasets Found"
          description={search ? `No datasets matching "${search}"` : "No datasets registered in this project yet."}
          actionText="Register Dataset"
          onAction={() => onNavigate('register-dataset', { projectId: selectedProjectId || undefined })}
          icon={<Database size={36} />}
        />
      ) : (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                backgroundColor: 'var(--bg-card)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontWeight: 600
              }}>
                <th style={{ padding: '14px 20px' }}>Dataset Name</th>
                <th style={{ padding: '14px 16px' }}>Project</th>
                <th style={{ padding: '14px 16px' }}>Versions</th>
                <th style={{ padding: '14px 16px' }}>Rows</th>
                <th style={{ padding: '14px 16px' }}>Created</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDatasets.map((ds) => (
                <tr
                  key={ds.id}
                  style={{
                    borderBottom: '1px solid rgba(36, 48, 68, 0.4)',
                    transition: 'background 0.1s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => onNavigate('dataset-detail', { datasetId: ds.id })}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        color: 'var(--accent-cyan)'
                      }}>
                        <Database size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                          {ds.name}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ds.description || 'No description provided'}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '16px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {ds.project_name || 'Project'}
                  </td>

                  <td style={{ padding: '16px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      color: 'var(--accent-cyan)',
                      fontWeight: 600
                    }}>
                      <GitBranch size={11} />
                      {ds.total_versions || 1} versions
                    </span>
                  </td>

                  <td style={{ padding: '16px 16px', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {ds.latest_row_count ?? '—'}
                  </td>

                  <td style={{ padding: '16px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {new Date(ds.created_at).toLocaleDateString()}
                  </td>

                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('dataset-detail', { datasetId: ds.id });
                      }}
                      style={{
                        color: 'var(--accent-cyan)',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      Inspect <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

