import React, { useEffect, useState } from 'react';
import {
  Database,
  Brain,
  GitFork,
  GitCompare,
  Sparkles,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Plus,
  History,
  FolderGit2,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  AnalyticsSummary,
  DatasetAnalyticsResponse,
  ExperimentAnalyticsResponse,
  ActivityLog,
  NavigationTab,
} from '../types';
import {
  LoadingSpinner,
  ErrorState,
  EmptyState,
  Panel,
  DeltaStat,
  StatusBadge,
  formatBytes,
  formatShortDate,
  formatDateTime,
} from '../components/Common';

interface DashboardPageProps {
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [datasetAnalytics, setDatasetAnalytics] = useState<DatasetAnalyticsResponse | null>(null);
  const [experimentAnalytics, setExperimentAnalytics] =
    useState<ExperimentAnalyticsResponse | null>(null);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');
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
        api.getActivityLogs({ limit: 6 }),
      ]);

      setSummary(sumRes);
      setDatasetAnalytics(dsRes);
      setExperimentAnalytics(expRes);
      setRecentLogs(logsRes);
    } catch (err: any) {
      setError(err.message || 'Unable to reach DataForge backend (/api/analytics/summary)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <LoadingSpinner message="Aggregating PostgreSQL views, version capsules, and experiment benchmarks..." />
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <h2 className="df-page-title">LABORATORY OVERVIEW</h2>
          <button onClick={fetchData} className="df-btn df-btn-lime">
            <RefreshCw size={15} /> Retry Connection
          </button>
        </div>
        <ErrorState
          title="Telemetry Stream Unavailable"
          message={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  if (!summary) return null;

  const totalProjects = Number(summary.total_projects || 0);
  const totalDatasets = Number(summary.total_datasets || 0);
  const totalVersions = Number(summary.total_dataset_versions || 0);
  const totalModels = Number(summary.total_models || 0);
  const totalExperiments = Number(summary.total_experiments || 0);
  const totalStorageBytes = Number(summary.total_storage_bytes || 0);

  const projectsList = datasetAnalytics?.projects || [];
  const allTopDatasets = datasetAnalytics?.top_datasets || [];
  const filteredDatasets =
    selectedProjectFilter === 'ALL'
      ? allTopDatasets
      : allTopDatasets.filter((d) => d.project_id === selectedProjectFilter);

  const statusDistribution = experimentAnalytics?.status_distribution || [];
  const bestExperiments = experimentAnalytics?.best_experiments || [];
  const highPerformingModels = experimentAnalytics?.high_performing_models || [];

  const completedCount = Number(
    statusDistribution.find((s) => s.status.toUpperCase() === 'COMPLETED')?.count || 0
  );
  const completionPct =
    totalExperiments > 0 ? ((completedCount / totalExperiments) * 100).toFixed(1) : '0.0';

  const avgBestAcc =
    bestExperiments.length > 0
      ? (
          (bestExperiments.reduce((acc, item) => acc + Number(item.accuracy || 0), 0) /
            bestExperiments.length) *
          100
        ).toFixed(1)
      : '0.0';

  // Build dual-line SVG points from actual project/dataset counts
  const chartPointsSource =
    projectsList.length > 0
      ? projectsList.map((p) => ({
          a: Number(p.dataset_count || 0),
          b: Number(p.version_count || 0),
        }))
      : [{ a: 0, b: 0 }];

  const buildSvgPolyline = (values: number[], width: number, height: number) => {
    if (values.length === 0) return `0,${height - 8} ${width},${height - 8}`;
    if (values.length === 1) {
      const y = values[0] > 0 ? height / 2 : height - 10;
      return `0,${y} ${width},${y}`;
    }
    const maxVal = Math.max(...values, 1);
    return values
      .map((val, idx) => {
        const x = (idx / (values.length - 1)) * width;
        const y = height - 12 - (val / maxVal) * (height - 28);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const limePoly = buildSvgPolyline(
    chartPointsSource.map((p) => p.b),
    280,
    74
  );
  const amberPoly = buildSvgPolyline(
    chartPointsSource.map((p) => p.a),
    280,
    74
  );

  // Build Dot Matrix (8 cols x 4 rows = 32 dots) representing real catalog composition
  const totalEntities = Math.max(totalDatasets + totalVersions + totalModels + totalExperiments, 1);
  const limeDots = Math.round((totalVersions / totalEntities) * 32);
  const amberDots = Math.round((totalExperiments / totalEntities) * 32);
  const whiteDots = Math.round(((totalDatasets + totalModels) / totalEntities) * 32);

  const dotMatrix = Array.from({ length: 32 }, (_, idx) => {
    if (totalDatasets + totalVersions + totalModels + totalExperiments === 0) return 'muted';
    if (idx < limeDots) return 'lime';
    if (idx < limeDots + amberDots) return 'amber';
    if (idx < limeDots + amberDots + whiteDots) return 'white';
    return 'muted';
  });

  // Prepare vertical capsule columns from actual datasets (or projects if datasets empty)
  const capsuleItems = filteredDatasets.slice(0, 8);

  // Prepare horizontal timeline pill items from actual best experiments & recent datasets
  const timelineItems = [
    ...bestExperiments.slice(0, 5).map((exp, idx) => ({
      id: exp.experiment_id,
      dateLabel: `RUN 0${idx + 1}`,
      title: exp.experiment_name,
      subtitle: `${exp.model_name} (${exp.model_version_label})`,
      metricNum: Number((Number(exp.accuracy || 0) * 100).toFixed(1)),
      metricDisplay: `${(Number(exp.accuracy || 0) * 100).toFixed(1)}%`,
      tone: (idx % 3 === 0 ? 'lime' : idx % 3 === 1 ? 'amber' : 'white') as
        | 'lime'
        | 'amber'
        | 'white',
      navTab: 'experiments' as NavigationTab,
      navParams: { experimentId: exp.experiment_id },
    })),
    ...filteredDatasets.slice(0, Math.max(0, 7 - bestExperiments.length)).map((ds, idx) => ({
      id: ds.id,
      dateLabel: formatShortDate(ds.created_at),
      title: ds.name,
      subtitle: ds.project_name || ds.type,
      metricNum: Math.min(100, Math.max(22, Number(ds.total_versions || 1) * 28)),
      metricDisplay: `v${ds.latest_version_number || 1}`,
      tone: (idx % 2 === 0 ? 'lime' : 'white') as 'lime' | 'amber' | 'white',
      navTab: 'dataset-detail' as NavigationTab,
      navParams: { datasetId: ds.id },
    })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0 }}>
      {/* Reference-Inspired Header Bar with Condensed Title & Pill Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <h1 className="df-page-title">DATAFORGE LAB</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>
            Cryptographic dataset versioning, schema lineage, and reproducible ML experiment telemetry
          </p>
        </div>

        {/* Right Filter Pills (Directly Inspired by Reference Top-Right Pill Controls) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="df-pill-control" style={{ padding: '6px 14px' }}>
            <span style={{ color: 'var(--text-muted)' }}>State:</span>
            <strong style={{ color: 'var(--text-primary)' }}>Live DB</strong>
          </div>

          <label
            className="df-pill-control"
            style={{ padding: '6px 14px', cursor: 'pointer' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Project:</span>
            <select
              aria-label="Filter dashboard by project"
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="ALL" style={{ backgroundColor: 'var(--bg-surface)' }}>
                All ({totalProjects})
              </option>
              {projectsList.map((p) => (
                <option
                  key={p.project_id}
                  value={p.project_id}
                  style={{ backgroundColor: 'var(--bg-surface)' }}
                >
                  {p.project_name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => onNavigate('register-dataset')}
            className="df-btn df-btn-lime"
          >
            <Plus size={16} />
            Register Dataset
          </button>

          <button
            type="button"
            onClick={fetchData}
            title="Refresh PostgreSQL telemetry"
            aria-label="Refresh dashboard data"
            className="df-icon-circle"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Main Asymmetric Dashboard Grid (Reference Composition) */}
      <div className="df-dashboard-grid">
        {/* Left Column: 2-Up Top Metric Panels + Bottom Vertical Capsule Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
          <div className="df-subgrid-2">
            {/* Top-Left Panel: Catalog Velocity + Dual Line Chart */}
            <Panel
              title="CATALOG VELOCITY"
              rightSlot={
                <button
                  type="button"
                  onClick={() => onNavigate('datasets')}
                  className="df-btn-ghost"
                  style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '12px' }}
                >
                  Catalog <ArrowUpRight size={13} />
                </button>
              }
              style={{ paddingBottom: '16px' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '16px',
                  marginBottom: '14px',
                }}
              >
                <DeltaStat
                  direction="up"
                  accent="lime"
                  value={totalDatasets}
                  label="Cataloged Datasets"
                  sublabel={`${totalProjects} projects`}
                />
                <DeltaStat
                  direction="down"
                  accent="amber"
                  value={totalVersions}
                  label="Version Commits"
                  sublabel={formatBytes(totalStorageBytes)}
                />
              </div>

              {/* Crisp Thin Dual-Line SVG Sparkline */}
              <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                <svg
                  viewBox="0 0 280 74"
                  width="100%"
                  height="68"
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible', display: 'block' }}
                  aria-label="Dataset and version distribution line chart"
                >
                  <line
                    x1="0"
                    y1="70"
                    x2="280"
                    y2="70"
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                  <polyline
                    fill="none"
                    stroke="var(--accent-lime)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={limePoly}
                  />
                  <polyline
                    fill="none"
                    stroke="var(--accent-amber)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={amberPoly}
                  />
                </svg>
              </div>
            </Panel>

            {/* Top-Middle Panel: Execution Matrix + Dot Matrix Grid */}
            <Panel
              title="EXECUTION MATRIX"
              rightSlot={
                <button
                  type="button"
                  onClick={() => onNavigate('models')}
                  className="df-btn-ghost"
                  style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '12px' }}
                >
                  Registry <ArrowUpRight size={13} />
                </button>
              }
              style={{ paddingBottom: '16px' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '16px',
                  marginBottom: '14px',
                }}
              >
                <DeltaStat
                  direction="up"
                  accent="lime"
                  value={`${completionPct}%`}
                  label="Run Completion"
                  sublabel={`${totalExperiments} total runs`}
                />
                <DeltaStat
                  direction="down"
                  accent="amber"
                  value={`${avgBestAcc}%`}
                  label="Mean Top Accuracy"
                  sublabel={`${totalModels} models`}
                />
              </div>

              {/* Reference-Inspired Dot Matrix Visualization */}
              <div
                aria-label="Entity composition dot matrix"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '9px',
                  marginTop: 'auto',
                  paddingTop: '8px',
                }}
              >
                {dotMatrix.map((tone, i) => {
                  const color =
                    tone === 'lime'
                      ? 'var(--accent-lime)'
                      : tone === 'amber'
                        ? 'var(--accent-amber)'
                        : tone === 'white'
                          ? 'var(--text-primary)'
                          : 'var(--bg-elevated)';
                  return (
                    <span
                      key={i}
                      style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        justifySelf: 'center',
                      }}
                    />
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* Bottom-Left Wide Panel: Vertical Pill Capsule Chart (Inspired by Reference Bottom-Left PRODUCT Panel) */}
          <Panel
            title="DATASET VERSION CAPSULES"
            subtitle="Vertical capsule matrix of version counts, row density, and storage footprint per dataset"
            rightSlot={
              <button
                type="button"
                onClick={() => onNavigate('versions')}
                className="df-btn-ghost"
                style={{ fontSize: '12px', borderRadius: '999px' }}
              >
                Compare Versions <ArrowUpRight size={13} />
              </button>
            }
            legend={[
              { label: 'Rows / Schema', color: 'white' },
              { label: 'Committed Versions', color: 'lime' },
              { label: 'Storage Footprint', color: 'amber' },
            ]}
            totalLabel="Total Storage"
            totalValue={formatBytes(totalStorageBytes)}
          >
            {capsuleItems.length === 0 ? (
              <EmptyState
                title="No Datasets Registered Yet"
                description="Register your first CSV dataset to populate the vertical version capsule matrix."
                actionText="Register Dataset"
                onAction={() => onNavigate('register-dataset')}
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.max(capsuleItems.length, 4)}, minmax(64px, 1fr))`,
                  gap: '12px',
                  alignItems: 'center',
                  minHeight: '210px',
                  padding: '8px 4px',
                  overflowX: 'auto',
                }}
              >
                {capsuleItems.map((ds, idx) => {
                  const verCount = Number(ds.total_versions || 1);
                  const rowCount = Number(ds.latest_row_count || 0);
                  const bytes = Number(ds.total_storage_bytes || 0);
                  const kb = Math.max(1, Math.round(bytes / 1024));

                  // Compute proportional capsule heights bounded between 42px and 80px
                  const topHeight = Math.min(80, Math.max(42, 38 + verCount * 12));
                  const bottomHeight = Math.min(
                    78,
                    Math.max(42, 38 + Math.min(38, Math.round(Math.log10(Math.max(rowCount, 10)) * 10)))
                  );

                  const topTone = idx % 3 === 0 ? 'white' : idx % 3 === 1 ? 'lime' : 'amber';
                  const bottomTone = idx % 3 === 0 ? 'amber' : idx % 3 === 1 ? 'white' : 'lime';

                  const getFill = (t: string) =>
                    t === 'lime'
                      ? 'var(--accent-lime)'
                      : t === 'amber'
                        ? 'var(--accent-amber)'
                        : 'var(--text-primary)';

                  return (
                    <button
                      key={ds.id}
                      type="button"
                      onClick={() => onNavigate('dataset-detail', { datasetId: ds.id })}
                      title={`${ds.name} — ${verCount} versions, ${rowCount.toLocaleString()} rows, ${formatBytes(bytes)}`}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        height: '198px',
                        padding: '4px 0',
                      }}
                    >
                      {/* Vertical Axis Guide Line */}
                      <div
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: '4px',
                          bottom: '22px',
                          left: '50%',
                          width: '1px',
                          backgroundColor: 'var(--border-strong)',
                          transform: 'translateX(-50%)',
                          zIndex: 0,
                        }}
                      />

                      {/* Top Capsule */}
                      <div
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '38px',
                          height: `${topHeight}px`,
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: getFill(topTone),
                          color: 'var(--text-on-accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          fontWeight: 700,
                          boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
                        }}
                      >
                        v{verCount}
                      </div>

                      {/* Center Indicator Dot */}
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: getFill(idx % 2 === 0 ? 'lime' : 'amber'),
                        }}
                      />

                      {/* Bottom Capsule */}
                      <div
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '38px',
                          height: `${bottomHeight}px`,
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: getFill(bottomTone),
                          color: 'var(--text-on-accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
                        }}
                      >
                        {rowCount > 999 ? `${(rowCount / 1000).toFixed(1)}k` : rowCount || `${kb}K`}
                      </div>

                      {/* Dataset Short Label */}
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          fontWeight: 600,
                          maxWidth: '82px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px',
                        }}
                      >
                        {ds.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* Right Column Tall Panel: Horizontal Pill Timeline (Inspired by Reference PROJECTS TIMELINE) */}
        <Panel
          title="EXPERIMENTS & LINEAGE TIMELINE"
          subtitle="Benchmark accuracy & version milestones across active models and datasets"
          rightSlot={
            <button
              type="button"
              onClick={() => onNavigate('experiments')}
              className="df-btn-ghost"
              style={{ fontSize: '12px', borderRadius: '999px' }}
            >
              All Runs <ArrowUpRight size={13} />
            </button>
          }
          legend={[
            { label: 'Validated Benchmark', color: 'lime' },
            { label: 'Active / Retrained', color: 'amber' },
            { label: 'Baseline Artifact', color: 'white' },
          ]}
          totalLabel="Total Runs"
          totalValue={totalExperiments}
        >
          {timelineItems.length === 0 ? (
            <EmptyState
              title="No Experiment Runs Recorded"
              description="Create a model checkpoint and execute an experiment run to visualize performance bars."
              actionText="Open Experiments"
              onAction={() => onNavigate('experiments')}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                flex: 1,
                gap: '16px',
                padding: '10px 0 6px 0',
              }}
            >
              {/* Rows with Left Date/Run Label and Horizontal Pill Bar */}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  flex: 1,
                  justifyContent: 'center',
                }}
              >
                {timelineItems.map((item, idx) => {
                  const fill =
                    item.tone === 'lime'
                      ? 'var(--accent-lime)'
                      : item.tone === 'amber'
                        ? 'var(--accent-amber)'
                        : 'var(--text-primary)';
                  const widthPct = Math.min(82, Math.max(36, item.metricNum * 0.72));
                  const offsetPct = Math.min(
                    100 - widthPct,
                    (idx * 13) % Math.max(12, Math.floor(96 - widthPct))
                  );

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '64px 1fr',
                        alignItems: 'center',
                        gap: '14px',
                      }}
                    >
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        {item.dateLabel}
                      </span>

                      <div
                        style={{
                          position: 'relative',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          borderLeft: '1px dashed var(--border-strong)',
                          borderRight: '1px dashed var(--border-subtle)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onNavigate(item.navTab, item.navParams)}
                          title={`${item.title} — ${item.subtitle} (${item.metricDisplay})`}
                          style={{
                            marginLeft: `${offsetPct}%`,
                            width: `${widthPct}%`,
                            height: '38px',
                            borderRadius: 'var(--radius-pill)',
                            backgroundColor: fill,
                            color: 'var(--text-on-accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 14px 4px 6px',
                            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.45)',
                            transition: 'transform var(--transition-fast)',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--bg-canvas)',
                                color: fill,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontFamily: 'var(--font-display)',
                                fontWeight: 700,
                                fontSize: '12px',
                              }}
                            >
                              {item.title.slice(0, 2).toUpperCase()}
                            </span>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.title}
                            </span>
                          </span>

                          <span
                            className="font-mono"
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              marginLeft: '8px',
                              flexShrink: 0,
                            }}
                          >
                            {item.metricDisplay}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scale Axis Footer */}
              <div
                className="font-mono"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr',
                  gap: '14px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                <span>SCALE</span>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Secondary Row: Laboratory Shortcuts & Recent PostgreSQL Audit Journal */}
      <div className="df-dashboard-grid">
        {/* Left: Quick Laboratory Operations */}
        <Panel
          title="LABORATORY WORKFLOWS"
          subtitle="Direct operational entry points for schema diffing, drift detection, and lineage graphs"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
            }}
          >
            {[
              {
                title: 'Register & Upload CSV',
                desc: 'Ingest tabular file, compute SHA-256 & profile schema',
                tab: 'register-dataset' as NavigationTab,
                icon: Database,
                accent: 'var(--accent-lime)',
              },
              {
                title: 'Version Comparison',
                desc: 'Side-by-side schema diff, added/removed columns & row delta',
                tab: 'versions' as NavigationTab,
                icon: GitCompare,
                accent: 'var(--accent-amber)',
              },
              {
                title: 'Data Lineage DAG',
                desc: 'Interactive node graph of datasets, versions, models & runs',
                tab: 'lineage' as NavigationTab,
                icon: GitFork,
                accent: 'var(--accent-lime)',
              },
              {
                title: 'Similarity Checking',
                desc: 'Compute Jaccard column overlap ratio between versions',
                tab: 'similarity' as NavigationTab,
                icon: Sparkles,
                accent: 'var(--text-primary)',
              },
              {
                title: 'Statistical Drift Lab',
                desc: 'Analyze numeric column mean shifts & distribution drift',
                tab: 'drift' as NavigationTab,
                icon: Activity,
                accent: 'var(--accent-amber)',
              },
              {
                title: 'Projects & Members',
                desc: `Manage ${totalProjects} workspaces, owners, and team roles`,
                tab: 'projects' as NavigationTab,
                icon: FolderGit2,
                accent: 'var(--text-primary)',
              },
            ].map((op) => {
              const Icon = op.icon;
              return (
                <button
                  key={op.tab}
                  type="button"
                  onClick={() => onNavigate(op.tab)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={16} color={op.accent} />
                    </div>
                    <ArrowUpRight size={15} color="var(--text-muted)" />
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                      }}
                    >
                      {op.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {op.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Model Leaderboard Summary Strip */}
          {highPerformingModels.length > 0 && (
            <div
              style={{
                marginTop: '18px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                <Brain size={15} color="var(--accent-lime)" />
                <span style={{ color: 'var(--text-secondary)' }}>Top Ranked Model Architecture:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {highPerformingModels[0].model_name}
                </strong>
                <span className="font-mono" style={{ color: 'var(--accent-lime)' }}>
                  ({(Number(highPerformingModels[0].avg_accuracy || 0) * 100).toFixed(2)}% avg acc)
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('analytics')}
                style={{ fontSize: '12px', color: 'var(--accent-lime)', fontWeight: 600 }}
              >
                Full Analytics &rarr;
              </button>
            </div>
          )}
        </Panel>

        {/* Right: Recent PostgreSQL Activity & Audit Journal */}
        <Panel
          title="RECENT AUDIT ACTIVITY"
          subtitle="Chronological PostgreSQL trigger & transaction events"
          rightSlot={
            <button
              type="button"
              onClick={() => onNavigate('activity')}
              className="df-btn-ghost"
              style={{ fontSize: '12px', borderRadius: '999px' }}
            >
              Full Journal <ArrowUpRight size={13} />
            </button>
          }
        >
          {recentLogs.length === 0 ? (
            <EmptyState
              title="No Audit Events Recorded"
              description="Database mutations and version commits will appear here automatically."
              icon={<History size={26} />}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <StatusBadge status={log.action} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.entity_name || log.entity_type}{' '}
                        <span
                          className="font-mono"
                          style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                        >
                          [{log.entity_type}]
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.details || `Entity ID: ${log.entity_id.slice(0, 12)}…`}
                      </div>
                    </div>
                  </div>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
