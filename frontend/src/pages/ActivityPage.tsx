import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  ActivityLog,
  Project,
  User,
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
  formatDateTime,
} from '../components/Common';
import {
  Clock,
  Search,
  ExternalLink,
} from 'lucide-react';

interface ActivityPageProps {
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [projectFilter, setProjectFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, projRes, usersRes] = await Promise.all([
        api.getActivityLogs({
          project_id: projectFilter || undefined,
          entity_type: entityTypeFilter || undefined,
          user_id: userFilter || undefined,
          limit: 100,
        }),
        api.getProjects(),
        api.getUsers(),
      ]);

      setLogs(logsRes || []);
      setProjects(projRes || []);
      setUsers(usersRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit activity logs');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, entityTypeFilter, userFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.entity_type.toLowerCase().includes(q) ||
      (log.user_name || '').toLowerCase().includes(q) ||
      (log.entity_name || '').toLowerCase().includes(q) ||
      String(log.details || '').toLowerCase().includes(q)
    );
  });

  const handleNavigateEntity = (log: ActivityLog) => {
    if (!log.entity_id) return;
    if (log.entity_type === 'DATASET') {
      onNavigate('dataset-detail', { datasetId: log.entity_id });
    } else if (log.entity_type === 'DATASET_VERSION') {
      onNavigate('versions');
    } else if (log.entity_type === 'PROJECT') {
      onNavigate('projects', { projectId: log.entity_id });
    } else if (log.entity_type === 'MODEL') {
      onNavigate('models', { modelId: log.entity_id });
    } else if (log.entity_type === 'EXPERIMENT') {
      onNavigate('experiments', { experimentId: log.entity_id });
    }
  };

  if (loading && logs.length === 0 && !projectFilter && !entityTypeFilter && !userFilter) {
    return <LoadingSpinner message="Loading immutable PostgreSQL activity audit log..." />;
  }

  if (error && logs.length === 0) {
    return <ErrorState message={error} onRetry={loadLogs} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="IMMUTABLE AUDIT TRAIL & SYSTEM EVENTS"
        title="LABORATORY ACTIVITY LOGS"
        subtitle="Chronological record of dataset commits, version uploads, model registrations, experiment runs, and membership changes."
      />

      {/* Filter Bar */}
      <Panel style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="df-input"
              placeholder="Search audit events by action, user, entity, or payload..."
              style={{ paddingLeft: 34 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="df-select"
            style={{ width: 200 }}
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            aria-label="Filter by Project"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            className="df-select"
            style={{ width: 185 }}
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            aria-label="Filter by Entity Type"
          >
            <option value="">All Entity Types</option>
            <option value="PROJECT">PROJECT</option>
            <option value="DATASET">DATASET</option>
            <option value="DATASET_VERSION">DATASET_VERSION</option>
            <option value="MODEL">MODEL</option>
            <option value="MODEL_VERSION">MODEL_VERSION</option>
            <option value="EXPERIMENT">EXPERIMENT</option>
          </select>

          <select
            className="df-select"
            style={{ width: 190 }}
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            aria-label="Filter by User"
          >
            <option value="">All Researchers</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      <Panel
        title={`CHRONOLOGICAL AUDIT STREAM (${filteredLogs.length})`}
        subtitle="Ordered newest to oldest from PostgreSQL activity_logs table"
        rightSlot={
          <div style={{ display: 'flex', gap: 14 }}>
            <RingLegend label="DATASET / VERSION" color="lime" />
            <RingLegend label="MODEL / EXPERIMENT" color="amber" />
          </div>
        }
      >
        {filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Clock size={22} />}
            title="No Audit Events Match Filters"
            description="Adjust project, entity type, or researcher filters to inspect historical events."
          />
        ) : (
          <div
            style={{
              position: 'relative',
              paddingLeft: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 9,
                top: 16,
                bottom: 16,
                width: 2,
                background: 'rgba(255,255,255,0.08)',
              }}
            />

            {filteredLogs.map((log) => {
              const isDataEvent =
                log.entity_type === 'DATASET' || log.entity_type === 'DATASET_VERSION';
              const isModelOrExp =
                log.entity_type === 'MODEL' ||
                log.entity_type === 'MODEL_VERSION' ||
                log.entity_type === 'EXPERIMENT';

              return (
                <div
                  key={log.id}
                  style={{
                    position: 'relative',
                    padding: '14px 18px',
                    borderRadius: 14,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: -20,
                      top: 20,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: '#090A09',
                      border: `2.5px solid ${
                        isDataEvent
                          ? 'var(--accent-lime)'
                          : isModelOrExp
                            ? 'var(--accent-amber)'
                            : '#F4F5F4'
                      }`,
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      flex: 1,
                      minWidth: 260,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        className="df-mono"
                        style={{
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          color: isDataEvent
                            ? 'var(--accent-lime)'
                            : isModelOrExp
                              ? 'var(--accent-amber)'
                              : '#FFF',
                        }}
                      >
                        {log.action}
                      </span>
                      <StatusBadge status={log.entity_type} size="sm" />
                      {log.entity_name && (
                        <span
                          style={{
                            fontSize: '0.78rem',
                            color: '#FFF',
                            fontWeight: 600,
                          }}
                        >
                          {log.entity_name}
                        </span>
                      )}
                    </div>

                    {log.details && (
                      <div
                        className="df-mono"
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {typeof log.details === 'string'
                          ? log.details
                          : JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFF' }}>
                        {log.user_name || 'System Process'}
                      </div>
                      <div
                        className="df-mono"
                        style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
                      >
                        {formatDateTime(log.created_at)}
                      </div>
                    </div>

                    {log.entity_id && (
                      <button
                        type="button"
                        className="df-btn df-btn--ghost df-btn--sm"
                        onClick={() => handleNavigateEntity(log)}
                        title="Open Associated Entity"
                      >
                        Inspect <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
};
