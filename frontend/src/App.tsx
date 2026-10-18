import React, { useState, useEffect, useCallback } from 'react';
import type { NavigationTab } from './types';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { DatasetRegistrationPage } from './pages/DatasetRegistrationPage';
import { DatasetDetailPage } from './pages/DatasetDetailPage';
import { VersionsPage } from './pages/VersionsPage';
import { ModelsPage } from './pages/ModelsPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { LineagePage } from './pages/LineagePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SimilarityPage } from './pages/SimilarityPage';
import { DriftPage } from './pages/DriftPage';
import { ActivityPage } from './pages/ActivityPage';
import { UsersPage } from './pages/UsersPage';
import './styles/theme.css';

const VALID_TABS: NavigationTab[] = [
  'dashboard',
  'projects',
  'datasets',
  'register-dataset',
  'dataset-detail',
  'versions',
  'models',
  'experiments',
  'lineage',
  'analytics',
  'similarity',
  'drift',
  'activity',
  'users',
];

function parseHashState(): { tab: NavigationTab; params: Record<string, string> } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw) return { tab: 'dashboard', params: {} };
  const [pathPart, queryPart] = raw.split('?');
  const tab = (VALID_TABS.includes(pathPart as NavigationTab)
    ? pathPart
    : 'dashboard') as NavigationTab;
  const params: Record<string, string> = {};
  if (queryPart) {
    const sp = new URLSearchParams(queryPart);
    sp.forEach((value, key) => {
      params[key] = value;
    });
  }
  return { tab, params };
}

export const App: React.FC = () => {
  const initial = parseHashState();
  const [activeTab, setActiveTab] = useState<NavigationTab>(initial.tab);
  const [navParams, setNavParams] = useState<Record<string, string>>(initial.params);

  const handleNavigate = useCallback(
    (tab: NavigationTab, params?: Record<string, string>) => {
      const nextParams = params || {};
      setActiveTab(tab);
      setNavParams(nextParams);

      const qs = new URLSearchParams(nextParams).toString();
      const nextHash = qs ? `#/${tab}?${qs}` : `#/${tab}`;
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, '', nextHash);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseHashState();
      setActiveTab(parsed.tab);
      setNavParams(parsed.params);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <AppLayout currentTab={activeTab} onNavigate={handleNavigate}>
      {activeTab === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}

      {activeTab === 'projects' && (
        <ProjectsPage
          initialProjectId={navParams.projectId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'datasets' && (
        <DatasetsPage
          initialProjectId={navParams.projectId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'register-dataset' && (
        <DatasetRegistrationPage
          initialProjectId={navParams.projectId}
          initialDatasetId={navParams.datasetId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'dataset-detail' && (
        <DatasetDetailPage
          datasetId={navParams.datasetId || ''}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'versions' && (
        <VersionsPage
          initialDatasetId={navParams.datasetId}
          initialBaseVersionId={navParams.baseVersionId}
          initialCompareVersionId={navParams.compareVersionId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'models' && (
        <ModelsPage
          initialModelId={navParams.modelId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'experiments' && (
        <ExperimentsPage
          initialExperimentId={navParams.experimentId}
          initialModelVersionId={navParams.modelVersionId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'lineage' && (
        <LineagePage
          initialDatasetId={navParams.datasetId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'analytics' && <AnalyticsPage onNavigate={handleNavigate} />}

      {activeTab === 'similarity' && (
        <SimilarityPage
          initialBaseVersionId={navParams.baseVersionId}
          initialCompareVersionId={navParams.compareVersionId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'drift' && (
        <DriftPage
          initialBaseVersionId={navParams.baseVersionId}
          initialCompareVersionId={navParams.compareVersionId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === 'activity' && <ActivityPage onNavigate={handleNavigate} />}

      {activeTab === 'users' && <UsersPage onNavigate={handleNavigate} />}
    </AppLayout>
  );
};

export default App;
