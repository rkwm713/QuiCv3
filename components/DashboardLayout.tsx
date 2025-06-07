import React, { useState, useEffect } from 'react';
import DemoTutorial from './DemoTutorial';
import AIAnalytics from './AIAnalytics';
import HeightComparisonTable from './HeightComparisonTable';
import { CoverSheetTable } from './CoverSheetTable';
import { DataManagement } from './DataManagement';

interface DashboardLayoutProps {
  dataSourceSection: React.ReactNode;
  analysisSection: React.ReactNode;
  exportSection: React.ReactNode;
  statusSection: React.ReactNode;
  dataTableSection: React.ReactNode;
  mapSection: React.ReactNode;
  // Workflow state props
  hasSpidaFile?: boolean;
  hasKatapultFile?: boolean;
  hasComparisonRun?: boolean;
  hasDataToExport?: boolean;
  // Data props for AI Analytics
  comparisonData?: any;
  poleData?: any[];
  // Data props for QC Tool
  spidaJson?: any;
  katapultJson?: any;
}

// Icon components for the navigation
const AnalyticsIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const TableIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);

const MapIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const StatisticsIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const QCIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CoverSheetIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const BookOpenIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const DataManagementIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);



// PIN Entry Modal Component
const PinModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void; 
}> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const CORRECT_PIN = '1008';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      onSuccess();
      setPin('');
      setError('');
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="card w-full max-w-md mx-4">
        <div className="card-header flex items-center justify-between">
          <h2 className="card-title">AI Analytics Access</h2>
          <button
            onClick={handleClose}
            className="btn btn-ghost p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="alert alert-info">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 1.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM12 9V7a4 4 0 118 0v4M3 15a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
              <span>Secured AI Features</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="input text-center text-lg tracking-widest"
                maxLength={4}
                autoFocus
              />
              {error && (
                <div className="alert alert-error mt-2">
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
              >
                Access
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  dataSourceSection,
  analysisSection,
  exportSection,
  statusSection,
  dataTableSection,
  mapSection,
  hasSpidaFile,
  hasKatapultFile,
  hasComparisonRun,
  hasDataToExport,
  comparisonData,
  poleData,
  spidaJson,
  katapultJson,
}) => {
  const [activeTab, setActiveTab] = useState<'demo' | 'data-management' | 'table' | 'coversheet' | 'map' | 'analytics' | 'statistics' | 'qc'>('data-management');
  const [hasAutoSwitchedToTable, setHasAutoSwitchedToTable] = useState(false);
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Handle analytics tab access with PIN protection
  const handleAnalyticsTabClick = () => {
    if (isAiUnlocked) {
      setActiveTab('analytics');
    } else {
      setShowPinModal(true);
    }
  };

  const handlePinSuccess = () => {
    setIsAiUnlocked(true);
    setShowPinModal(false);
    setActiveTab('analytics');
  };

  const handlePinClose = () => {
    setShowPinModal(false);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Handle responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsSidebarCollapsed(true);
      }
      // Note: Don't auto-expand on desktop resize to preserve user preference
    };

    // Set initial state based on screen size
    if (window.innerWidth <= 768) {
      setIsSidebarCollapsed(true);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Only automatically switch to Katapult Attribute Check tab once after comparison is run
  useEffect(() => {
    if (hasComparisonRun && activeTab === 'data-management' && !hasAutoSwitchedToTable) {
      setActiveTab('table');
      setHasAutoSwitchedToTable(true);
    }
  }, [hasComparisonRun, activeTab, hasAutoSwitchedToTable]);

  // Reset auto-switch flag when comparison data is cleared
  useEffect(() => {
    if (!hasComparisonRun) {
      setHasAutoSwitchedToTable(false);
    }
  }, [hasComparisonRun]);



  const navigationItems = [
    { id: 'data-management' as const, name: 'Data Management', icon: <DataManagementIcon />, description: 'Load data, run analysis, and export results' },
    { id: 'table' as const, name: 'Katapult Attribute Check', icon: <TableIcon />, description: 'Verify Pole Numbers, SCIDs, Specs, and Loading %' },
    { id: 'coversheet' as const, name: 'CoverSheet', icon: <CoverSheetIcon />, description: 'Generate a PE cover sheet from SPIDAcalc data' },
    { id: 'map' as const, name: 'Map View', icon: <MapIcon />, description: 'Geographic visualization' },
    { id: 'statistics' as const, name: 'Statistics', icon: <StatisticsIcon />, description: 'Match statistics & insights' },
    { id: 'qc' as const, name: 'QC Tool', icon: <QCIcon />, description: 'Compare pole and attachment heights' },
    { id: 'analytics' as const, name: 'Analytics', icon: <AnalyticsIcon />, description: 'AI-powered data insights' },
    { id: 'demo' as const, name: 'Demo & Tutorial', icon: <BookOpenIcon />, description: 'Learn how to use QuiC' },
  ];

  return (
    <div className="dashboard-layout">
      <div className="flex h-screen">
        {/* Mobile overlay */}
        {!isSidebarCollapsed && (
          <div 
            className="sidebar-overlay" 
            onClick={() => setIsSidebarCollapsed(true)}
          />
        )}
        
        {/* Left Sidebar Navigation */}
        <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <nav className="sidebar-nav">
            <div className="nav-section">
              <div className="nav-section-header">
                <button 
                  onClick={toggleSidebar}
                  className="sidebar-toggle-btn"
                  title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <svg 
                    className={`sidebar-toggle-icon ${isSidebarCollapsed ? 'collapsed' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => item.id === 'analytics' ? handleAnalyticsTabClick() : setActiveTab(item.id)}
                  className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  title={item.description}
                >
                  <div className="sidebar-nav-icon">
                    {item.icon}
                  </div>
                  <div className="sidebar-nav-content">
                    <span className="sidebar-nav-name">{item.name}</span>
                    <span className="sidebar-nav-description">{item.description}</span>
                  </div>
                  {item.id === 'analytics' && !isAiUnlocked && (
                    <svg className="w-4 h-4 text-warning ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 1.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM12 9V7a4 4 0 118 0v4M3 15a9 9 0 1118 0 9 9 0 01-18 0z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </nav>
          
          <div className="sidebar-footer">
            <img 
              src={isSidebarCollapsed ? "/tablogo.svg" : "/logo.svg"}
              alt="QuiC Logo" 
              className="w-full h-auto max-w-24 mx-auto"
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          {/* Page Content */}
          <div className="page-content">
            {activeTab === 'demo' && (
              <div className="content-container">
                <DemoTutorial />
              </div>
            )}

            {activeTab === 'data-management' && (
              <div className="content-container">
                <DataManagement
                  dataSourceSection={dataSourceSection}
                  analysisSection={analysisSection}
                  exportSection={exportSection}
                  statusSection={statusSection}
                  hasSpidaFile={hasSpidaFile}
                  hasKatapultFile={hasKatapultFile}
                  hasComparisonRun={hasComparisonRun}
                  hasDataToExport={hasDataToExport}
                />
              </div>
            )}

            {activeTab === 'table' && (
              <div className="content-container">
                {dataTableSection}
              </div>
            )}

            {activeTab === 'coversheet' && (
              <div className="content-container">
                <CoverSheetTable data={poleData || []} />
              </div>
            )}

            {activeTab === 'map' && (
              <div className="content-container">
                {mapSection}
              </div>
            )}

            {activeTab === 'statistics' && (
              <div className="content-container">
                {statusSection}
              </div>
            )}

            {activeTab === 'qc' && (
              <div className="content-container">
                <HeightComparisonTable spidaJson={spidaJson} katapultJson={katapultJson} />
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="content-container">
                <AIAnalytics 
                  comparisonData={comparisonData} 
                  poleData={poleData} 
                  hasComparisonRun={hasComparisonRun}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showPinModal && (
        <PinModal 
          isOpen={showPinModal} 
          onClose={handlePinClose} 
          onSuccess={handlePinSuccess} 
        />
      )}
    </div>
  );
};
