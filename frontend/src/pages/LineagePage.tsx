import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import type {
  Dataset,
  LineageGraph,
  LineageNode,
  LineageEdge,
  VersionLineage,
  NavigationTab,
} from '../types';
import {
  PageHeader,
  Panel,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  StatusBadge,
  HashBadge,
  RingLegend,
  formatShortDate,
} from '../components/Common';
import {
  GitFork,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Database,
  GitCommit,
  Cpu,
  FlaskConical,
  Layers,
  GitCompare,
} from 'lucide-react';

interface LineagePageProps {
  initialDatasetId?: string;
  onNavigate: (tab: NavigationTab, params?: Record<string, string>) => void;
}

interface PositionedNode extends LineageNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_STYLE_MAP: Record<
  LineageNode['type'],
  { border: string; bg: string; badgeBg: string; badgeText: string; tag: string }
> = {
  DATASET: {
    border: '#F4F5F4',
    bg: '#1A1C1A',
    badgeBg: 'rgba(244, 245, 244, 0.14)',
    badgeText: '#F4F5F4',
    tag: 'ROOT DATASET',
  },
  DATASET_VERSION: {
    border: '#B8FF62',
    bg: '#182114',
    badgeBg: 'rgba(184, 255, 98, 0.16)',
    badgeText: '#B8FF62',
    tag: 'DATASET VERSION',
  },
  MODEL_VERSION: {
    border: '#FF9E27',
    bg: '#231B12',
    badgeBg: 'rgba(255, 158, 39, 0.16)',
    badgeText: '#FF9E27',
    tag: 'MODEL CHECKPOINT',
  },
  EXPERIMENT: {
    border: '#9A9E9A',
    bg: '#1D1E1D',
    badgeBg: 'rgba(154, 158, 154, 0.18)',
    badgeText: '#E2E4E2',
    tag: 'EXPERIMENT RUN',
  },
};

