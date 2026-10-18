import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type {
  AnalyticsSummary,
  ProjectAnalyticsItem,
  Dataset,
  ExperimentAnalyticsResponse,
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
  DeltaStat,
  formatBytes,
} from '../components/Common';
import {
  BarChart3,
  Award,
  Cpu,
} from 'lucide-react';

interface AnalyticsPageProps {
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectAnalyticsItem[]>([]);
  const [topDatasets, setTopDatasets] = useState<Dataset[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<
    ExperimentAnalyticsResponse['status_distribution']
  >([]);
  const [bestExperiments, setBestExperiments] = useState<
    ExperimentAnalyticsResponse['best_experiments']
  >([]);
  const [highPerfModels, setHighPerfModels] = useState<
    ExperimentAnalyticsResponse['high_performing_models']
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, dsRes, expRes] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getDatasetAnalytics(),
        api.getExperimentAnalytics(),
      ]);

      setSummary(sumRes || null);
      setProjectStats(dsRes?.projects || []);
      setTopDatasets(dsRes?.top_datasets || []);
      setStatusBreakdown(expRes?.status_distribution || []);
      setBestExperiments(expRes?.best_experiments || []);
      setHighPerfModels(expRes?.high_performing_models || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load database analytics views');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading && !summary) {
    return (
      <LoadingSpinner message="Querying PostgreSQL analytical views & CTE aggregations..." />
    );
  }

  if (error && !summary) {
    return <ErrorState message={error} onRetry={loadAnalytics} />;
  }

  const maxProjectStorage = Math.max(
    1,
    ...projectStats.map((p) => Number(p.total_storage_bytes || 0))
  );
  const maxDatasetRows = Math.max(
    1,
    ...topDatasets.map((d) => Number(d.latest_row_count || 0))
  );

  const bestAcc = bestExperiments.length > 0 ? bestExperiments[0].accuracy : null;
  const bestF1 = bestExperiments.length > 0 ? bestExperiments[0].f1_score : null;

  return (
    <div>
      <PageHeader
        eyebrow="POSTGRESQL ANALYTICAL VIEWS & CTE AGGREGATIONS"
        title="LABORATORY ANALYTICS"
        subtitle="Cross-project storage telemetry, dataset version density, experiment status distributions, and high-performing model leaderboards."
      />

      {/* Top Strip: 4 High-Contrast Database Telemetry Blocks */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <Panel>
            <div className="df-card-label">PEAK MODEL ACCURACY</div>
            <div
              className="df-stat-number df-stat-number--lg"
              style={{ color: 'var(--accent-lime)', marginTop: 8 }}
            >
              {bestAcc !== null && bestAcc !== undefined
                ? `${(Number(bestAcc) * 100).toFixed(2)}%`
                : '—'}
            </div>
            <div style={{ marginTop: 10 }}>
              <DeltaStat
                delta={
                  bestF1 ? `Peak F1: ${(Number(bestF1) * 100).toFixed(1)}%` : 'No metrics yet'
                }
                positive
                label="across completed runs"
              />
            </div>
          </Panel>

          <Panel>
            <div className="df-card-label">TOTAL STORAGE FOOTPRINT</div>
            <div className="df-stat-number df-stat-number--lg" style={{ marginTop: 8 }}>
              {formatBytes(Number(summary.total_storage_bytes || 0))}
            </div>
            <div style={{ marginTop: 10 }}>
              <DeltaStat
                delta={`${summary.total_dataset_versions} versions`}
                positive
                label={`in ${summary.total_datasets} datasets`}
              />
            </div>
          </Panel>

          <Panel>
            <div className="df-card-label">EXPERIMENT EXECUTIONS</div>
            <div
              className="df-stat-number df-stat-number--lg"
              style={{ color: 'var(--accent-amber)', marginTop: 8 }}
            >
              {summary.total_experiments}
            </div>
            <div style={{ marginTop: 10 }}>
              <DeltaStat
                delta={`${bestExperiments.length} ranked`}
                positive
                label="on leaderboard"
              />
            </div>
          </Panel>

          <Panel>
            <div className="df-card-label">MODEL REGISTRY DENSITY</div>
            <div className="df-stat-number df-stat-number--lg" style={{ marginTop: 8 }}>
              {summary.total_models}
            </div>
            <div style={{ marginTop: 10 }}>
              <DeltaStat
                delta={`${summary.total_projects} projects`}
                positive
                label="active workspaces"
              />
            </div>
          </Panel>
        </div>
      )}

      {/* Middle Row: Project Resource Comparison (7 cols) + Experiment Status Breakdown (5 cols) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ gridColumn: 'span 7' }} className="df-col-full-mobile">
          <Panel
            title="PROJECT RESOURCE & VERSION BREAKDOWN"
            subtitle="Aggregated via PostgreSQL v_project_summary view"
            rightSlot={
              <div style={{ display: 'flex', gap: 14 }}>
                <RingLegend label="STORAGE" color="lime" />
                <RingLegend label="VERSIONS" color="amber" />
              </div>
            }
          >
            {projectStats.length === 0 ? (
              <EmptyState
                icon={<BarChart3 size={22} />}
                title="No Project Analytics"
                description="Create projects and register datasets to populate project summary views."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {projectStats.map((proj) => {
                  const storagePct = Math.max(
                    8,
                    Math.round((Number(proj.total_storage_bytes || 0) / maxProjectStorage) * 100)
                  );
                  const versionPct = Math.min(100, Number(proj.version_count || 0) * 15);

                  return (
                    <div
                      key={proj.project_id}
                      onClick={() => onNavigate('projects', { projectId: proj.project_id })}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 14,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, color: '#FFF', fontSize: '0.9rem' }}>
                            {proj.project_name}
                          </span>
                          <span className="df-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {proj.owner_name}
                          </span>
                        </div>
                        <div
                          className="df-mono"
                          style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}
                        >
                          {proj.dataset_count} DS · {proj.version_count} Ver · {proj.model_count}{' '}
                          Mod
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 110px',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div
                            style={{
                              height: 8,
                              borderRadius: 999,
                              background: 'rgba(255,255,255,0.06)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${storagePct}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: 'var(--accent-lime)',
                              }}
                            />
                          </div>
                          <div
                            style={{
                              height: 6,
                              borderRadius: 999,
                              background: 'rgba(255,255,255,0.06)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${versionPct}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: 'var(--accent-amber)',
                              }}
                            />
                          </div>
                        </div>

                        <div className="df-mono" style={{ textAlign: 'right', fontSize: '0.72rem' }}>
                          <div style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>
                            {formatBytes(Number(proj.total_storage_bytes || 0))}
                          </div>
                          <div style={{ color: 'var(--accent-amber)' }}>
                            {proj.version_count} versions
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* Right 5 cols: Experiment Status Distribution & Top Datasets */}
        <div
          style={{
            gridColumn: 'span 5',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
          className="df-col-full-mobile"
        >
          <Panel
            title="EXPERIMENT EXECUTION DISTRIBUTION"
            subtitle="Grouped by run status"
          >
            {statusBreakdown.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No experiment telemetry recorded.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {statusBreakdown.map((item) => (
                  <div
                    key={item.status}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <StatusBadge status={item.status} />
                    <span className="df-stat-number df-stat-number--sm">
                      {item.count} runs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="DATASET SCALE CAPSULES"
            subtitle="Ranked by row cardinality and version count"
          >
            {topDatasets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No datasets available.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topDatasets.slice(0, 4).map((ds) => {
                  const pct = Math.max(
                    12,
                    Math.round((Number(ds.latest_row_count || 0) / maxDatasetRows) * 100)
                  );
                  return (
                    <div
                      key={ds.id}
                      onClick={() => onNavigate('dataset-detail', { datasetId: ds.id })}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#FFF' }}>{ds.name}</span>
                        <span
                          className="df-mono"
                          style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}
                        >
                          {Number(ds.latest_row_count || 0).toLocaleString()} rows ·{' '}
                          {ds.total_versions || 0}v ·{' '}
                          {formatBytes(Number(ds.total_storage_bytes || 0))}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 10,
                          borderRadius: 999,
                          background: 'var(--bg-elevated)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 999,
                            background:
                              'linear-gradient(90deg, var(--accent-lime), var(--accent-amber))',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Bottom Row: High-Performing Models CTE Table + Top Experiments Leaderboard */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        <div style={{ gridColumn: 'span 6' }} className="df-col-full-mobile">
          <Panel
            title="HIGH-PERFORMING MODEL ARCHITECTURES"
            subtitle="PostgreSQL CTE & HAVING aggregation across completed evaluation runs"
            rightSlot={<RingLegend label="SQL CTE" color="lime" />}
          >
            {highPerfModels.length === 0 ? (
              <EmptyState
                icon={<Cpu size={20} />}
                title="No Converged Model Benchmarks"
                description="Complete experiment runs with logged accuracy metrics to populate the model leaderboard."
              />
            ) : (
              <div className="df-table-wrapper">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th>MODEL</th>
                      <th>FRAMEWORK</th>
                      <th>RUNS</th>
                      <th>AVG ACC</th>
                      <th>MIN LOSS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highPerfModels.map((m, idx) => (
                      <tr
                        key={`${m.model_name}-${idx}`}
                        onClick={() => onNavigate('models')}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ fontWeight: 700, color: '#FFF' }}>{m.model_name}</div>
                        </td>
                        <td>
                          <StatusBadge status={m.framework || 'ML'} size="sm" />
                        </td>
                        <td className="df-mono">{m.completed_experiments}</td>
                        <td
                          className="df-mono"
                          style={{ color: 'var(--accent-lime)', fontWeight: 700 }}
                        >
                          {(Number(m.avg_accuracy || 0) * 100).toFixed(2)}%
                        </td>
                        <td className="df-mono" style={{ color: 'var(--accent-amber)' }}>
                          {m.min_loss !== null && m.min_loss !== undefined
                            ? Number(m.min_loss).toFixed(4)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div style={{ gridColumn: 'span 6' }} className="df-col-full-mobile">
          <Panel
            title="TOP EXPERIMENT LEADERBOARD"
            subtitle="Ranked by accuracy across all projects (v_experiment_leaderboard)"
            rightSlot={<RingLegend label="TOP RUNS" color="amber" />}
          >
            {bestExperiments.length === 0 ? (
              <EmptyState
                icon={<Award size={20} />}
                title="No Completed Experiments Ranked"
                description="Run and complete experiments with accuracy telemetry."
              />
            ) : (
              <div className="df-table-wrapper">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>EXPERIMENT</th>
                      <th>MODEL · DATASET</th>
                      <th>ACCURACY</th>
                      <th>F1 / AUC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestExperiments.map((exp, idx) => (
                      <tr
                        key={exp.experiment_id}
                        onClick={() =>
                          onNavigate('experiments', { experimentId: exp.experiment_id })
                        }
                        style={{ cursor: 'pointer' }}
                      >
                        <td
                          className="df-mono"
                          style={{
                            color: idx === 0 ? 'var(--accent-lime)' : 'var(--text-muted)',
                            fontWeight: 700,
                          }}
                        >
                          0{idx + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#FFF' }}>
                            {exp.experiment_name}
                          </div>
                        </td>
                        <td className="df-mono" style={{ fontSize: '0.74rem' }}>
                          <div>
                            {exp.model_name} ({exp.model_version_label})
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {exp.dataset_name} ({exp.dataset_version_label})
                          </div>
                        </td>
                        <td
                          className="df-mono"
                          style={{ color: 'var(--accent-lime)', fontWeight: 700 }}
                        >
                          {(Number(exp.accuracy || 0) * 100).toFixed(2)}%
                        </td>
                        <td className="df-mono" style={{ fontSize: '0.74rem' }}>
                          <div>
                            F1: {exp.f1_score ? Number(exp.f1_score).toFixed(3) : '—'}
                          </div>
                          <div style={{ color: 'var(--accent-amber)' }}>
                            AUC: {exp.roc_auc ? Number(exp.roc_auc).toFixed(3) : '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};
