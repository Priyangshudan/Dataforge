import React, { useEffect, useState } from 'react';
import {
  Database,
  Plus,
  Search,
  GitBranch,
  GitFork,
  GitCompare,
  ArrowUpRight,
  ArrowUpDown,
} from 'lucide-react';
import { api } from '../api/client';
import type { Dataset, Project, NavigationTab } from '../types';
import {
  LoadingSpinner,
  ErrorState,
  EmptyState,
  PageHeader,
  Panel,
  StatusBadge,
  formatBytes,
} from '../components/Common';

interface DatasetsPageProps {
  initialProjectId?: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const DatasetsPage: React.FC<DatasetsPageProps> = ({
  initialProjectId,
  onNavigate,
}) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dsRes, projRes] = await Promise.all([
        api.getDatasets({
          project_id: selectedProjectId || undefined,
          sortBy,
          sortOrder,
        }),
        api.getProjects(),
      ]);
      setDatasets(dsRes);
      setProjects(projRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets from DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [selectedProjectId, sortBy, sortOrder]);

  const filteredDatasets = datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(search.toLowerCase())) ||
      (d.project_name && d.project_name.toLowerCase().includes(search.toLowerCase())) ||
      (d.tags && d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())))
  );

  const totalStorage = filteredDatasets.reduce(
    (acc, d) => acc + Number(d.total_storage_bytes || 0),
    0
  );
  const totalVersionsCount = filteredDatasets.reduce(
    (acc, d) => acc + Number(d.total_versions || 0),
    0
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="DATASET CATALOG"
        badge={`${filteredDatasets.length} DATASETS`}
        subtitle="Version-controlled tabular assets backed by SHA-256 content addressing and PostgreSQL column schemas."
        actions={
          <button
            type="button"
            onClick={() =>
              onNavigate('register-dataset', {
                projectId: selectedProjectId || undefined,
              })
            }
            className="df-btn df-btn-lime"
          >
            <Plus size={16} />
            Register &amp; Upload Dataset
          </button>
        }
      />

      {/* Filter & Sort Pill Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 280px', maxWidth: '420px' }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '14px', top: '11px' }}
            />
            <input
              type="text"
              aria-label="Search datasets"
              placeholder="Filter by dataset name, description, project, or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="df-input"
              style={{
                paddingLeft: '38px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--bg-surface)',
              }}
            />
          </div>

          {/* Project Pill Filter */}
          <label className="df-pill-control" style={{ padding: '7px 15px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Project:</span>
            <select
              aria-label="Filter datasets by project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="" style={{ backgroundColor: 'var(--bg-surface)' }}>
                All Projects
              </option>
              {projects.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {/* Sort By Pill */}
          <label className="df-pill-control" style={{ padding: '7px 15px' }}>
            <ArrowUpDown size={14} color="var(--accent-lime)" />
            <span style={{ color: 'var(--text-muted)' }}>Sort:</span>
            <select
              aria-label="Sort datasets by field"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="created_at" style={{ backgroundColor: 'var(--bg-surface)' }}>
                Created Date
              </option>
              <option value="name" style={{ backgroundColor: 'var(--bg-surface)' }}>
                Dataset Name
              </option>
              <option value="total_versions" style={{ backgroundColor: 'var(--bg-surface)' }}>
                Version Count
              </option>
              <option value="total_storage_bytes" style={{ backgroundColor: 'var(--bg-surface)' }}>
                Storage Size
              </option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'))}
            className="df-pill-control font-mono"
            style={{ padding: '7px 14px', fontSize: '12px' }}
          >
            {sortOrder}
          </button>
        </div>

        {/* Summary Telemetry Strip */}
        <div
          className="font-mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            Versions: <strong style={{ color: 'var(--accent-lime)' }}>{totalVersionsCount}</strong>
          </span>
          <span>
            Footprint: <strong style={{ color: 'var(--accent-amber)' }}>{formatBytes(totalStorage)}</strong>
          </span>
        </div>
      </div>

      {/* Main Dataset Catalog Table */}
      {loading ? (
        <LoadingSpinner message="Querying dataset_summary_view in PostgreSQL..." />
      ) : error ? (
        <ErrorState title="Dataset Catalog Error" message={error} onRetry={fetchDatasets} />
      ) : filteredDatasets.length === 0 ? (
        <EmptyState
          title="No Datasets Found"
          description={
            search
              ? `No datasets matched "${search}".`
              : 'No datasets registered in this workspace yet. Upload a CSV to initialize a dataset.'
          }
          actionText="Register Dataset"
          onAction={() =>
            onNavigate('register-dataset', {
              projectId: selectedProjectId || undefined,
            })
          }
          icon={<Database size={28} />}
        />
      ) : (
        <Panel
          title="CATALOGED DATASETS"
          subtitle="Click any dataset row to inspect schema columns, version history, and lineage"
          legend={[
            { label: 'Validated / Active', color: 'lime' },
            { label: 'Versioned Storage', color: 'amber' },
            { label: 'Tabular Schema', color: 'white' },
          ]}
          totalLabel="Total Catalog Storage"
          totalValue={formatBytes(totalStorage)}
          flush
        >
          <div className="df-table-wrapper">
            <table className="df-table">
              <thead>
                <tr>
                  <th>Dataset Identity</th>
                  <th>Project</th>
                  <th>Status / Type</th>
                  <th>Versions</th>
                  <th>Latest Rows</th>
                  <th>Storage</th>
                  <th style={{ textAlign: 'right' }}>Operations</th>
                </tr>
              </thead>
              <tbody>
                {filteredDatasets.map((ds) => {
                  const verCount = Number(ds.total_versions || 0);
                  const latestVer = Number(ds.latest_version_number || 0);
                  return (
                    <tr
                      key={ds.id}
                      onClick={() => onNavigate('dataset-detail', { datasetId: ds.id })}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              color: 'var(--accent-lime)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Database size={16} />
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: '14px',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {ds.name}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                maxWidth: '340px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ds.description || 'No description provided'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {ds.project_name ||
                            projects.find((p) => p.id === ds.project_id)?.name ||
                            'Project'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <StatusBadge status={ds.status || 'Active'} />
                          <span
                            className="font-mono"
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              backgroundColor: 'var(--bg-card)',
                            }}
                          >
                            {ds.type || 'TABULAR'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className="font-mono"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-pill)',
                            backgroundColor:
                              verCount > 0 ? 'var(--accent-lime-dim)' : 'var(--bg-card)',
                            color:
                              verCount > 0 ? 'var(--accent-lime)' : 'var(--text-muted)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                          }}
                        >
                          <GitBranch size={12} />
                          {verCount} (v{latestVer})
                        </span>
                      </td>

                      <td className="font-mono" style={{ fontWeight: 600 }}>
                        {Number(ds.latest_row_count || 0).toLocaleString()}
                      </td>

                      <td className="font-mono" style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
                        {formatBytes(ds.total_storage_bytes)}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onNavigate('versions', { datasetId: ds.id })}
                            title="Version History & Diff"
                            className="df-btn df-btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '11.5px' }}
                          >
                            <GitCompare size={13} /> Diff
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate('lineage', { datasetId: ds.id })}
                            title="Explore Lineage Graph"
                            className="df-btn df-btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '11.5px' }}
                          >
                            <GitFork size={13} /> DAG
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate('dataset-detail', { datasetId: ds.id })}
                            className="df-btn df-btn-lime"
                            style={{ padding: '6px 12px', fontSize: '11.5px' }}
                          >
                            Inspect <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
};
