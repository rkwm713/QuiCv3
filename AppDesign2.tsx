import React, { useState, useCallback, useEffect } from 'react';
import { FileLoader } from './components/FileLoader';
import { DataTable } from './components/DataTable';
import { MapWithSelector } from './components/MapWithSelector';
import { StatusDisplay } from './components/StatusDisplay';
import { PoleDetailModal } from './components/PoleDetailModal';
import { 
  IntermediateSpidaPole,
  ProcessedPole, 
  NormalizedPole, 
  ComparisonStats, 
  KatapultJsonFormat, 
  KatapultJsonNode,
  KatapultBirthmarkData,
  Coordinate,
  SpidaLocation,
  SpidaDesign,
  SpidaJsonFullFormat,
  SpidaProjectStructure,
  SpidaDesignPoleStructure,
  MatchTier
} from './types';
import { 
  normalizeSpidaData, 
  normalizeKatapultData, 
  performComparison, 
  recalculateMismatchFlags,
  buildSpidaAliasTable,
  getAnalysisLoadPercent, 
  getSpidaCommDrop, 
  _to_feet_ts, 
  getFirstValueFromKatapultAttribute, 
  commonNormalizePoleNum 
} from './services/dataProcessingService';
import { generateSpidaJsonWithUpdates, exportToCsv, exportKatapultAttributeUpdateExcel } from './services/exportService';
import { INITIAL_STATS, ALLOWED_KATAPULT_NODE_TYPES }  from './constants';

