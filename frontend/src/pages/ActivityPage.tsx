import React, { useEffect, useState } from 'react';
import {
  History,
  Search
} from 'lucide-react';
import { api } from '../api/client';
import type { ActivityLog, Project } from '../types';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface ActivityPageProps {
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, projRes] = await Promise.all([
        api.getActivityLogs({
          project_id: selectedProjectId || undefined,
          entity_type: selectedEntityType || undefined,
          limit: 100
        }),
        api.getProjects()
      ]);

      setLogs(logsRes);
      setProjects(projRes);
    } catch (err: any) {
      setError(err.message || 'Error communicating with DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedProjectId, selectedEntityType]);

  const filteredLogs = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_id.toLowerCase().includes(search.toLowerCase())
  );

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('REGISTER')) return 'var(--accent-emerald)';
    if (action.includes('UPDATE') || action.includes('DRIFT')) return 'var(--accent-cyan)';
    if (action.includes('DELETE') || action.includes('DROP')) return 'var(--accent-rose)';
    return 'var(--accent-indigo)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Audit Logs & System Activity
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Immutable PostgreSQL activity journal recording all schema modifications, registrations, and training events.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {/* Project Selector */}
        <div style={{ minWidth: '200px' }}>
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

        {/* Entity Type Selector */}
        <div style={{ minWidth: '180px' }}>
          <select
            value={selectedEntityType}
            onChange={(e) => setSelectedEntityType(e.target.value)}
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
            <option value="">All Entity Types</option>
            <option value="PROJECT">Project</option>
            <option value="DATASET">Dataset</option>
            <option value="DATASET_VERSION">Dataset Version</option>
            <option value="MODEL">Model</option>
            <option value="MODEL_VERSION">Model Version</option>
            <option value="EXPERIMENT">Experiment</option>
          </select>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            placeholder="Search by action, entity type, or identifier..."
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

      {/* Activity Table */}
      {loading ? (
        <LoadingSpinner message="Querying PostgreSQL activity log table..." />
      ) : error ? (
        <ErrorState title="Activity Logs Error" message={error} onRetry={fetchLogs} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title="No Logs Recorded"
          description="No activity matching your selected filters."
          icon={<History size={36} />}
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
              <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '14px 20px' }}>Action</th>
                <th style={{ padding: '14px 16px' }}>Entity Type</th>
                <th style={{ padding: '14px 16px' }}>Entity ID</th>
                <th style={{ padding: '14px 16px' }}>User ID</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const badgeColor = getActionBadgeColor(log.action);
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(36, 48, 68, 0.4)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: `${badgeColor}15`,
                        color: badgeColor,
                        border: `1px solid ${badgeColor}33`
                      }}>
                        {log.action}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.entity_type}
                    </td>

                    <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {log.entity_id}
                    </td>

                    <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {log.user_id ? `${log.user_id.slice(0, 8)}...` : 'system'}
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

