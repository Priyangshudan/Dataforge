import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  User,
  Project,
  NavigationTab,
} from '../types';
import {
  PageHeader,
  Panel,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  Modal,
  StatusBadge,
  ToastNotification,
  formatShortDate,
} from '../components/Common';
import {
  Users,
  UserPlus,
  Search,
  FolderKanban,
} from 'lucide-react';

interface UsersPageProps {
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

export const UsersPage: React.FC<UsersPageProps> = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Create User Modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<string>('RESEARCHER');
  const [creatingUser, setCreatingUser] = useState(false);

  // Assign User to Project Modal
  const [assignTargetUser, setAssignTargetUser] = useState<User | null>(null);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignProjectRole, setAssignProjectRole] = useState<string>('CONTRIBUTOR');
  const [assigning, setAssigning] = useState(false);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uList, pList] = await Promise.all([
        api.getUsers({
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        }),
        api.getProjects(),
      ]);

      setUsers(uList || []);
      setProjects(pList || []);
      if (pList.length > 0 && !assignProjectId) {
        setAssignProjectId(pList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load personnel directory');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, assignProjectId]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newFullName.trim()) return;
    setCreatingUser(true);
    try {
      const created = await api.createUser({
        email: newEmail.trim(),
        name: newFullName.trim(),
        role: newRole,
      });
      setToast({ message: `Registered researcher "${created.name}"`, type: 'success' });
      setShowCreateUser(false);
      setNewEmail('');
      setNewFullName('');
      await loadDirectory();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to create user', type: 'error' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleAssignToProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetUser || !assignProjectId) return;
    setAssigning(true);
    try {
      await api.addProjectMember(assignProjectId, {
        user_id: assignTargetUser.id,
        role: assignProjectRole,
      });
      setToast({
        message: `Assigned ${assignTargetUser.name} to project as ${assignProjectRole}`,
        type: 'success',
      });
      setAssignTargetUser(null);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to assign user to project', type: 'error' });
    } finally {
      setAssigning(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  if (loading && users.length === 0 && !roleFilter && !statusFilter) {
    return <LoadingSpinner message="Loading laboratory personnel directory..." />;
  }

  if (error && users.length === 0) {
    return <ErrorState message={error} onRetry={loadDirectory} />;
  }

  const adminCount = users.filter((u) => u.role.toUpperCase() === 'ADMIN').length;
  const researcherCount = users.filter((u) => u.role.toUpperCase() === 'RESEARCHER').length;
  const viewerCount = users.filter((u) => u.role.toUpperCase() === 'VIEWER').length;

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
        eyebrow="PERSONNEL DIRECTORY & ACCESS GOVERNANCE"
        title="USERS & PROJECT MEMBERS"
        subtitle="Manage academic researchers, role-based access levels, and project membership assignments."
        actions={
          <button
            type="button"
            className="df-btn df-btn--primary"
            onClick={() => setShowCreateUser(true)}
          >
            <UserPlus size={14} /> Register Researcher
          </button>
        }
      />

      {/* Summary Role Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Panel>
          <div className="df-card-label">TOTAL PERSONNEL</div>
          <div className="df-stat-number df-stat-number--md" style={{ marginTop: 6 }}>
            {users.length}
          </div>
        </Panel>
        <Panel>
          <div className="df-card-label">SYSTEM ADMINS</div>
          <div
            className="df-stat-number df-stat-number--md"
            style={{ marginTop: 6, color: 'var(--accent-lime)' }}
          >
            {adminCount}
          </div>
        </Panel>
        <Panel>
          <div className="df-card-label">RESEARCHERS</div>
          <div
            className="df-stat-number df-stat-number--md"
            style={{ marginTop: 6, color: 'var(--accent-amber)' }}
          >
            {researcherCount}
          </div>
        </Panel>
        <Panel>
          <div className="df-card-label">READ-ONLY VIEWERS</div>
          <div className="df-stat-number df-stat-number--md" style={{ marginTop: 6 }}>
            {viewerCount}
          </div>
        </Panel>
      </div>

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
              placeholder="Search researchers by name or email..."
              style={{ paddingLeft: 34 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="df-select"
            style={{ width: 180 }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by Role"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="RESEARCHER">RESEARCHER</option>
            <option value="DATA_ENGINEER">DATA_ENGINEER</option>
            <option value="VIEWER">VIEWER</option>
          </select>

          <select
            className="df-select"
            style={{ width: 170 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by Status"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </Panel>

      {/* Personnel Table */}
      <Panel
        title={`RESEARCHER DIRECTORY (${filteredUsers.length})`}
        subtitle="Assign users directly to research projects or inspect their role permissions"
      >
        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No Researchers Found"
            description="Register a new researcher or clear active search filters."
            actionLabel="Register Researcher"
            onAction={() => setShowCreateUser(true)}
          />
        ) : (
          <div className="df-table-wrapper">
            <table className="df-table">
              <thead>
                <tr>
                  <th>RESEARCHER</th>
                  <th>EMAIL ADDRESS</th>
                  <th>SYSTEM ROLE</th>
                  <th>STATUS</th>
                  <th>JOINED</th>
                  <th style={{ textAlign: 'right' }}>PROJECT ASSIGNMENT</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'rgba(184, 255, 98, 0.12)',
                            border: '1px solid rgba(184, 255, 98, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-lime)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                          }}
                        >
                          {(user.name || 'U')
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#FFF' }}>{user.name}</div>
                          <div
                            className="df-mono"
                            style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}
                          >
                            ID: {user.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="df-mono" style={{ fontSize: '0.8rem' }}>
                      {user.email}
                    </td>
                    <td>
                      <StatusBadge status={user.role} size="sm" />
                    </td>
                    <td>
                      <StatusBadge status={user.status} size="sm" />
                    </td>
                    <td
                      className="df-mono"
                      style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}
                    >
                      {formatShortDate(user.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="df-btn df-btn--secondary df-btn--sm"
                        onClick={() => setAssignTargetUser(user)}
                      >
                        <FolderKanban size={12} /> Assign to Project
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        title="REGISTER LABORATORY RESEARCHER"
        subtitle="Add a new user account to the DataForge PostgreSQL directory"
      >
        <form
          onSubmit={handleCreateUser}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <label className="df-label">FULL NAME *</label>
            <input
              type="text"
              className="df-input"
              placeholder="e.g., Dr. Elena Vance"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="df-label">INSTITUTIONAL EMAIL *</label>
            <input
              type="email"
              className="df-input df-mono"
              placeholder="elena.vance@university.edu"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="df-label">SYSTEM ROLE *</label>
            <select
              className="df-select"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <option value="RESEARCHER">
                RESEARCHER (Create & manage datasets, models, runs)
              </option>
              <option value="DATA_ENGINEER">DATA_ENGINEER (Pipelines & ingestion)</option>
              <option value="ADMIN">ADMIN (Full laboratory governance)</option>
              <option value="VIEWER">VIEWER (Read-only inspection)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={() => setShowCreateUser(false)}
            >
              Cancel
            </button>
            <button type="submit" className="df-btn df-btn--primary" disabled={creatingUser}>
              {creatingUser ? 'Registering...' : 'Register Researcher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign User to Project Modal */}
      <Modal
        isOpen={Boolean(assignTargetUser)}
        onClose={() => setAssignTargetUser(null)}
        title={`ASSIGN TO PROJECT — ${assignTargetUser?.name || ''}`}
        subtitle="Grant or update project-level permissions via POST /api/projects/:id/members"
      >
        <form
          onSubmit={handleAssignToProject}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div>
            <label className="df-label">SELECT RESEARCH PROJECT *</label>
            <select
              className="df-select"
              value={assignProjectId}
              onChange={(e) => setAssignProjectId(e.target.value)}
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-label">PROJECT MEMBERSHIP ROLE *</label>
            <select
              className="df-select"
              value={assignProjectRole}
              onChange={(e) => setAssignProjectRole(e.target.value)}
            >
              <option value="CONTRIBUTOR">CONTRIBUTOR</option>
              <option value="OWNER">OWNER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="df-btn df-btn--secondary"
              onClick={() => setAssignTargetUser(null)}
            >
              Cancel
            </button>
            <button type="submit" className="df-btn df-btn--primary" disabled={assigning}>
              {assigning ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
