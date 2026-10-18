import React, { useEffect, useState } from 'react';
import {
  FolderGit2,
  Plus,
  Search,
  Users,
  UserPlus,
  Edit3,
  ArrowUpRight,
  GitBranch,
  Check,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type { Project, ProjectMember, Dataset, User, NavigationTab } from '../types';
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
  formatBytes,
  formatDateTime,
} from '../components/Common';

interface ProjectsPageProps {
  initialProjectId?: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  initialProjectId,
  onNavigate,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected Project Detail State
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectDatasets, setProjectDatasets] = useState<Dataset[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit Project Metadata State
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Member State
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('CONTRIBUTOR');
  const [addingMember, setAddingMember] = useState(false);

  // Create Project Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, usersRes] = await Promise.all([api.getProjects(), api.getUsers()]);
      setProjects(projRes);
      setUsers(usersRes);
      if (usersRes.length > 0) {
        if (!ownerId) setOwnerId(usersRes[0].id);
        if (!addMemberUserId) setAddMemberUserId(usersRes[0].id);
      }

      if (projRes.length > 0) {
        const initial =
          (initialProjectId && projRes.find((p) => p.id === initialProjectId)) ||
          (selectedProject && projRes.find((p) => p.id === selectedProject.id)) ||
          projRes[0];
        if (initial) {
          selectAndLoadProject(initial);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load projects from DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  const selectAndLoadProject = async (proj: Project) => {
    setSelectedProject(proj);
    setIsEditingProject(false);
    setEditName(proj.name);
    setEditDesc(proj.description || '');
    setLoadingDetails(true);
    try {
      const [membersRes, datasetsRes] = await Promise.all([
        api.getProjectMembers(proj.id),
        api.getProjectDatasets(proj.id),
      ]);
      setProjectMembers(membersRes);
      setProjectDatasets(datasetsRes);
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to load project members or datasets',
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [initialProjectId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !ownerId) {
      setToast({ type: 'error', message: 'Project Name and Owner are required.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createProject({
        name: projectName.trim(),
        slug: projectSlug.trim() || undefined,
        description: projectDesc.trim() || undefined,
        owner_id: ownerId,
      });

      setToast({ type: 'success', message: `Project "${res.name}" created in PostgreSQL.` });
      setIsCreateModalOpen(false);
      setProjectName('');
      setProjectSlug('');
      setProjectDesc('');
      await fetchProjects();
      selectAndLoadProject(res);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Project creation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateProject(selectedProject.id, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setIsEditingProject(false);
      setToast({ type: 'success', message: 'Project metadata updated.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to update project' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !addMemberUserId) return;
    setAddingMember(true);
    try {
      await api.addProjectMember(selectedProject.id, {
        user_id: addMemberUserId,
        role: addMemberRole,
      });
      const refreshedMembers = await api.getProjectMembers(selectedProject.id);
      setProjectMembers(refreshedMembers);
      setToast({ type: 'success', message: 'Project member role assigned.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to add project member' });
    } finally {
      setAddingMember(false);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader
        title="PROJECTS & WORKSPACES"
        badge={`${projects.length} ACTIVE`}
        subtitle="Isolated research workspaces governing dataset catalogs, member permissions, and ML pipelines."
        actions={
          <>
            <div style={{ position: 'relative', minWidth: '260px' }}>
              <Search
                size={15}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '14px', top: '11px' }}
              />
              <input
                type="text"
                aria-label="Filter projects"
                placeholder="Search projects by name or slug..."
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
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="df-btn df-btn-lime"
            >
              <Plus size={16} />
              Create Project
            </button>
          </>
        }
      />

      {loading ? (
        <LoadingSpinner message="Querying projects and workspace owners..." />
      ) : error ? (
        <ErrorState title="Projects Query Error" message={error} onRetry={fetchProjects} />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title="No Matching Projects"
          description={
            search
              ? `No projects matched "${search}".`
              : 'Create your first research workspace to organize datasets and models.'
          }
          actionText={search ? 'Reset Filter' : 'Create First Project'}
          onAction={() => (search ? setSearch('') : setIsCreateModalOpen(true))}
          icon={<FolderGit2 size={28} />}
        />
      ) : (
        <div className="df-split-detail">
          {/* Left Column: Project Directory List */}
          <Panel
            title="WORKSPACE DIRECTORY"
            subtitle="Select a project to inspect members, datasets, and settings"
            flush
          >
            <div className="df-table-wrapper">
              <table className="df-table">
                <thead>
                  <tr>
                    <th>Project / Slug</th>
                    <th>Owner</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const isSelected = selectedProject?.id === project.id;
                    const ownerUser = users.find((u) => u.id === project.owner_id);
                    return (
                      <tr
                        key={project.id}
                        onClick={() => selectAndLoadProject(project)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? 'var(--accent-lime-dim)'
                            : 'transparent',
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: isSelected
                                  ? 'var(--accent-lime)'
                                  : 'var(--bg-card)',
                                color: isSelected
                                  ? 'var(--text-on-accent)'
                                  : 'var(--accent-lime)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <FolderGit2 size={16} />
                            </div>
                            <div>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: '14px',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {project.name}
                              </div>
                              <div
                                className="font-mono"
                                style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}
                              >
                                /{project.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {ownerUser?.name || 'Workspace Owner'}
                          </div>
                        </td>
                        <td className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(project.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('datasets', { projectId: project.id });
                            }}
                            className="df-btn df-btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            Datasets <ArrowUpRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Right Column: Selected Project Inspector (Details, Members, Associated Datasets) */}
          {selectedProject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <Panel
                title={selectedProject.name}
                subtitle={`Slug: /${selectedProject.slug}`}
                rightSlot={
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingProject((prev) => !prev)}
                      className="df-btn df-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <Edit3 size={13} /> {isEditingProject ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate('register-dataset', { projectId: selectedProject.id })
                      }
                      className="df-btn df-btn-lime"
                      style={{ padding: '6px 14px', fontSize: '12px' }}
                    >
                      <Plus size={14} /> Add Dataset
                    </button>
                  </div>
                }
              >
                {isEditingProject ? (
                  <form
                    onSubmit={handleUpdateProject}
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                  >
                    <div>
                      <label className="df-label">Project Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="df-input"
                        required
                      />
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingProject(false)}
                        className="df-btn df-btn-secondary"
                      >
                        <X size={14} /> Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="df-btn df-btn-lime"
                      >
                        <Check size={14} /> {savingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.55 }}>
                      {selectedProject.description || 'No project description provided.'}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        ID: <HashBadge hash={selectedProject.id} chars={10} />
                      </span>
                      <span>Updated: {formatDateTime(selectedProject.updated_at)}</span>
                    </div>
                  </div>
                )}
              </Panel>

              {/* Associated Datasets in Project */}
              <Panel
                title={`ASSOCIATED DATASETS (${projectDatasets.length})`}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => onNavigate('datasets', { projectId: selectedProject.id })}
                    className="df-btn-ghost"
                    style={{ fontSize: '12px', borderRadius: '999px' }}
                  >
                    Open in Catalog <ArrowUpRight size={13} />
                  </button>
                }
              >
                {loadingDetails ? (
                  <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Loading project datasets...
                  </div>
                ) : projectDatasets.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    No datasets registered in this project yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {projectDatasets.map((ds) => (
                      <div
                        key={ds.id}
                        onClick={() => onNavigate('dataset-detail', { datasetId: ds.id })}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {ds.name}
                          </div>
                          <div
                            className="font-mono"
                            style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}
                          >
                            {ds.total_versions ?? 0} versions &bull;{' '}
                            {Number(ds.latest_row_count || 0).toLocaleString()} rows &bull;{' '}
                            {formatBytes(ds.total_storage_bytes)}
                          </div>
                        </div>
                        <span
                          className="font-mono"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            backgroundColor: 'var(--accent-lime-dim)',
                            color: 'var(--accent-lime)',
                          }}
                        >
                          <GitBranch size={12} /> v{ds.latest_version_number || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* Project Members & Collaborators */}
              <Panel
                title={`PROJECT MEMBERS (${projectMembers.length})`}
                subtitle="Assign users and roles to this workspace"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {projectMembers.map((m) => (
                    <div
                      key={m.user_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={15} color="var(--accent-lime)" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>
                            {m.user_name || m.user_id.slice(0, 8)}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            {m.user_email || 'Member'}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={m.role} />
                    </div>
                  ))}

                  {/* Add / Update Member Form */}
                  {users.length > 0 && (
                    <form
                      onSubmit={handleAddMember}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 140px auto',
                        gap: '8px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-subtle)',
                        alignItems: 'end',
                      }}
                    >
                      <div>
                        <label className="df-label">User</label>
                        <select
                          aria-label="Select user to add to project"
                          value={addMemberUserId}
                          onChange={(e) => setAddMemberUserId(e.target.value)}
                          className="df-select"
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="df-label">Role</label>
                        <select
                          aria-label="Select member role"
                          value={addMemberRole}
                          onChange={(e) => setAddMemberRole(e.target.value)}
                          className="df-select"
                        >
                          <option value="CONTRIBUTOR">CONTRIBUTOR</option>
                          <option value="OWNER">OWNER</option>
                          <option value="MEMBER">MEMBER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={addingMember}
                        className="df-btn df-btn-secondary"
                        style={{ height: '40px' }}
                      >
                        <UserPlus size={14} /> {addingMember ? 'Adding...' : 'Assign'}
                      </button>
                    </form>
                  )}
                </div>
              </Panel>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Project */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="CREATE NEW PROJECT"
        subtitle="Initialize a PostgreSQL project record and assign an owner."
      >
        <form
          onSubmit={handleCreateProject}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div>
            <label className="df-label">Project Name *</label>
            <input
              type="text"
              placeholder="e.g. Autonomous Fraud Detection"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                if (!projectSlug) {
                  setProjectSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)/g, '')
                  );
                }
              }}
              required
              className="df-input"
            />
          </div>

          <div>
            <label className="df-label">URL Slug</label>
            <input
              type="text"
              placeholder="e.g. autonomous-fraud-detection"
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value)}
              className="df-input font-mono"
            />
          </div>

          <div>
            <label className="df-label">Project Owner *</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              required
              className="df-select"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) — {u.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-label">Research Description</label>
            <textarea
              rows={3}
              placeholder="Describe the data domain, ML objectives, and governance scope..."
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              className="df-textarea"
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="df-btn df-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="df-btn df-btn-lime">
              {submitting ? 'Creating...' : 'Create Project'}
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
