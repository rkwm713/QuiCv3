import React from 'react';

interface DataManagementProps {
  dataSourceSection: React.ReactNode;
  analysisSection: React.ReactNode;
  exportSection: React.ReactNode;
  statusSection: React.ReactNode;
  hasSpidaFile?: boolean;
  hasKatapultFile?: boolean;
  hasComparisonRun?: boolean;
  hasDataToExport?: boolean;
}

// Step indicator component
const StepIndicator: React.FC<{ 
  stepNumber: number; 
  isActive: boolean; 
  title: string;
  isCompleted: boolean;
  isDisabled?: boolean;
}> = ({ 
  stepNumber, 
  isActive, 
  title,
  isCompleted,
  isDisabled = false
}) => (
  <div className={`flex items-center space-x-3 p-4 rounded-lg border transition-all ${
    isDisabled 
      ? 'border-slate-600 bg-slate-800 opacity-50 cursor-not-allowed' 
      : isActive 
        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' 
        : isCompleted 
          ? 'border-green-500 bg-green-500/10 text-green-300'
          : 'border-slate-600 bg-slate-800 hover:border-slate-500'
  }`}>
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
      isDisabled
        ? 'bg-slate-700 text-slate-500'
        : isActive || isCompleted
          ? 'bg-white/20 text-white'
          : 'bg-slate-700 text-slate-400'
    }`}>
      {isCompleted ? '✓' : stepNumber}
    </div>
    <div>
      <span className="font-semibold text-lg">{title}</span>
      <div className="text-sm text-slate-400 mt-1">
        {stepNumber === 1 && "Upload your SPIDA and Katapult JSON files"}
        {stepNumber === 2 && "Run comparison analysis on your data"}
        {stepNumber === 3 && "Export results and reports"}
      </div>
    </div>
  </div>
);

export const DataManagement: React.FC<DataManagementProps> = ({
  dataSourceSection,
  analysisSection,
  exportSection,
  statusSection,
  hasSpidaFile,
  hasKatapultFile,
  hasComparisonRun,
  hasDataToExport,
}) => {
  // Determine workflow steps
  const bothFilesUploaded = (hasSpidaFile ?? false) && (hasKatapultFile ?? false);
  const isStep1Active = !bothFilesUploaded;
  const isStep1Completed = bothFilesUploaded;
  const isStep2Active = bothFilesUploaded && !(hasComparisonRun ?? false);
  const isStep2Completed = (hasComparisonRun ?? false);
  const isStep3Active = (hasComparisonRun ?? false) && (hasDataToExport ?? false);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Data Management</h1>
        <p className="text-slate-300">
          Load your data files, run analysis, and export results. Follow the steps below to process your SPIDA and Katapult data.
        </p>
      </div>

      {/* Workflow Steps */}
      <div className="space-y-8">
        {/* Step 1: Load Data */}
        <div className="space-y-4">
          <StepIndicator 
            stepNumber={1} 
            isActive={isStep1Active} 
            title="Load Data"
            isCompleted={isStep1Completed}
          />
          {(isStep1Active || !isStep1Completed) && (
            <div className="ml-16 space-y-4">
              {dataSourceSection}
            </div>
          )}
        </div>

        {/* Step 2: Analyze */}
        <div className="space-y-4">
          <StepIndicator 
            stepNumber={2} 
            isActive={isStep2Active} 
            title="Analyze Data"
            isCompleted={isStep2Completed}
            isDisabled={!bothFilesUploaded}
          />
          {(isStep2Active || (!isStep2Completed && bothFilesUploaded)) && (
            <div className="ml-16 space-y-4">
              {analysisSection}
            </div>
          )}
        </div>

        {/* Step 3: Export */}
        <div className="space-y-4">
          <StepIndicator 
            stepNumber={3} 
            isActive={isStep3Active} 
            title="Export Results"
            isCompleted={false}
            isDisabled={!bothFilesUploaded || !(hasComparisonRun ?? false)}
          />
          {isStep3Active && (
            <div className="ml-16 space-y-4">
              {exportSection}
            </div>
          )}
        </div>
      </div>

      {/* Status Section */}
      {hasComparisonRun && (
        <div className="border-t border-slate-700 pt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Analysis Results</h2>
          {statusSection}
        </div>
      )}
    </div>
  );
}; 