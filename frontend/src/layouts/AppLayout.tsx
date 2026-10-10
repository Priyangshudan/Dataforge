import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Database,
  Brain,
  FlaskConical,
  GitFork,
  BarChart3,
  History,
  Users,
  HardDrive,
  Activity,
  PlusCircle,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { api } from '../api/client';
import type { SystemHealth } from '../types';

export type NavigationTab =
  | 'dashboard'
  | 'projects'
  | 'datasets'
  | 'register-dataset'
  | 'dataset-detail'
  | 'models'
  | 'experiments'
  | 'lineage'
  | 'analytics'
  | 'activity'
  | 'users';

interface AppLayoutProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab, params?: any) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentTab, onNavigate, children }) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await api.getHealth();
        if (mounted) {
          setHealth(res);
        }
      } catch {
        if (mounted) setHealth(null);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'datasets', label: 'Datasets', icon: Database },
    { id: 'models', label: 'Models', icon: Brain },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    { id: 'lineage', label: 'Lineage Explorer', icon: GitFork },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'activity', label: 'Audit Logs', icon: History },
    { id: 'users', label: 'Team & Users', icon: Users },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 100
      }}>
        {/* Brand Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(14, 165, 233, 0.4)'
          }}>
            <Database size={20} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Data<span style={{ color: 'var(--accent-cyan)' }}>Forge</span>
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PostgreSQL DBMS
            </p>
          </div>
        </div>

        {/* Quick Action Button */}
        <div style={{ padding: '16px 16px 8px 16px' }}>
          <button
            onClick={() => onNavigate('register-dataset')}
            style={{
              width: '100%',
              backgroundColor: 'rgba(14, 165, 233, 0.12)',
              border: '1px solid rgba(14, 165, 233, 0.4)',
              color: 'var(--accent-cyan)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <PlusCircle size={16} />
            Register Dataset
          </button>
        </div>

        {/* Navigation links */}
        <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          <span style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Main Navigation
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id || (item.id === 'datasets' && (currentTab === 'dataset-detail' || currentTab === 'register-dataset'));
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as NavigationTab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  borderLeft: isActive ? '3px solid var(--accent-cyan)' : '3px solid transparent',
                  transition: 'background 0.15s ease',
                  textAlign: 'left'
                }}
              >
                <Icon size={18} color={isActive ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* System & DB Status footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'rgba(15, 23, 42, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HardDrive size={13} />
              Database
            </span>
            {health?.database === 'connected' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                <CheckCircle size={12} />
                PostgreSQL Live ({health.database_latency_ms}ms)
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent-rose)', fontWeight: 600 }}>
                <AlertTriangle size={12} />
                Disconnected
              </span>
            )}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-card)',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            db: dataforge (pg18)
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header style={{
          height: '64px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              DataForge DBMS Workspace
            </span>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {currentTab.replace('-', ' ')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)' }}></span>
              API Port: 5000 (Proxy active)
            </div>
          </div>
        </header>

        {/* Content View */}
        <main style={{ flex: 1, padding: '32px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

