import React, { useEffect, useState } from 'react';
import {
  FolderGit2,
  Database,
  Brain,
  FlaskConical,
  HardDrive,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  GitBranch
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client';
import type { AnalyticsSummary, DatasetAnalyticsResponse, ExperimentAnalyticsResponse, ActivityLog } from '../types';
import { LoadingSpinner, ErrorState } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface DashboardPageProps {
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [datasetAnalytics, setDatasetAnalytics] = useState<DatasetAnalyticsResponse | null>(null);
  const [experimentAnalytics, setExperimentAnalytics] = useState<ExperimentAnalyticsResponse | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, dsRes, expRes, logsRes] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getDatasetAnalytics(),
        api.getExperimentAnalytics(),
        api.getActivityLogs({ limit: 6 })
      ]);

      setSummary(sumRes);
      setDatasetAnalytics(dsRes);
      setExperimentAnalytics(expRes);
      setRecentLogs(logsRes);
    } catch (err: any) {
      setError(err.message || 'Network error fetching dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner message="Querying PostgreSQL analytics views and summaries..." />;
  if (error) return <ErrorState title="Dashboard Error" message={error} onRetry={fetchData} />;
  if (!summary) return null;

  const formatBytes = (bytes: number | string) => {
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(b) || b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const statCards = [
    { label: 'Projects', count: summary.total_projects, icon: FolderGit2, color: 'var(--accent-cyan)', tab: 'projects' },
    { label: 'Datasets', count: summary.total_datasets, icon: Database, color: 'var(--accent-emerald)', tab: 'datasets' },
    { label: 'Dataset Versions', count: summary.total_dataset_versions, icon: GitBranch, color: '#38BDF8', tab: 'datasets' },
    { label: 'Models', count: summary.total_models, icon: Brain, color: 'var(--accent-indigo)', tab: 'models' },
    { label: 'Experiments', count: summary.total_experiments, icon: FlaskConical, color: 'var(--accent-amber)', tab: 'experiments' },
    { label: 'Total Storage', count: formatBytes(summary.total_storage_bytes), icon: HardDrive, color: 'var(--accent-rose)', tab: 'analytics' },
  ];

  const projectDistribution = datasetAnalytics?.projects || [];
  const expStatusDistribution = experimentAnalytics?.status_distribution || [];
  const bestExperiments = experimentAnalytics?.best_experiments || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Hero Welcome banner */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(14, 165, 233, 0.08) 100%)'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Dataset & ML Experiment Lineage System
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '640px' }}>
            Welcome to DataForge. Inspect data evolution across projects, analyze schema changes and drift, track model training configurations, and verify cryptographic reproducibility.
          </p>
        </div>
        <button
          onClick={() => onNavigate('register-dataset')}
          style={{
            backgroundColor: 'var(--accent-cyan)',
            color: '#FFFFFF',
            padding: '12px 22px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(14, 165, 233, 0.3)'
          }}
        >
          <Sparkles size={16} />
          Register New Dataset
        </button>
      </div>

      {/* Primary Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '20px'
      }}>
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigate(card.tab as NavigationTab)}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = card.color;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {card.label}
                </span>
                <div style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                }}>
                  <Icon size={18} color={card.color} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {card.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Charts & Recent Activities */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Datasets by Project Chart */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="var(--accent-cyan)" />
              Dataset Allocation by Project
            </h3>
            <button
              onClick={() => onNavigate('analytics')}
              style={{ fontSize: '12px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
            >
              All Analytics <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="project_name" stroke="var(--text-muted)" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: '#FFF' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                />
                <Bar dataKey="dataset_count" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]}>
                  {projectDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--accent-cyan)' : 'var(--accent-indigo)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Experiment Status Overview */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FlaskConical size={18} color="var(--accent-amber)" />
              Experiment Execution Status
            </h3>
            <button
              onClick={() => onNavigate('experiments')}
              style={{ fontSize: '12px', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
            >
              View Experiments <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {expStatusDistribution.map((item, idx) => {
              const totalExp = Number(summary.total_experiments) || 1;
              const pct = Math.round((Number(item.count) / totalExp) * 100);
              let color = 'var(--text-muted)';
              if (item.status === 'COMPLETED') color = 'var(--accent-emerald)';
              if (item.status === 'RUNNING') color = 'var(--accent-cyan)';
              if (item.status === 'FAILED') color = 'var(--accent-rose)';

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.status}</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Best Performing Models / Experiments and Recent Audit Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Top Experiment Metrics */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--accent-emerald)" />
            Top Model Experiments & Benchmark Metrics
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Model</th>
                  <th style={{ padding: '8px 12px' }}>Experiment</th>
                  <th style={{ padding: '8px 12px' }}>Dataset</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {bestExperiments && bestExperiments.length > 0 ? (
                  bestExperiments.slice(0, 5).map((exp, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(36, 48, 68, 0.4)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {exp.model_name}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {exp.experiment_name}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--accent-cyan)' }}>
                        {exp.dataset_name} ({exp.dataset_version_label})
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                        {Number(exp.accuracy).toFixed(4)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No benchmark metrics available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Audit Feed */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--accent-indigo)" />
              Recent PostgreSQL Activity Logs
            </h3>
            <button
              onClick={() => onNavigate('activity')}
              style={{ fontSize: '12px', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
            >
              Full Log <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: '13px'
                }}
              >
                <div style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  color: 'var(--accent-cyan)',
                  marginTop: '2px'
                }}>
                  {log.action}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {log.entity_type} <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>({log.entity_id.slice(0, 8)}...)</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

