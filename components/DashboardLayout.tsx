import React, { useState, useEffect } from 'react';
import { APP_TITLE } from '../constants';
import DemoTutorial from './DemoTutorial';
import AIAnalytics from './AIAnalytics';

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
}

// Icon components for the new interface
const DatabaseIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
  </svg>
);

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

const ExportIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const StatisticsIcon: React.FC = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Step Indicator Component
const StepIndicator: React.FC<{ 
  stepNumber: number; 
  isActive: boolean; 
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  isDisabled?: boolean;
}> = ({ 
  stepNumber, 
  isActive, 
  title,
  isExpanded,
  onToggle,
  isDisabled = false
}) => (
  <button
    onClick={isDisabled ? undefined : onToggle}
    disabled={isDisabled}
    className={`
      absolute -top-3 left-1/2 transform -translate-x-1/2 z-20 flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap
      transition-all duration-500
      ${isDisabled 
        ? 'bg-slate-800/50 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
        : isActive 
          ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 shadow-lg shadow-emerald-400/50 animate-glow-pulse scale-110 cursor-pointer hover:scale-105' 
          : 'bg-slate-700/90 text-slate-300 border border-slate-600 hover:bg-slate-600/90 hover:border-slate-500 cursor-pointer hover:scale-105'
      }
      ${!isExpanded && !isDisabled ? 'ring-2 ring-slate-500 ring-opacity-50' : ''}
    `}
  >
    <span className={`
      w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
      ${isDisabled
        ? 'bg-slate-700 text-slate-500'
        : isActive 
          ? 'bg-white/20 text-slate-900' 
          : 'bg-slate-600 text-slate-400'
      }
    `}>
      {stepNumber}
    </span>
    <span className="flex-shrink-0">{title}</span>
    {!isDisabled && (
      <svg 
        className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-0' : 'rotate-180'}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    )}
  </button>
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
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">AI Analytics Access</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-slate-300 mb-2">Enter PIN to access AI Analytics:</p>
          <div className="flex items-center space-x-2 text-emerald-400 text-sm mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 1.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM12 9V7a4 4 0 118 0v4M3 15a9 9 0 1218 0" />
            </svg>
            <span>Secured AI Features</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-center text-lg tracking-widest"
              maxLength={4}
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm mt-2 flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
            >
              Access
            </button>
          </div>
        </form>
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
}) => {
  const [activeTab, setActiveTab] = useState<'demo' | 'table' | 'map' | 'analytics' | 'statistics'>('demo');
  const [hasAutoSwitchedToTable, setHasAutoSwitchedToTable] = useState(false);
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  
  // Card collapse/expand state
  const [expandedCards, setExpandedCards] = useState<{
    step1: boolean;
    step2: boolean; 
    step3: boolean;
  }>({
    step1: true,
    step2: false,  // Start collapsed until both files uploaded
    step3: false,  // Start collapsed until both files uploaded
  });

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

  // Only automatically switch to Data Table tab once after comparison is run
  useEffect(() => {
    if (hasComparisonRun && activeTab === 'demo' && !hasAutoSwitchedToTable) {
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

  // Auto-collapse completed steps
  useEffect(() => {
    const bothFilesUploaded = (hasSpidaFile ?? false) && (hasKatapultFile ?? false);
    
    // Collapse steps 2 and 3 if both files haven't been uploaded
    if (!bothFilesUploaded) {
      setExpandedCards(prev => ({
        ...prev,
        step2: false,
        step3: false
      }));
    } else {
      // Expand step 2 when both files are uploaded (unless already completed)
      if (!expandedCards.step2 && !(hasComparisonRun ?? false)) {
        setExpandedCards(prev => ({ ...prev, step2: true }));
      }
    }
    
    // Only expand step 3 when comparison has been run
    if ((hasComparisonRun ?? false) && !expandedCards.step3) {
      setExpandedCards(prev => ({ ...prev, step3: true }));
    }
    
    // Collapse step 1 when both files are uploaded
    if (bothFilesUploaded && expandedCards.step1) {
      setExpandedCards(prev => ({ ...prev, step1: false }));
    }
    
    // Collapse step 2 when comparison is run
    if ((hasComparisonRun ?? false) && expandedCards.step2) {
      setExpandedCards(prev => ({ ...prev, step2: false }));
    }
  }, [hasSpidaFile, hasKatapultFile, hasComparisonRun, expandedCards.step1, expandedCards.step2, expandedCards.step3]);

  // Determine current workflow step
  const bothFilesUploaded = (hasSpidaFile ?? false) && (hasKatapultFile ?? false);
  const isStep1Active = !bothFilesUploaded;
  const isStep2Active = bothFilesUploaded && !(hasComparisonRun ?? false);
  const isStep3Active = (hasComparisonRun ?? false) && (hasDataToExport ?? false);

  const toggleCard = (step: 'step1' | 'step2' | 'step3') => {
    const bothFilesUploaded = (hasSpidaFile ?? false) && (hasKatapultFile ?? false);
    
    // Prevent expanding step 2 or 3 if both files haven't been uploaded
    if ((step === 'step2' || step === 'step3') && !bothFilesUploaded) {
      return;
    }
    
    // Prevent expanding step 3 if comparison hasn't been run
    if (step === 'step3' && !(hasComparisonRun ?? false)) {
      return;
    }
    
    setExpandedCards(prev => ({
      ...prev,
      [step]: !prev[step]
    }));
  };

  const BookOpenIcon: React.FC = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );

  const tabs = [
    { id: 'demo' as const, name: 'Demo & Tutorial', icon: <BookOpenIcon />, description: 'Learn how to use QuiC (always available)' },
    { id: 'table' as const, name: 'Data Table', icon: <TableIcon />, description: 'Detailed comparison results' },
    { id: 'map' as const, name: 'Map View', icon: <MapIcon />, description: 'Geographic visualization' },
    { id: 'statistics' as const, name: 'Statistics', icon: <StatisticsIcon />, description: 'Match statistics & insights' },
    { id: 'analytics' as const, name: 'Analytics', icon: <AnalyticsIcon />, description: 'AI-powered data insights' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-96 h-96 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/2 w-96 h-96 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 p-3 md:p-6 space-y-4">
        {/* Header */}
        <header className="text-left">
          <div className="flex items-center space-x-4 mb-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {APP_TITLE}
            </h1>
          </div>
        </header>

        {/* Control Cards - Now 3 columns instead of 4 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 max-w-5xl mx-auto -mt-1">
          
          {/* Data Sources Card */}
          <div className={`group relative rounded-lg overflow-visible transition-all duration-500 ${isStep1Active ? 'animate-gentle-bounce' : ''}`}>
            <StepIndicator 
              stepNumber={1} 
              isActive={isStep1Active} 
              title="Load Data"
              isExpanded={expandedCards.step1}
              onToggle={() => toggleCard('step1')}
            />
            <div className={`
              transition-all duration-500 ease-in-out mt-3
              ${expandedCards.step1 
                ? 'opacity-100 max-h-96 transform translate-y-0' 
                : 'opacity-0 max-h-0 transform -translate-y-4 pointer-events-none'
              }
            `}>
              <div className="h-full [&>*]:h-full [&>*]:rounded-lg [&>*]:border-slate-700/50 [&>*]:shadow-md [&>*]:shadow-black/10 hover:[&>*]:shadow-lg hover:[&>*]:shadow-emerald-500/20 [&>*]:transition-all [&>*]:duration-300 hover:[&>*]:border-emerald-500/50 hover:[&>*]:scale-[1.01] hover:[&>*]:-translate-y-0.5">
                {dataSourceSection}
              </div>
            </div>
            {/* Fun hover border animation */}
            <div className={`
              absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm mt-3
              ${expandedCards.step1 ? '' : 'hidden'}
            `}></div>
          </div>

          {/* Analysis Card */}
          <div className={`group relative rounded-lg overflow-visible transition-all duration-500 ${isStep2Active ? 'animate-gentle-bounce' : ''}`}>
            <StepIndicator 
              stepNumber={2} 
              isActive={isStep2Active} 
              title="Analyze"
              isExpanded={expandedCards.step2}
              onToggle={() => toggleCard('step2')}
              isDisabled={!bothFilesUploaded}
            />
            <div className={`
              transition-all duration-500 ease-in-out mt-3
              ${expandedCards.step2 
                ? 'opacity-100 max-h-96 transform translate-y-0' 
                : 'opacity-0 max-h-0 transform -translate-y-4 pointer-events-none'
              }
            `}>
              <div className="h-full [&>*]:h-full [&>*]:rounded-lg [&>*]:border-slate-700/50 [&>*]:shadow-md [&>*]:shadow-black/10 hover:[&>*]:shadow-lg hover:[&>*]:shadow-yellow-500/20 [&>*]:transition-all [&>*]:duration-300 hover:[&>*]:border-yellow-500/50 hover:[&>*]:scale-[1.01] hover:[&>*]:-translate-y-0.5">
                {analysisSection}
              </div>
            </div>
            {/* Fun hover border animation */}
            <div className={`
              absolute inset-0 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm mt-3
              ${expandedCards.step2 ? '' : 'hidden'}
            `}></div>
          </div>

          {/* Export Card */}
          <div className={`group relative rounded-lg overflow-visible transition-all duration-500 ${isStep3Active ? 'animate-gentle-bounce' : ''}`}>
            <StepIndicator 
              stepNumber={3} 
              isActive={isStep3Active} 
              title="Export"
              isExpanded={expandedCards.step3}
              onToggle={() => toggleCard('step3')}
              isDisabled={!bothFilesUploaded || !(hasComparisonRun ?? false)}
            />
            <div className={`
              transition-all duration-500 ease-in-out mt-3
              ${expandedCards.step3 
                ? 'opacity-100 max-h-96 transform translate-y-0' 
                : 'opacity-0 max-h-0 transform -translate-y-4 pointer-events-none'
              }
            `}>
              <div className="h-full [&>*]:h-full [&>*]:rounded-lg [&>*]:border-slate-700/50 [&>*]:shadow-md [&>*]:shadow-black/10 hover:[&>*]:shadow-lg hover:[&>*]:shadow-blue-500/20 [&>*]:transition-all [&>*]:duration-300 hover:[&>*]:border-blue-500/50 hover:[&>*]:scale-[1.01] hover:[&>*]:-translate-y-0.5">
                {exportSection}
              </div>
            </div>
            {/* Fun hover border animation */}
            <div className={`
              absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm mt-3
              ${expandedCards.step3 ? '' : 'hidden'}
            `}></div>
          </div>
        </div>

        {/* Main Content Area with Tabs */}
        <div className="w-full max-w-none mx-auto px-4 mt-8">
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-xl shadow-black/20 overflow-hidden">
            
            {/* Tab Navigation */}
            <div className="border-b border-slate-700/50 bg-slate-900/50">
              <nav className="flex space-x-8 px-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => tab.id === 'analytics' ? handleAnalyticsTabClick() : setActiveTab(tab.id)}
                    className={`
                      relative py-4 px-2 font-medium text-sm transition-all duration-300
                      flex items-center space-x-2 group
                      ${activeTab === tab.id 
                        ? 'text-emerald-400 border-b-2 border-emerald-400' 
                        : 'text-slate-400 hover:text-slate-200'
                      }
                      ${tab.id === 'analytics' && !isAiUnlocked ? 'relative' : ''}
                    `}
                  >
                    <span className={`transition-transform duration-300 ${
                      activeTab === tab.id ? 'scale-110' : 'group-hover:scale-105'
                    }`}>
                      {tab.icon}
                    </span>
                    <span>{tab.name}</span>
                    {tab.id === 'analytics' && !isAiUnlocked && (
                      <svg className="w-4 h-4 text-yellow-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 1.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM12 9V7a4 4 0 118 0v4M3 15a9 9 0 1218 0" />
                      </svg>
                    )}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 transform origin-left animate-pulse" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="relative min-h-[800px]">
              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'demo' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full">
                  <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    <DemoTutorial />
                  </div>
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'table' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full">
                  <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    {dataTableSection}
                  </div>
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'map' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full">
                  <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    {mapSection}
                  </div>
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'statistics' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="p-6 h-full">
                  <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    <div className="p-6 h-full overflow-auto">
                      {statusSection}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'analytics' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="p-6 h-full">
                  <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    <AIAnalytics 
                      comparisonData={comparisonData} 
                      poleData={poleData} 
                      hasComparisonRun={hasComparisonRun}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm w-full max-w-none mx-auto pt-8 px-4">
          <div className="border-t border-slate-800 pt-4">
            QuiC by TechServ &copy; {new Date().getFullYear()} • Professional Utility Data Quality Control
          </div>
        </footer>
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
