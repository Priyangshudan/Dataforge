import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Database,
  GitCompare,
  Brain,
  FlaskConical,
  GitFork,
  BarChart3,
  History,
  Users,
  Search,
  Plus,
  Sparkles,
  Activity,
  Menu,
  X,
  ArrowRight,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  NavigationTab,
  SystemHealth,
  Project,
  Dataset,
  Model,
  Experiment,
} from '../types';

export type { NavigationTab };

interface AppLayoutProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab, params?: any) => void;
  children: React.ReactNode;
}

interface NavItemConfig {
  id: NavigationTab;
  label: string;
  shortLabel: string;
  group: 'core' | 'ml' | 'intelligence' | 'governance';
  icon: React.ElementType;
  description: string;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Laboratory Overview',
    shortLabel: 'Overview',
    group: 'core',
    icon: LayoutDashboard,
    description: 'Workspace telemetry, version capsules, and experiment timeline',
  },
  {
    id: 'projects',
    label: 'Projects & Workspaces',
    shortLabel: 'Projects',
    group: 'core',
    icon: FolderGit2,
    description: 'Research projects, member assignments, and scoped datasets',
  },
  {
    id: 'datasets',
    label: 'Dataset Catalog',
    shortLabel: 'Datasets',
    group: 'core',
    icon: Database,
    description: 'Registered tabular datasets, storage metrics, and schemas',
  },
  {
    id: 'register-dataset',
    label: 'Register & Upload CSV',
    shortLabel: 'Upload CSV',
    group: 'core',
    icon: Upload,
    description: 'Ingest CSV files, compute SHA-256 hashes, and extract columns',
  },
  {
    id: 'versions',
    label: 'Version History & Diff',
    shortLabel: 'Versions',
    group: 'core',
    icon: GitCompare,
    description: 'Version lineage explorer and side-by-side schema diffing',
  },
  {
    id: 'models',
    label: 'Model Registry',
    shortLabel: 'Models',
    group: 'ml',
    icon: Brain,
    description: 'Machine learning architectures and version checkpoints',
  },
  {
    id: 'experiments',
    label: 'Experiment Tracking',
    shortLabel: 'Experiments',
    group: 'ml',
    icon: FlaskConical,
    description: 'Training runs, evaluation metrics, and benchmark comparisons',
  },
  {
    id: 'lineage',
    label: 'Data Lineage DAG',
    shortLabel: 'Lineage',
    group: 'ml',
    icon: GitFork,
    description: 'Interactive graph of datasets, versions, models, and runs',
  },
  {
    id: 'similarity',
    label: 'Similarity Checking',
    shortLabel: 'Similarity',
    group: 'intelligence',
    icon: Sparkles,
    description: 'Jaccard schema overlap and structural version comparison',
  },
  {
    id: 'drift',
    label: 'Data Drift Analysis',
    shortLabel: 'Drift Lab',
    group: 'intelligence',
    icon: Activity,
    description: 'Statistical numeric distribution shift and drift detection',
  },
  {
    id: 'analytics',
    label: 'DBMS Analytics',
    shortLabel: 'Analytics',
    group: 'governance',
    icon: BarChart3,
    description: 'PostgreSQL aggregate views, storage breakdown, and leaderboards',
  },
  {
    id: 'activity',
    label: 'Activity & Audit Logs',
    shortLabel: 'Audit Logs',
    group: 'governance',
    icon: History,
    description: 'Chronological system journal of mutations and commits',
  },
  {
    id: 'users',
    label: 'Users & Members',
    shortLabel: 'Team',
    group: 'governance',
    icon: Users,
    description: 'Researcher directory and project membership roles',
  },
];

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onNavigate,
  children,
}) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Search Modal State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchEntities, setSearchEntities] = useState<{
    projects: Project[];
    datasets: Dataset[];
    models: Model[];
    experiments: Experiment[];
  }>({ projects: [], datasets: [], models: [], experiments: [] });

  const checkHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await api.getHealth();
      setHealth(res);
    } catch {
      setHealth(null);
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut Cmd+K / Ctrl+K for global search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen]);

  // Load entities when global search opens
  useEffect(() => {
    if (!searchOpen) return;
    let active = true;
    setSearchLoading(true);
    Promise.allSettled([
      api.getProjects(),
      api.getDatasets(),
      api.getModels(),
      api.getExperiments(),
    ])
      .then(([projRes, dsRes, modRes, expRes]) => {
        if (!active) return;
        setSearchEntities({
          projects: projRes.status === 'fulfilled' ? projRes.value : [],
          datasets: dsRes.status === 'fulfilled' ? dsRes.value : [],
          models: modRes.status === 'fulfilled' ? modRes.value : [],
          experiments: expRes.status === 'fulfilled' ? expRes.value : [],
        });
      })
      .finally(() => {
        if (active) setSearchLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchOpen]);

  const isNavItemActive = (id: NavigationTab) => {
    if (currentTab === id) return true;
    if (id === 'datasets' && currentTab === 'dataset-detail') return true;
    return false;
  };

  const q = searchQuery.trim().toLowerCase();
  const matchedNav = NAV_ITEMS.filter(
    (item) =>
      !q ||
      item.label.toLowerCase().includes(q) ||
      item.shortLabel.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
  );
  const matchedProjects = q
    ? searchEntities.projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    : searchEntities.projects.slice(0, 3);
  const matchedDatasets = q
    ? searchEntities.datasets.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q))
      )
    : searchEntities.datasets.slice(0, 4);
  const matchedModels = q
    ? searchEntities.models.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.framework.toLowerCase().includes(q)
      )
    : searchEntities.models.slice(0, 3);
  const matchedExperiments = q
    ? searchEntities.experiments.filter((e) => e.name.toLowerCase().includes(q))
    : searchEntities.experiments.slice(0, 3);

  const isDbConnected = health?.database === 'connected';

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Left Navigation Rail (Reference Visual Direction) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className="df-sidebar-rail"
        style={{
          width: railExpanded ? '248px' : '78px',
          backgroundColor: 'var(--bg-canvas)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: railExpanded ? 'stretch' : 'center',
          padding: '18px 12px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
          transition: 'width var(--transition-normal)',
          flexShrink: 0,
        }}
      >
        {/* Top Geometric Brand Emblem (Inspired by Reference Top-Left Logo) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: railExpanded ? 'space-between' : 'center',
            marginBottom: '20px',
            padding: railExpanded ? '0 4px' : 0,
          }}
        >
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            title="DataForge Home — Laboratory Overview"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img
                src="/dataforge-icon.png"
                alt="DataForge"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
            {railExpanded && (
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  DATA<span style={{ color: 'var(--accent-lime)' }}>FORGE</span>
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}
                >
                  ML &amp; DATA LAB
                </div>
              </div>
            )}
          </button>

          {railExpanded && (
            <button
              type="button"
              onClick={() => setRailExpanded(false)}
              title="Collapse navigation rail"
              className="df-icon-circle"
              style={{ width: '32px', height: '32px' }}
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>

        {/* Navigation Icons / Items */}
        <nav
          aria-label="Workspace Pages"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            overflowY: 'auto',
            alignItems: railExpanded ? 'stretch' : 'center',
            paddingRight: '2px',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item.id);

            if (!railExpanded) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  title={`${item.label} — ${item.description}`}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`df-icon-circle ${active ? 'active' : ''}`}
                >
                  <Icon size={17} />
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: active ? 'var(--accent-lime)' : 'var(--bg-surface)',
                  color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 500,
                  fontSize: '13px',
                  border: `1px solid ${active ? 'var(--accent-lime)' : 'var(--border-subtle)'}`,
                  transition: 'all var(--transition-fast)',
                  textAlign: 'left',
                }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions: Expand toggle + Quick Register (+) Button */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: railExpanded ? 'stretch' : 'center',
            gap: '8px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {!railExpanded && (
            <button
              type="button"
              onClick={() => setRailExpanded(true)}
              title="Expand navigation labels"
              aria-label="Expand sidebar navigation"
              className="df-icon-circle"
              style={{ width: '36px', height: '36px' }}
            >
              <PanelLeftOpen size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('register-dataset')}
            title="Register New Dataset & Upload CSV"
            aria-label="Register New Dataset"
            className={railExpanded ? 'df-btn df-btn-lime' : 'df-icon-circle'}
            style={
              !railExpanded
                ? {
                    width: '42px',
                    height: '42px',
                    backgroundColor:
                      currentTab === 'register-dataset'
                        ? 'var(--accent-lime)'
                        : 'var(--bg-surface)',
                    color:
                      currentTab === 'register-dataset'
                        ? 'var(--text-on-accent)'
                        : 'var(--text-primary)',
                    borderColor: 'var(--border-strong)',
                  }
                : undefined
            }
          >
            <Plus size={19} />
            {railExpanded && <span>Register Dataset</span>}
          </button>
        </div>
      </aside>

      {/* Main Application Column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
        {/* Top Bar with Single-Row Pill Navigation, Search Button & Telemetry Profile */}
        <header
          style={{
            padding: '12px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'nowrap',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            backgroundColor: 'rgba(9, 10, 9, 0.9)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--border-subtle)',
            minWidth: 0,
          }}
        >
          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="df-icon-circle df-mobile-menu-trigger"
            style={{ display: 'none', flexShrink: 0 }}
          >
            <Menu size={18} />
          </button>

          {/* Compact Pill-Shaped Navigation Bar (Single Line with Intentional Horizontal Scroll) */}
          <div
            role="navigation"
            aria-label="Quick Workspace Switcher"
            className="df-nav-scroll"
          >
            {[
              { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
              { id: 'projects', label: 'Projects', icon: FolderGit2 },
              { id: 'datasets', label: 'Datasets', icon: Database },
              { id: 'versions', label: 'Versions', icon: GitCompare },
              { id: 'models', label: 'Models', icon: Brain },
              { id: 'experiments', label: 'Experiments', icon: FlaskConical },
              { id: 'lineage', label: 'Lineage', icon: GitFork },
              { id: 'similarity', label: 'Similarity', icon: Sparkles },
              { id: 'drift', label: 'Drift Lab', icon: Activity },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'activity', label: 'Audit', icon: History },
              { id: 'users', label: 'Users', icon: Users },
            ].map((pill) => {
              const Icon = pill.icon;
              const active = isNavItemActive(pill.id as NavigationTab);
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => onNavigate(pill.id as NavigationTab)}
                  className={`df-pill-control ${active ? 'active' : ''}`}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    backgroundColor: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon
                    size={14}
                    color={active ? 'var(--accent-lime)' : 'var(--text-secondary)'}
                  />
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Action Cluster: Search Button + PostgreSQL Telemetry Profile */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            {/* Circular Search Trigger (Reference Image Top Search Button) */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Global Search & Command Palette (Cmd+K)"
              aria-label="Search datasets, projects, models, and pages"
              className="df-icon-circle"
              style={{ width: '36px', height: '36px' }}
            >
              <Search size={16} />
            </button>

            <button
              type="button"
              onClick={checkHealth}
              title="Click to re-verify PostgreSQL & API health (/api/health)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textAlign: 'right',
                padding: '3px 6px',
                borderRadius: 'var(--radius-pill)',
                flexShrink: 0,
              }}
            >
              <div className="df-health-meta">
                <div
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isDbConnected ? 'PostgreSQL Active' : 'PostgreSQL Offline'}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '10.5px',
                    color: isDbConnected ? 'var(--accent-lime)' : 'var(--accent-amber)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {checkingHealth
                    ? 'probing /api/health...'
                    : isDbConnected
                      ? `@dataforge • ${health?.database_latency_ms ?? 0}ms`
                      : '@api:5000 • check db'}
                </div>
              </div>

              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-surface)',
                    border: `2px solid ${
                      isDbConnected ? 'var(--accent-lime)' : 'var(--accent-amber)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                  }}
                >
                  PG
                </div>
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    minWidth: '17px',
                    height: '17px',
                    borderRadius: '999px',
                    backgroundColor: isDbConnected
                      ? 'var(--accent-lime)'
                      : 'var(--accent-amber)',
                    color: 'var(--text-on-accent)',
                    fontSize: '9.5px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {isDbConnected ? 'UP' : '!'}
                </span>
              </div>
            </button>
          </div>
        </header>

        {/* Main Workspace Canvas — Expands Across Available Viewport Width */}
        <main
          style={{
            flex: 1,
            padding: '20px 28px 40px 28px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          }}
        >
          {children}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(9, 10, 9, 0.85)',
            zIndex: 6000,
            display: 'flex',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '280px',
              backgroundColor: 'var(--bg-surface)',
              borderRight: '1px solid var(--border)',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <img
                src="/dataforge-logo.png"
                alt="DataForge"
                style={{
                  height: '40px',
                  maxWidth: '160px',
                  objectFit: 'contain',
                }}
              />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="df-icon-circle"
                style={{ width: '34px', height: '34px' }}
              >
                <X size={16} />
              </button>
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: active ? 'var(--accent-lime)' : 'var(--bg-card)',
                    color: active ? 'var(--text-on-accent)' : 'var(--text-primary)',
                    fontWeight: active ? 700 : 500,
                    fontSize: '13.5px',
                  }}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Global Search & Command Modal */}
      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Global Search and Command Palette"
          onClick={() => setSearchOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(9, 10, 9, 0.82)',
            backdropFilter: 'blur(6px)',
            zIndex: 7000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px 16px 24px 16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: '0 28px 64px rgba(0, 0, 0, 0.85)',
            }}
          >
            {/* Search Input Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <Search size={18} color="var(--accent-lime)" />
              <input
                type="text"
                autoFocus
                placeholder="Jump to page or search datasets, projects, models, experiments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '14.5px',
                }}
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="font-mono"
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                ESC
              </button>
            </div>

            {/* Search Results Body */}
            <div
              style={{
                maxHeight: '65vh',
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Matched Datasets */}
              {matchedDatasets.length > 0 && (
                <div>
                  <div
                    className="font-display"
                    style={{
                      fontSize: '13px',
                      color: 'var(--accent-lime)',
                      letterSpacing: '0.06em',
                      marginBottom: '8px',
                    }}
                  >
                    DATASETS ({matchedDatasets.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchedDatasets.map((ds) => (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => {
                          onNavigate('dataset-detail', { datasetId: ds.id });
                          setSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          textAlign: 'left',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {ds.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {ds.project_name || 'Project'} &bull; {ds.total_versions ?? 0} versions
                          </div>
                        </div>
                        <ArrowRight size={15} color="var(--accent-lime)" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Projects */}
              {matchedProjects.length > 0 && (
                <div>
                  <div
                    className="font-display"
                    style={{
                      fontSize: '13px',
                      color: 'var(--accent-amber)',
                      letterSpacing: '0.06em',
                      marginBottom: '8px',
                    }}
                  >
                    PROJECTS ({matchedProjects.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchedProjects.map((proj) => (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => {
                          onNavigate('projects', { projectId: proj.id });
                          setSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          textAlign: 'left',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {proj.name}
                          </div>
                          <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            /{proj.slug}
                          </div>
                        </div>
                        <ArrowRight size={15} color="var(--accent-amber)" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Models & Experiments */}
              {(matchedModels.length > 0 || matchedExperiments.length > 0) && (
                <div>
                  <div
                    className="font-display"
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      letterSpacing: '0.06em',
                      marginBottom: '8px',
                    }}
                  >
                    MODELS &amp; EXPERIMENTS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchedModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onNavigate('models', { modelId: m.id });
                          setSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 14px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          textAlign: 'left',
                        }}
                      >
                        <span>
                          <strong>{m.name}</strong>{' '}
                          <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ({m.framework})
                          </span>
                        </span>
                        <ArrowRight size={14} color="var(--text-secondary)" />
                      </button>
                    ))}
                    {matchedExperiments.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          onNavigate('experiments', { experimentId: e.id });
                          setSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 14px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          textAlign: 'left',
                        }}
                      >
                        <span>
                          <strong>{e.name}</strong>{' '}
                          <span className="font-mono" style={{ fontSize: '11px', color: 'var(--accent-lime)' }}>
                            [{e.status}]
                          </span>
                        </span>
                        <ArrowRight size={14} color="var(--text-secondary)" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation Pages */}
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                    marginBottom: '8px',
                  }}
                >
                  WORKSPACE NAVIGATION ({matchedNav.length})
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '8px',
                  }}
                >
                  {matchedNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          setSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          textAlign: 'left',
                        }}
                      >
                        <Icon size={16} color="var(--accent-lime)" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {item.label}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {searchLoading && (
                <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Synchronizing live catalog entities...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1180px) {
          .df-health-meta {
            display: none !important;
          }
        }
        @media (max-width: 900px) {
          .df-sidebar-rail {
            display: none !important;
          }
          .df-mobile-menu-trigger {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
};
