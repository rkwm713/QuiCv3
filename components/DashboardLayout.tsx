import React, { useState, useEffect, useRef } from 'react';
import { APP_TITLE } from '../constants';
import DemoTutorial from './DemoTutorial';
import AIAnalytics from './AIAnalytics';
import HeightComparisonTable from './HeightComparisonTable';
import { CoverSheetTable } from './CoverSheetTable';

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
  // Raw SPIDA data for CoverSheet
  rawSpidaData?: any;
}

interface Bolt {
  canvas: HTMLCanvasElement;
  duration: number;
}

// Icon components for the new interface
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
      absolute -top-8 left-1/2 transform -translate-x-1/2 z-20 flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap
      transition-all duration-500
      ${isDisabled 
        ? 'bg-slate-800/50 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
        : isActive 
                        ? 'swirl-yellow-white text-slate-900 shadow-lg shadow-yellow-400/50 animate-glow-pulse scale-110 cursor-pointer hover:scale-105' 
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 1.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM12 9V7a4 4 0 118 0v4M3 15a9 9 0 1118 0 9 9 0 01-18 0z" />
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
  rawSpidaData,
}) => {
  const [activeTab, setActiveTab] = useState<'demo' | 'table' | 'coversheet' | 'map' | 'analytics' | 'statistics' | 'qc'>('demo');
  const [hasAutoSwitchedToTable, setHasAutoSwitchedToTable] = useState(false);
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  // Lightning animation refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const boltsRef = useRef<Bolt[]>([]);
  const lastFrameRef = useRef<number>(Date.now());
  const flashOpacityRef = useRef<number>(0);
  
  // Animation constants
  const totalBoltDuration = 0.2;
  const boltFadeDuration = 0.1;
  const boltWidth = 4.0;
  const boltWobble = 20.0;
  
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

  // Lightning animation functions
  const setCanvasSize = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  };

  const createBoltCanvas = (startX: number, startY: number, length: number, angle: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const context = canvas.getContext('2d')!;
    
    const x = startX;
    let y = startY;
    
    context.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    context.lineWidth = boltWidth;
    context.lineCap = 'round';
    context.shadowColor = 'rgba(100, 149, 237, 0.8)';
    context.shadowBlur = 10;
    
    context.beginPath();
    context.moveTo(x, y);
    
    const segments = Math.floor(length / 10);
    for (let i = 0; i < segments; i++) {
      const segmentLength = length / segments;
      const wobbleX = (Math.random() - 0.5) * boltWobble;
      const wobbleY = (Math.random() - 0.5) * boltWobble;
      
      y += segmentLength + wobbleY;
      context.lineTo(x + wobbleX, y);
    }
    
    context.stroke();
    
    // Add some branches
    if (Math.random() > 0.7) {
      const branchY = startY + Math.random() * length * 0.7;
      const branchLength = length * 0.3;
      const branchAngle = angle + (Math.random() - 0.5) * Math.PI / 4;
      
      context.beginPath();
      context.moveTo(x, branchY);
      context.lineTo(
        x + Math.cos(branchAngle) * branchLength,
        branchY + Math.sin(branchAngle) * branchLength
      );
      context.stroke();
    }
    
    return canvas;
  };

  const launchBolt = (x: number, y: number, length: number, angle: number) => {
    const boltCanvas = createBoltCanvas(x, y, length, angle);
    const bolt: Bolt = {
      canvas: boltCanvas,
      duration: 0
    };
    
    boltsRef.current.push(bolt);
    flashOpacityRef.current = 0.3;
  };

  const tick = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d')!;
    const frame = Date.now();
    const elapsed = (frame - lastFrameRef.current) / 1000.0;
    lastFrameRef.current = frame;
    
    // Clear the canvas
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    
    // Fire a bolt every once in a while
    if (Math.random() > 0.9985) {
      const x = Math.floor(-10 + Math.random() * (window.innerWidth + 20));
      const y = 0; // Always start from the very top of the screen
      const length = Math.floor(window.innerHeight / 2 + Math.random() * (window.innerHeight / 2));
      
      launchBolt(x, y, length, Math.PI * 3 / 2);
    }
    
    // Draw the flash
    if (flashOpacityRef.current > 0) {
      context.fillStyle = `rgba(255, 255, 255, ${flashOpacityRef.current})`;
      context.fillRect(0, 0, window.innerWidth, window.innerHeight);
      flashOpacityRef.current = Math.max(0, flashOpacityRef.current - 2.0 * elapsed);
    }
    
    // Draw each bolt
    const bolts = boltsRef.current;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const bolt = bolts[i];
      bolt.duration += elapsed;
      
      if (bolt.duration >= totalBoltDuration) {
        bolts.splice(i, 1);
        continue;
      }
      
      context.globalAlpha = Math.max(0, Math.min(1, (totalBoltDuration - bolt.duration) / boltFadeDuration));
      context.drawImage(bolt.canvas, 0, 0);
    }
    
    context.globalAlpha = 1.0;
    animationFrameRef.current = requestAnimationFrame(tick);
  };

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

  // Lightning animation setup
  useEffect(() => {
    setCanvasSize();
    
    const handleResize = () => {
      setCanvasSize();
    };
    
    window.addEventListener('resize', handleResize);
    animationFrameRef.current = requestAnimationFrame(tick);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

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
    { id: 'coversheet' as const, name: 'CoverSheet', icon: <CoverSheetIcon />, description: 'Generate cover sheet from SPIDA data with AI-powered notes' },
    { id: 'map' as const, name: 'Map View', icon: <MapIcon />, description: 'Geographic visualization' },
    { id: 'statistics' as const, name: 'Statistics', icon: <StatisticsIcon />, description: 'Match statistics & insights' },
    { id: 'qc' as const, name: 'Height Comparison', icon: <QCIcon />, description: 'Compare pole heights, wires, and attachments between systems' },
    { id: 'analytics' as const, name: 'Analytics', icon: <AnalyticsIcon />, description: 'AI-powered data insights' },
  ];

  return (
    <div className="h-screen animated-gradient-bg flex flex-col relative">
      {/* Lightning canvas background */}
      <canvas 
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'transparent' }}
      />
      
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-10">
        <div className="absolute -top-1/2 -right-1/2 w-96 h-96 bg-gradient-to-br from-yellow-400/5 to-blue-500/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-1/2 -left-1/2 w-96 h-96 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-20 flex flex-col h-full">
        {/* Header and Cards - Fixed Height */}
        <div className="flex-shrink-0 p-3 md:p-6 space-y-4">
        {/* Header */}
        <header className="text-left">
          <div className="flex items-center space-x-4 mb-2">
            <h1 className="text-5xl font-bold text-slate-200" style={{
              filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.3))'
            }}>
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
              <div className="h-full">
                {dataSourceSection}
              </div>
            </div>
            {/* Fun hover border animation */}
            <div className={`
                              absolute inset-0 rounded-lg bg-gradient-to-r from-yellow-400/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm mt-3
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
              <div className="h-full">
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
              <div className="h-full">
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

        </div>

        {/* Main Content Area with Tabs - Flexible Height */}
        <div className="flex-1 flex flex-col w-full max-w-none mx-auto px-4 mt-8 min-h-0">
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-xl shadow-black/20 overflow-hidden flex flex-col h-full">
            
            {/* Tab Navigation */}
            <div className="flex-shrink-0 border-b border-slate-700/50 bg-slate-900/50">
              <nav className="flex space-x-8 px-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => tab.id === 'analytics' ? handleAnalyticsTabClick() : setActiveTab(tab.id)}
                    className={`
                      relative py-4 px-2 font-medium text-sm transition-all duration-300
                      flex items-center space-x-2 group
                      ${activeTab === tab.id 
                        ? 'text-yellow-400 border-b-2 border-yellow-400' 
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 1.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM12 9V7a4 4 0 118 0v4M3 15a9 9 0 1118 0 9 9 0 01-18 0z" />
                      </svg>
                    )}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 solid-yellow-glow transform origin-left" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="relative flex-1 min-h-0">
              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'demo' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                  <DemoTutorial />
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'table' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                  {dataTableSection}
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'coversheet' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                  <CoverSheetTable data={poleData || []} />
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'map' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                  {mapSection}
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'statistics' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full flex flex-col p-6">
                  <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    <div className="p-6 h-full overflow-auto">
                      {statusSection}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'qc' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full flex flex-col p-6">
                  <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    <div className="p-6 h-full overflow-auto">
                      <HeightComparisonTable poles={poleData || []} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`
                absolute inset-0 transition-all duration-500 transform
                ${activeTab === 'analytics' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
              `}>
                <div className="h-full flex flex-col p-6">
                  <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
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
