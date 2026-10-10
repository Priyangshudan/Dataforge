import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Search
} from 'lucide-react';
import { api } from '../api/client';
import type { User } from '../types';
import { LoadingSpinner, ErrorState, EmptyState, Modal, ToastNotification } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface UsersPageProps {
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const UsersPage: React.FC<UsersPageProps> = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create User Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'DATA_ENGINEER' | 'VIEWER'>('DATA_ENGINEER');
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUsers();
      setUsers(res);
    } catch (err: any) {
      setError(err.message || 'Error communicating with DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) {
      setToast({ type: 'error', message: 'Email and Full Name are required.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createUser({
        email: email.trim(),
        name: fullName.trim(),
        role
      });

      setToast({ type: 'success', message: `User "${res.name}" registered!` });
      setIsModalOpen(false);
      setEmail('');
      setFullName('');
      await fetchUsers();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to register user' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case 'ADMIN':
      case 'Admin':
        return { bg: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', border: 'rgba(244, 63, 94, 0.3)' };
      case 'DATA_ENGINEER':
      case 'Data Engineer':
        return { bg: 'rgba(14, 165, 233, 0.1)', color: 'var(--accent-cyan)', border: 'rgba(14, 165, 233, 0.3)' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: 'var(--border)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Team & Platform Users
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            User identities and roles participating in projects and committing dataset versions.
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
          Add User
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', maxWidth: '420px', width: '100%' }}>
        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
        <input
          type="text"
          placeholder="Search team members by name, email, or role..."
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

      {/* Users Table */}
      {loading ? (
        <LoadingSpinner message="Querying team accounts from PostgreSQL..." />
      ) : error ? (
        <ErrorState title="Users Error" message={error} onRetry={fetchUsers} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          title="No Users Found"
          description="No users matched your search criteria."
          icon={<Users size={36} />}
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
                <th style={{ padding: '14px 20px' }}>Full Name</th>
                <th style={{ padding: '14px 16px' }}>Email Address</th>
                <th style={{ padding: '14px 16px' }}>Role</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const badge = getRoleBadge(u.role);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(36, 48, 68, 0.4)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--accent-cyan)'
                        }}>
                          {u.name.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                      </div>
                    </td>

                    <td style={{ padding: '16px 16px', color: 'var(--text-secondary)' }}>
                      {u.email}
                    </td>

                    <td style={{ padding: '16px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`
                      }}>
                        {u.role}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create User */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Team Member"
      >
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Full Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Dr. Alan Turing"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Email Address <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              type="email"
              placeholder="e.g. alan.turing@cambridge.ac.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Platform Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            >
              <option value="DATA_ENGINEER">Data Engineer (Pipelines & Datasets)</option>
              <option value="ADMIN">Admin (Full Access)</option>
              <option value="VIEWER">Viewer (Read Only)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '13px'
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
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Registering...' : 'Register User'}
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

