import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  PieChart as PieIcon,
  Sparkles
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { api } from '../api/client';
import type { AnalyticsSummary, DatasetAnalyticsResponse, ExperimentAnalyticsResponse } from '../types';
import { LoadingSpinner, ErrorState } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface AnalyticsPageProps {
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [datasetAnalytics, setDatasetAnalytics] = useState<DatasetAnalyticsResponse | null>(null);
  const [experimentAnalytics, setExperimentAnalytics] = useState<ExperimentAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, dsRes, expRes] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getDatasetAnalytics(),
        api.getExperimentAnalytics()
      ]);

      setSummary(sumRes);
      setDatasetAnalytics(dsRes);
      setExperimentAnalytics(expRes);
    } catch (err: any) {
      setError(err.message || 'Error communicating with DataForge backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) return <LoadingSpinner message="Querying PostgreSQL aggregation views and statistics..." />;
  if (error || !summary) return <ErrorState title="Analytics Error" message={error || 'Failed to load'} onRetry={fetchAnalytics} />;

  const formatBytes = (bytes: number | string) => {
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(b) || b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const STATUS_COLORS: { [key: string]: string } = {
    COMPLETED: '#10B981',
    RUNNING: '#0EA5E9',
    FAILED: '#F43F5E',
  };

  const projects = datasetAnalytics?.projects || [];
  const statusDistribution = experimentAnalytics?.status_distribution || [];
  const bestExperiments = experimentAnalytics?.best_experiments || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
          DBMS Analytics & Aggregate Views
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Data distribution metrics generated from PostgreSQL materialized views, GROUP BY queries, and SQL window aggregations.
        </p>
      </div>

      {/* Aggregate Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px'
      }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Total Storage Consumed</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--accent-rose)', fontFamily: 'JetBrains Mono, monospace' }}>
            {formatBytes(summary.total_storage_bytes)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>across all committed versions</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Registered Projects</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            {summary.total_projects}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>isolated workspace environments</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Cataloged Datasets</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
            {summary.total_datasets}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {summary.total_dataset_versions} total immutable versions
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Model Architectures</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--accent-indigo)' }}>
            {summary.total_models}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {summary.total_experiments} recorded experiments
          </div>
        </div>
      </div>

      {/* Two Column Visual Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Datasets by Project Bar Chart */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="var(--accent-cyan)" />
            Dataset Distribution Across Projects
          </h3>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projects} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="project_name" stroke="var(--text-muted)" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: '#FFF' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                />
                <Bar dataKey="dataset_count" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Experiment Status Distribution Pie Chart */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieIcon size={18} color="var(--accent-amber)" />
            Experiment Status Breakdown
          </h3>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution.map(i => ({ name: i.status, value: Number(i.count) }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#64748B'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: '#FFF' }}
                />
                <Legend
                  formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Best Experiments Benchmark View */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="var(--accent-emerald)" />
          Top Model Benchmark Performance (Evaluated from PostgreSQL Metric Joins)
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px' }}>Model Name</th>
                <th style={{ padding: '12px 16px' }}>Experiment Run</th>
                <th style={{ padding: '12px 16px' }}>Dataset</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {bestExperiments && bestExperiments.length > 0 ? (
                bestExperiments.map((exp, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(36, 48, 68, 0.4)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {exp.model_name}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {exp.experiment_name}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--accent-cyan)' }}>
                      {exp.dataset_name} ({exp.dataset_version_label})
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                      {Number(exp.accuracy).toFixed(4)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No benchmark metrics found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

