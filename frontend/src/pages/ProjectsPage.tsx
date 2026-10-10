import React, { useEffect, useState } from 'react';
import {
  FolderGit2,
  Plus,
  Search,
  Users,
  Calendar,
  Database
} from 'lucide-react';
import { api } from '../api/client';
import type { Project, User } from '../types';
import { LoadingSpinner, ErrorState, EmptyState, Modal, ToastNotification } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface ProjectsPageProps {
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectSlug, setProjectSlug] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, usersRes] = await Promise.all([
        api.getProjects(),
        api.getUsers()
      ]);

      setProjects(projRes);
      setUsers(usersRes);
      if (usersRes.length > 0 && !ownerId) {
        setOwnerId(usersRes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !ownerId) {
      setToast({ type: 'error', message: 'Project Name and Project Owner are required.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createProject({
        name: projectName.trim(),
        slug: projectSlug.trim() || undefined,
        description: projectDesc.trim() || undefined,
        owner_id: ownerId
      });

      setToast({ type: 'success', message: `Project "${res.name}" created successfully!` });
      setIsModalOpen(false);
      setProjectName('');
      setProjectSlug('');
      setProjectDesc('');
      await fetchProjects();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Error submitting project creation' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            DataForge Projects
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Workspaces organizing datasets, versions, models, and ML pipelines.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
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
          Create New Project
        </button>
      </div>

      {/* Search Input */}
      <div style={{
        position: 'relative',
        maxWidth: '420px',
        width: '100%'
      }}>
        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
        <input
          type="text"
          placeholder="Filter projects by name, slug or description..."
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

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Retrieving projects from PostgreSQL..." />
      ) : error ? (
        <ErrorState title="Projects Loading Error" message={error} onRetry={fetchProjects} />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title="No Projects Found"
          description={search ? `No projects matching "${search}"` : "You haven't created any DataForge projects yet."}
          actionText={search ? "Clear Filter" : "Create First Project"}
          onAction={() => search ? setSearch('') : setIsModalOpen(true)}
          icon={<FolderGit2 size={36} />}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px'
        }}>
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {project.name}
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid var(--border)'
                  }}>
                    {project.slug}
                  </span>
                </div>
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  minHeight: '40px',
                  marginBottom: '16px'
                }}>
                  {project.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <div style={{
                  borderTop: '1px solid rgba(36, 48, 68, 0.4)',
                  paddingTop: '14px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={13} />
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={13} />
                    Owner: {users.find(u => u.id === project.owner_id)?.name || 'Admin'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => onNavigate('datasets', { projectId: project.id })}
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--accent-cyan)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Database size={14} />
                    View Datasets
                  </button>
                  <button
                    onClick={() => onNavigate('register-dataset', { projectId: project.id })}
                    style={{
                      backgroundColor: 'rgba(14, 165, 233, 0.1)',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      color: 'var(--accent-cyan)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Add Dataset to this project"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Project */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Project"
      >
        <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Project Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Fraud Detection Analytics"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                if (!projectSlug) {
                  setProjectSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                }
              }}
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
              Slug (URL Identifier)
            </label>
            <input
              type="text"
              placeholder="e.g. fraud-detection-analytics"
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: 'JetBrains Mono, monospace',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Project Owner <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
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
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) — {u.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              placeholder="What research or machine learning problem does this project address?"
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{
                padding: '9px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: 'var(--accent-cyan)',
                color: '#FFFFFF',
                padding: '9px 18px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Creating in PostgreSQL...' : 'Create Project'}
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