// Design 2: Sidebar Navigation Layout
const AppDesign2: React.FC = () => {
  // State management (same as Design 1)
  const [rawSpidaJson, setRawSpidaJson] = useState<SpidaJsonFullFormat | null>(null);
  const [_spidaAliasTable, setSpidaAliasTable] = useState<Record<string, string>>({});
  const [normalizedSpidaData, setNormalizedSpidaData] = useState<NormalizedPole[] | null>(null);
  const [spidaFileName, setSpidaFileName] = useState<string | null>(null);
  
  const [_rawKatapultJsonFull, setRawKatapultJsonFull] = useState<KatapultJsonFormat | null>(null);
  const [_katapultBirthmarks, setKatapultBirthmarks] = useState<Record<string, KatapultBirthmarkData>>({});
  const [normalizedKatapultData, setNormalizedKatapultData] = useState<NormalizedPole[] | null>(null);
  const [katapultFileName, setKatapultFileName] = useState<string | null>(null);

  const [processedPoles, setProcessedPoles] = useState<ProcessedPole[]>([]);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats>(INITIAL_STATS);
  
  const [isLoadingSpida, setIsLoadingSpida] = useState(false);
  const [isLoadingKatapult, setIsLoadingKatapult] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  
  const [statusMessage, setStatusMessage] = useState<string>('Start by uploading files');
  const [selectedPoleForModal, setSelectedPoleForModal] = useState<ProcessedPole | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  
  const [activeView, setActiveView] = useState<'upload' | 'results' | 'map' | 'export'>('upload');

  // Helper functions and handlers would go here (same as Design 1)
  // ... all the handler functions ...
  
  // Placeholder handlers for the design mockup
  const handleSpidaFileLoad = (fileName: string, content: string) => {
    // Implementation would go here
  };
  
  const handleKatapultFileLoad = (fileName: string, content: string) => {
    // Implementation would go here  
  };
  
  const handleCompare = () => {
    // Implementation would go here
  };
  
  const handleEditPole = (poleId: string, field: keyof ProcessedPole, value: any) => {
    // Implementation would go here
  };
  
  const handleExportCsv = () => {
    // Implementation would go here
  };
  
  const handleExportSpidaJson = () => {
    // Implementation would go here
  };
  
  const handleExportKatapultExcel = () => {
    // Implementation would go here
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white">
        <div className="p-6">
          <h1 className="text-2xl font-bold">QuiC</h1>
          <p className="text-sm text-gray-400 mt-1">Quality Control</p>
        </div>
        
        <nav className="mt-8">
          <button
            onClick={() => setActiveView('upload')}
            className={`w-full px-6 py-3 text-left flex items-center space-x-3 hover:bg-gray-800 transition-colors ${
              activeView === 'upload' ? 'bg-gray-800 border-l-4 border-blue-500' : ''
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Files</span>
            {normalizedSpidaData && normalizedKatapultData && (
              <svg className="w-4 h-4 ml-auto text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          <button
            onClick={() => setActiveView('results')}
            disabled={processedPoles.length === 0}
            className={`w-full px-6 py-3 text-left flex items-center space-x-3 hover:bg-gray-800 transition-colors ${
              activeView === 'results' ? 'bg-gray-800 border-l-4 border-blue-500' : ''
            } ${processedPoles.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <span>Results</span>
          </button>
          
          <button
            onClick={() => setActiveView('map')}
            disabled={processedPoles.length === 0}
            className={`w-full px-6 py-3 text-left flex items-center space-x-3 hover:bg-gray-800 transition-colors ${
              activeView === 'map' ? 'bg-gray-800 border-l-4 border-blue-500' : ''
            } ${processedPoles.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Map View</span>
          </button>
          
          <button
            onClick={() => setActiveView('export')}
            disabled={processedPoles.length === 0}
            className={`w-full px-6 py-3 text-left flex items-center space-x-3 hover:bg-gray-800 transition-colors ${
              activeView === 'export' ? 'bg-gray-800 border-l-4 border-blue-500' : ''
            } ${processedPoles.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export</span>
          </button>
        </nav>
        
        {/* Stats Summary */}
        {processedPoles.length > 0 && (
          <div className="mt-auto p-6 border-t border-gray-800">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Poles</span>
                <span className="font-medium">{comparisonStats.totalPoles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Matches</span>
                <span className="font-medium text-green-400">{comparisonStats.totalMatches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Mismatches</span>
                <span className="font-medium text-yellow-400">
                  {comparisonStats.mismatches.height + comparisonStats.mismatches.class + comparisonStats.mismatches.species}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Upload View */}
          {activeView === 'upload' && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Upload Files</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">SPIDA File</h3>
                  <FileLoader
                    key={`spida-${resetKey}`}
                    onFileLoad={handleSpidaFileLoad}
                    isLoading={isLoadingSpida}
                    acceptedExtensions={['.json']}
                    label="Drop SPIDA JSON or click to browse"
                    loadedFileName={spidaFileName}
                  />
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Katapult File</h3>
                  <FileLoader
                    key={`katapult-${resetKey}`}
                    onFileLoad={handleKatapultFileLoad}
                    isLoading={isLoadingKatapult}
                    acceptedExtensions={['.json']}
                    label="Drop Katapult JSON or click to browse"
                    loadedFileName={katapultFileName}
                  />
                </div>
              </div>
              
              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleCompare}
                  disabled={!normalizedSpidaData || !normalizedKatapultData || isComparing}
                  className={`
                    px-8 py-3 rounded-lg font-medium flex items-center space-x-2
                    ${normalizedSpidaData && normalizedKatapultData && !isComparing
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{isComparing ? 'Comparing...' : 'Run Comparison'}</span>
                </button>
              </div>
              
              <StatusDisplay message={statusMessage} />
            </div>
          )}

          {/* Results View */}
          {activeView === 'results' && processedPoles.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Comparison Results</h2>
              <DataTable
                poles={processedPoles}
                onEditPole={handleEditPole}
                onSelectPole={setSelectedPoleForModal}
              />
            </div>
          )}

          {/* Map View */}
          {activeView === 'map' && processedPoles.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Map View</h2>
              <div className="h-[calc(100vh-200px)] bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <MapWithSelector
                  poles={processedPoles}
                  onPoleSelect={setSelectedPoleForModal}
                />
              </div>
            </div>
          )}

          {/* Export View */}
          {activeView === 'export' && processedPoles.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Export Data</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  onClick={handleExportCsv}
                  className="bg-white border-2 border-gray-300 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all"
                >
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Export CSV</h3>
                  <p className="text-sm text-gray-500">Download comparison results as CSV</p>
                </button>
                
                <button
                  onClick={handleExportSpidaJson}
                  className="bg-white border-2 border-gray-300 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all"
                >
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Export SPIDA JSON</h3>
                  <p className="text-sm text-gray-500">Save updated SPIDA data</p>
                </button>
                
                <button
                  onClick={handleExportKatapultExcel}
                  className="bg-white border-2 border-gray-300 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all"
                >
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.747 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Export Katapult Excel</h3>
                  <p className="text-sm text-gray-500">Generate attribute update file</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pole Detail Modal */}
      {selectedPoleForModal && (
        <PoleDetailModal
          pole={selectedPoleForModal}
          onClose={() => setSelectedPoleForModal(null)}
          onEdit={handleEditPole}
        />
      )}
    </div>
  );
};

export default AppDesign2;