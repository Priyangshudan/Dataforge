import React, { useEffect, useState } from 'react';
import {
  GitFork,
  Database,
  GitBranch,
  Brain,
  FlaskConical,
  Layers
} from 'lucide-react';
import { api } from '../api/client';
import type { Dataset, LineageGraph } from '../types';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/Common';
import type { NavigationTab } from '../layouts/AppLayout';

interface LineagePageProps {
  initialDatasetId?: string;
  onNavigate: (tab: NavigationTab, params?: any) => void;
}

type NodeItem = LineageGraph['nodes'][number];

export const LineagePage: React.FC<LineagePageProps> = ({ initialDatasetId }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(initialDatasetId || '');
  const [lineageGraph, setLineageGraph] = useState<LineageGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await api.getDatasets();
        if (res.length > 0) {
          setDatasets(res);
          if (!selectedDatasetId) {
            setSelectedDatasetId(res[0].id);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch datasets');
      }
    };
    fetchDatasets();
  }, []);

  useEffect(() => {
    if (selectedDatasetId) {
      setLoading(true);
      setError(null);
      setSelectedNode(null);
      api.getDatasetLineage(selectedDatasetId)
        .then(res => {
          setLineageGraph(res);
        })
        .catch(err => setError(err.message || 'Error querying lineage endpoints'))
        .finally(() => setLoading(false));
    }
  }, [selectedDatasetId]);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'DATASET': return 'var(--accent-cyan)';
      case 'DATASET_VERSION': return '#38BDF8';
      case 'MODEL_VERSION': return 'var(--accent-indigo)';
      case 'EXPERIMENT': return 'var(--accent-amber)';
      default: return 'var(--accent-emerald)';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'DATASET': return Database;
      case 'DATASET_VERSION': return GitBranch;
      case 'MODEL_VERSION': return Brain;
      case 'EXPERIMENT': return FlaskConical;
      default: return Layers;
    }
  };

  const groupedNodes: { [key: string]: NodeItem[] } = {
    DATASET: [],
    DATASET_VERSION: [],
    MODEL_VERSION: [],
    EXPERIMENT: []
  };

  if (lineageGraph) {
    lineageGraph.nodes.forEach(n => {
      if (groupedNodes[n.type]) {
        groupedNodes[n.type].push(n);
      } else {
        groupedNodes['DATASET_VERSION'].push(n);
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Artifact Lineage Explorer
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Full directed acyclic graph (DAG) tracing datasets &rarr; versions &rarr; models &rarr; experiments.
          </p>
        </div>

        {/* Dataset Selector */}
        <div style={{ minWidth: '260px' }}>
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          >
            {datasets.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.project_name || 'Project'})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Graph Area */}
      {loading ? (
        <LoadingSpinner message="Querying PostgreSQL recursive lineage views..." />
      ) : error ? (
        <ErrorState title="Lineage Error" message={error} />
      ) : !lineageGraph || lineageGraph.nodes.length === 0 ? (
        <EmptyState
          title="No Lineage Graph Found"
          description="This dataset has no recorded version or model linkages yet."
          icon={<GitFork size={36} />}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 340px' : '1fr', gap: '24px' }}>
          {/* Visual DAG Canvas / Card Columns */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px',
            minHeight: '520px',
            overflowX: 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '32px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              {[
                { label: 'Dataset', color: 'var(--accent-cyan)' },
                { label: 'Dataset Version', color: '#38BDF8' },
                { label: 'Model Version', color: 'var(--accent-indigo)' },
                { label: 'Experiment Run', color: 'var(--accent-amber)' },
              ].map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: l.color }}></span>
                  {l.label}
                </div>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                {lineageGraph.nodes.length} nodes &bull; {lineageGraph.edges.length} edges
              </span>
            </div>

            {/* Directed Columns */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '32px', flex: 1 }}>
              {Object.entries(groupedNodes).map(([typeKey, nodes]) => (
                <div key={typeKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '180px' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    textAlign: 'center',
                    borderBottom: '1px dashed var(--border)',
                    paddingBottom: '8px'
                  }}>
                    {typeKey.replace('_', ' ')}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {nodes.map(node => {
                      const Icon = getNodeIcon(node.type);
                      const isSelected = selectedNode?.id === node.id;
                      const color = getNodeColor(node.type);

                      return (
                        <div
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          style={{
                            backgroundColor: isSelected ? 'var(--bg-elevated)' : 'var(--bg-card)',
                            border: `1px solid ${isSelected ? color : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            boxShadow: isSelected ? `0 0 12px ${color}33` : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Icon size={16} color={color} />
                            <span style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {node.label}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {node.id.slice(0, 8)}...
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Edge details note */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Click any node in the lineage DAG to inspect cryptographic metadata and relationship origins.
            </div>
          </div>

          {/* Node Inspector Drawer */}
          {selectedNode && (
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Node Inspector
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: getNodeColor(selectedNode.type),
                    textTransform: 'uppercase'
                  }}>
                    {selectedNode.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{ color: 'var(--text-muted)', fontSize: '20px' }}
                >
                  &times;
                </button>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px'
              }}>
                <div style={{ color: 'var(--text-muted)' }}>Identifier:</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {selectedNode.id}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Label:</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedNode.label}
                </div>
              </div>

              {/* Node Metadata fields */}
              {selectedNode.metadata && (
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Properties:</div>
                  {Object.entries(selectedNode.metadata).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

