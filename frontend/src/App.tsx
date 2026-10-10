import React, { useState } from 'react';
import { AppLayout } from './layouts/AppLayout';
import type { NavigationTab } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { DatasetRegistrationPage } from './pages/DatasetRegistrationPage';
import { DatasetDetailPage } from './pages/DatasetDetailPage';
import { ModelsPage } from './pages/ModelsPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { LineagePage } from './pages/LineagePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ActivityPage } from './pages/ActivityPage';
import { UsersPage } from './pages/UsersPage';
import './styles/theme.css';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [navParams, setNavParams] = useState<any>({});

  const handleNavigate = (tab: NavigationTab, params: any = {}) => {
    setNavParams(params);
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      case 'projects':
        return <ProjectsPage onNavigate={handleNavigate} />;
      case 'datasets':
        return <DatasetsPage initialProjectId={navParams.projectId} onNavigate={handleNavigate} />;
      case 'register-dataset':
        return <DatasetRegistrationPage initialProjectId={navParams.projectId} onNavigate={handleNavigate} />;
      case 'dataset-detail':
        return <DatasetDetailPage datasetId={navParams.datasetId} onNavigate={handleNavigate} />;
      case 'models':
        return <ModelsPage onNavigate={handleNavigate} />;
      case 'experiments':
        return <ExperimentsPage initialModelId={navParams.modelId} onNavigate={handleNavigate} />;
      case 'lineage':
        return <LineagePage initialDatasetId={navParams.datasetId} onNavigate={handleNavigate} />;
      case 'analytics':
        return <AnalyticsPage onNavigate={handleNavigate} />;
      case 'activity':
        return <ActivityPage onNavigate={handleNavigate} />;
      case 'users':
        return <UsersPage onNavigate={handleNavigate} />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout currentTab={currentTab} onNavigate={handleNavigate}>
      {renderContent()}
    </AppLayout>
  );
};

export default App;