export const LineagePage: React.FC<LineagePageProps> = ({
  initialDatasetId,
  onNavigate,
}) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(initialDatasetId || '');
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [versionDetail, setVersionDetail] = useState<VersionLineage | null>(null);

  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive Canvas Zoom & Pan State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  const loadDatasets = useCallback(async () => {
    setLoadingDatasets(true);
    setError(null);
    try {
      const list = await api.getDatasets({ sortBy: 'updated_at', sortOrder: 'DESC' });
      setDatasets(list || []);
      if (initialDatasetId && list.some((d) => d.id === initialDatasetId)) {
        setSelectedDatasetId(initialDatasetId);
      } else if (!selectedDatasetId && list.length > 0) {
        setSelectedDatasetId(list[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets for lineage graph');
    } finally {
      setLoadingDatasets(false);
    }
  }, [initialDatasetId, selectedDatasetId]);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    if (initialDatasetId && initialDatasetId !== selectedDatasetId) {
      setSelectedDatasetId(initialDatasetId);
    }
  }, [initialDatasetId, selectedDatasetId]);

  const loadLineageGraph = useCallback(async (datasetId: string) => {
    if (!datasetId) return;
    setLoadingGraph(true);
    setError(null);
    try {
      const g = await api.getDatasetLineage(datasetId);
      setGraph(g);
      const defaultNode =
        g.nodes.find((n) => n.type === 'DATASET_VERSION') || g.nodes[0] || null;
      setSelectedNode(defaultNode);
    } catch (err: any) {
      setError(err.message || 'Failed to load lineage graph');
    } finally {
      setLoadingGraph(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDatasetId) {
      loadLineageGraph(selectedDatasetId);
    }
  }, [selectedDatasetId, loadLineageGraph]);

  useEffect(() => {
    if (!selectedNode || selectedNode.type !== 'DATASET_VERSION') {
      setVersionDetail(null);
      return;
    }
    api
      .getVersionLineage(selectedNode.id)
      .then((detail) => setVersionDetail(detail))
      .catch(() => setVersionDetail(null));
  }, [selectedNode]);

  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) {
      return {
        nodes: [] as PositionedNode[],
        edges: [] as LineageEdge[],
        width: 960,
        height: 520,
      };
    }

    const colOrder: LineageNode['type'][] = [
      'DATASET',
      'DATASET_VERSION',
      'MODEL_VERSION',
      'EXPERIMENT',
    ];
    const colX: Record<LineageNode['type'], number> = {
      DATASET: 40,
      DATASET_VERSION: 300,
      MODEL_VERSION: 580,
      EXPERIMENT: 860,
    };

    const nodeW = 210;
    const nodeH = 78;
    const verticalGap = 110;

    const grouped: Record<LineageNode['type'], LineageNode[]> = {
      DATASET: [],
      DATASET_VERSION: [],
      MODEL_VERSION: [],
      EXPERIMENT: [],
    };

    graph.nodes.forEach((n) => {
      if (grouped[n.type]) grouped[n.type].push(n);
    });

    const maxRows = Math.max(1, ...colOrder.map((t) => grouped[t].length));
    const canvasHeight = Math.max(480, maxRows * verticalGap + 120);
    const canvasWidth = 1120;

    const positioned: PositionedNode[] = [];
    colOrder.forEach((type) => {
      const list = grouped[type];
      const totalColumnHeight =
        list.length * nodeH + Math.max(0, list.length - 1) * (verticalGap - nodeH);
      const startY = Math.max(55, (canvasHeight - totalColumnHeight) / 2);

      list.forEach((n, idx) => {
        positioned.push({
          ...n,
          x: colX[type],
          y: startY + idx * verticalGap,
          width: nodeW,
          height: nodeH,
        });
      });
    });

    return {
      nodes: positioned,
      edges: graph.edges,
      width: canvasWidth,
      height: canvasHeight,
    };
  }, [graph]);

  const connectedIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNode || !graph) return set;
    set.add(selectedNode.id);
    graph.edges.forEach((e) => {
      if (e.source === selectedNode.id) set.add(e.target);
      if (e.target === selectedNode.id) set.add(e.source);
    });
    return set;
  }, [selectedNode, graph]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest('.lineage-node-group')) return;
    setIsDragging(true);
    setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragOrigin.x,
      y: e.clientY - dragOrigin.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 20, y: 20 });
  };

  if (loadingDatasets && datasets.length === 0) {
    return <LoadingSpinner message="Loading data lineage engine..." />;
  }

  if (error && datasets.length === 0) {
    return <ErrorState message={error} onRetry={loadDatasets} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="SIGNATURE MODULE · DIRECTED ACYCLIC PROVENANCE GRAPH"
        title="DATA LINEAGE & PROVENANCE DAG"
        subtitle="Trace end-to-end provenance from root datasets through version derivations, trained model checkpoints, and evaluation runs."
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="df-select"
              style={{ width: 250, borderRadius: 'var(--radius-pill)' }}
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              aria-label="Select Dataset for Lineage"
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.total_versions || 0}v)
                </option>
              ))}
            </select>

            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 4,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                type="button"
                className="df-icon-circle"
                style={{ width: 30, height: 30, border: 'none' }}
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <button
                type="button"
                className="df-icon-circle"
                style={{ width: 30, height: 30, border: 'none' }}
                onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.15).toFixed(2))))}
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                type="button"
                className="df-icon-circle"
                style={{ width: 30, height: 30, border: 'none' }}
                onClick={resetViewport}
                title="Reset View"
                aria-label="Reset View"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        }
      />

      {datasets.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<GitFork size={24} />}
            title="No Datasets Available for Lineage"
            description="Register a dataset to build its provenance graph."
            actionLabel="Register Dataset"
            onAction={() => onNavigate('register-dataset')}
          />
        </Panel>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          {/* Left 8 cols: Interactive SVG Lineage Canvas */}
          <div style={{ gridColumn: 'span 8' }} className="df-col-full-mobile">
            <Panel
              title="PROVENANCE TOPOLOGY"
              subtitle={`Drag to pan · Zoom ${(zoom * 100).toFixed(0)}% · ${layout.nodes.length} nodes · ${layout.edges.length} directed edges`}
              rightSlot={
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <RingLegend label="DATASET" color="white" />
                  <RingLegend label="VERSION" color="lime" />
                  <RingLegend label="MODEL" color="amber" />
                  <RingLegend label="EXPERIMENT" color="gray" />
                </div>
              }
            >
              {loadingGraph ? (
                <LoadingSpinner message="Constructing directed acyclic lineage graph..." />
              ) : layout.nodes.length === 0 ? (
                <EmptyState
                  icon={<GitFork size={22} />}
                  title="Empty Lineage Graph"
                  description="This dataset does not have any recorded nodes yet."
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: 520,
                    borderRadius: 16,
                    background:
                      'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                    backgroundColor: '#0C0D0C',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: 16,
                      right: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    {[
                      'STAGE 01 · DATASET',
                      'STAGE 02 · VERSIONS',
                      'STAGE 03 · MODELS',
                      'STAGE 04 · EXPERIMENTS',
                    ].map((stage) => (
                      <span
                        key={stage}
                        className="df-mono"
                        style={{
                          fontSize: '0.64rem',
                          letterSpacing: '0.1em',
                          color: 'var(--text-muted)',
                          background: 'rgba(9, 10, 9, 0.8)',
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {stage}
                      </span>
                    ))}
                  </div>

                  <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ userSelect: 'none' }}
                  >
                    <defs>
                      <marker
                        id="arrow-lime"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8 Z" fill="#B8FF62" />
                      </marker>
                      <marker
                        id="arrow-amber"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8 Z" fill="#FF9E27" />
                      </marker>
                      <marker
                        id="arrow-muted"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8 Z" fill="#6D716D" />
                      </marker>
                    </defs>

                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                      {layout.edges.map((edge, idx) => {
                        const fromNode = layout.nodes.find((n) => n.id === edge.source);
                        const toNode = layout.nodes.find((n) => n.id === edge.target);
                        if (!fromNode || !toNode) return null;

                        const isHighlighted =
                          selectedNode &&
                          (edge.source === selectedNode.id || edge.target === selectedNode.id);

                        const sameColumn = fromNode.x === toNode.x;
                        let pathD = '';
                        if (sameColumn) {
                          const startX = fromNode.x + fromNode.width / 2;
                          const startY =
                            fromNode.y < toNode.y ? fromNode.y + fromNode.height : fromNode.y;
                          const endX = toNode.x + toNode.width / 2;
                          const endY =
                            fromNode.y < toNode.y ? toNode.y : toNode.y + toNode.height;
                          pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
                        } else {
                          const startX = fromNode.x + fromNode.width;
                          const startY = fromNode.y + fromNode.height / 2;
                          const endX = toNode.x;
                          const endY = toNode.y + toNode.height / 2;
                          const midX = (startX + endX) / 2;
                          pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
                        }

                        const strokeColor = isHighlighted
                          ? edge.type === 'TRAINED_ON'
                            ? '#FF9E27'
                            : '#B8FF62'
                          : 'rgba(255, 255, 255, 0.22)';

                        const marker = isHighlighted
                          ? edge.type === 'TRAINED_ON'
                            ? 'url(#arrow-amber)'
                            : 'url(#arrow-lime)'
                          : 'url(#arrow-muted)';

                        return (
                          <g key={`${edge.source}-${edge.target}-${idx}`}>
                            <path
                              d={pathD}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth={isHighlighted ? 2.2 : 1.3}
                              strokeDasharray={edge.type === 'DERIVED_FROM' ? '4 3' : undefined}
                              markerEnd={marker}
                            />
                          </g>
                        );
                      })}

                      {layout.nodes.map((node) => {
                        const style = NODE_STYLE_MAP[node.type];
                        const isSelected = selectedNode?.id === node.id;
                        const isConnected = connectedIds.has(node.id);
                        const opacity = !selectedNode || isConnected ? 1 : 0.42;

                        return (
                          <g
                            key={node.id}
                            className="lineage-node-group"
                            transform={`translate(${node.x}, ${node.y})`}
                            onClick={() => setSelectedNode(node)}
                            style={{ cursor: 'pointer', opacity, transition: 'opacity 150ms ease' }}
                          >
                            <rect
                              width={node.width}
                              height={node.height}
                              rx={14}
                              fill={style.bg}
                              stroke={isSelected ? style.border : 'rgba(255,255,255,0.16)'}
                              strokeWidth={isSelected ? 2.4 : 1.2}
                            />

                            <rect
                              x={12}
                              y={10}
                              width={118}
                              height={18}
                              rx={9}
                              fill={style.badgeBg}
                            />
                            <text
                              x={20}
                              y={22}
                              fill={style.badgeText}
                              fontSize="8.5"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="700"
                            >
                              {style.tag}
                            </text>

                            <text
                              x={12}
                              y={44}
                              fill="#FFFFFF"
                              fontSize="12"
                              fontFamily="Plus Jakarta Sans, sans-serif"
                              fontWeight="700"
                            >
                              {node.label.length > 22
                                ? `${node.label.slice(0, 20)}…`
                                : node.label}
                            </text>

                            <text
                              x={12}
                              y={62}
                              fill="#9A9E9A"
                              fontSize="10"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              {node.type === 'DATASET_VERSION' &&
                                `${node.metadata?.row_count ?? 0}r · ${node.metadata?.column_count ?? 0}c`}
                              {node.type === 'MODEL_VERSION' &&
                                `${node.framework || node.metadata?.algorithm || 'Checkpoint'}`}
                              {node.type === 'EXPERIMENT' &&
                                `${node.status || 'RUN'}${
                                  node.accuracy
                                    ? ` · ${(Number(node.accuracy) * 100).toFixed(1)}%`
                                    : ''
                                }`}
                              {node.type === 'DATASET' && 'Root Entity'}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </div>
              )}
            </Panel>
          </div>

          {/* Right 4 cols: Selected Node Inspector */}
          <div style={{ gridColumn: 'span 4' }} className="df-col-full-mobile">
            <Panel
              title="NODE INSPECTOR"
              subtitle={
                selectedNode
                  ? `${selectedNode.type} metadata & relationships`
                  : 'Click any node in the graph'
              }
            >
              {!selectedNode ? (
                <EmptyState
                  icon={<Layers size={22} />}
                  title="No Node Selected"
                  description="Select a node on the lineage canvas to inspect its metadata, checksums, and connected entities."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
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
                      <StatusBadge status={selectedNode.type} size="sm" />
                      <span
                        className="df-mono"
                        style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}
                      >
                        ID: {selectedNode.id.slice(0, 8)}
                      </span>
                    </div>
                    <h4 style={{ margin: '4px 0', fontSize: '1.05rem', color: '#FFF' }}>
                      {selectedNode.label}
                    </h4>
                  </div>

                  {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                    <div>
                      <div className="df-card-label" style={{ marginBottom: 8 }}>
                        RECORDED ATTRIBUTES
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(selectedNode.metadata).map(([k, v]) => {
                          if (v === null || v === undefined) return null;
                          return (
                            <div
                              key={k}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                borderRadius: 10,
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: '0.78rem',
                              }}
                            >
                              <span className="df-mono" style={{ color: 'var(--text-muted)' }}>
                                {k}
                              </span>
                              <span className="df-mono" style={{ color: '#FFF', fontWeight: 600 }}>
                                {k === 'checksum_sha256' || k === 'checksum' ? (
                                  <HashBadge hash={String(v)} />
                                ) : k === 'created_at' ? (
                                  formatShortDate(String(v))
                                ) : k === 'accuracy' || k === 'f1_score' ? (
                                  `${(Number(v) * 100).toFixed(2)}%`
                                ) : (
                                  String(v)
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'DATASET_VERSION' && versionDetail && (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: 'rgba(184, 255, 98, 0.05)',
                        border: '1px solid rgba(184, 255, 98, 0.2)',
                      }}
                    >
                      <div
                        className="df-card-label"
                        style={{ color: 'var(--accent-lime)', marginBottom: 8 }}
                      >
                        DOWNSTREAM IMPACT SUMMARY
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div>
                          • Ancestry Depth:{' '}
                          <strong style={{ color: '#FFF' }}>
                            {versionDetail.ancestry?.length || 1} commit(s)
                          </strong>
                        </div>
                        <div>
                          • Derived Descendants:{' '}
                          <strong style={{ color: 'var(--accent-lime)' }}>
                            {versionDetail.descendants?.length || 0}
                          </strong>
                        </div>
                        <div>
                          • Trained Model Checkpoints:{' '}
                          <strong style={{ color: 'var(--accent-amber)' }}>
                            {versionDetail.trained_models?.length || 0}
                          </strong>
                        </div>
                        <div>
                          • Evaluation Experiments:{' '}
                          <strong style={{ color: '#FFF' }}>
                            {versionDetail.experiments?.length || 0}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {selectedNode.type === 'DATASET' && (
                      <button
                        type="button"
                        className="df-btn df-btn--primary"
                        onClick={() =>
                          onNavigate('dataset-detail', { datasetId: selectedNode.id })
                        }
                      >
                        <Database size={14} /> Open Dataset Inspector
                      </button>
                    )}

                    {selectedNode.type === 'DATASET_VERSION' && (
                      <>
                        <button
                          type="button"
                          className="df-btn df-btn--primary"
                          onClick={() =>
                            onNavigate('dataset-detail', {
                              datasetId: selectedDatasetId,
                              versionId: selectedNode.id,
                            })
                          }
                        >
                          <GitCommit size={14} /> Inspect Version Schema
                        </button>
                        <button
                          type="button"
                          className="df-btn df-btn--secondary"
                          onClick={() =>
                            onNavigate('versions', {
                              datasetId: selectedDatasetId,
                              compareVersionId: selectedNode.id,
                            })
                          }
                        >
                          <GitCompare size={14} /> Compare in Version Explorer
                        </button>
                      </>
                    )}

                    {selectedNode.type === 'MODEL_VERSION' && (
                      <button
                        type="button"
                        className="df-btn df-btn--primary"
                        onClick={() => onNavigate('models')}
                      >
                        <Cpu size={14} /> Open Model Registry
                      </button>
                    )}

                    {selectedNode.type === 'EXPERIMENT' && (
                      <button
                        type="button"
                        className="df-btn df-btn--primary"
                        onClick={() =>
                          onNavigate('experiments', { experimentId: selectedNode.id })
                        }
                      >
                        <FlaskConical size={14} /> Inspect Experiment Run
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
};
