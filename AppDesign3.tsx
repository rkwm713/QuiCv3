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

// Design 3: Tab-based minimal design
const AppDesign3: React.FC = () => {
  // State management
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
  
  const [statusMessage, setStatusMessage] = useState<string>('Upload files to get started');
  const [selectedPoleForModal, setSelectedPoleForModal] = useState<ProcessedPole | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  
  const [activeTab, setActiveTab] = useState<'all' | 'mismatches' | 'map'>('all');

  // Placeholder handlers
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
  
  const handleReset = () => {
    // Implementation would go here
  };

  // Filter poles based on active tab
  const filteredPoles = processedPoles.filter((pole: ProcessedPole) => {
    if (activeTab === 'mismatches') {
      return pole.isSpecMismatch || pole.isExistingPctMismatch || pole.isFinalPctMismatch || pole.isCommDropMismatch;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Minimal Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-semibold text-gray-900">QuiC</h1>
              
              {/* File Status Indicators */}
              <div className="flex items-center space-x-4 text-sm">
                <div className={`flex items-center space-x-2 ${spidaFileName ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${spidaFileName ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>SPIDA {spidaFileName ? '✓' : ''}</span>
                </div>
                <div className={`flex items-center space-x-2 ${katapultFileName ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${katapultFileName ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>Katapult {katapultFileName ? '✓' : ''}</span>
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center space-x-3">
              {processedPoles.length > 0 && (
                <>
                  <button
                    onClick={handleExportCsv}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={handleExportSpidaJson}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Export JSON
                  </button>
                  <span className="text-gray-300">|</span>
                </>
              )}
              <button
                onClick={handleReset}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Upload Section - Always visible when no comparison has been run */}
        {processedPoles.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SPIDA Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">SPIDA File</label>
                <FileLoader
                  key={`spida-${resetKey}`}
                  onFileLoad={handleSpidaFileLoad}
                  isLoading={isLoadingSpida}
                  acceptedExtensions={['.json']}
                  label="Drop or browse"
                  loadedFileName={spidaFileName}
                />
              </div>
              
              {/* Katapult Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Katapult File</label>
                <FileLoader
                  key={`katapult-${resetKey}`}
                  onFileLoad={handleKatapultFileLoad}
                  isLoading={isLoadingKatapult}
                  acceptedExtensions={['.json']}
                  label="Drop or browse"
                  loadedFileName={katapultFileName}
                />
              </div>
              
              {/* Compare Button */}
              <div className="flex items-end">
                <button
                  onClick={handleCompare}
                  disabled={!normalizedSpidaData || !normalizedKatapultData || isComparing}
                  className={`
                    w-full py-2 px-4 rounded-md font-medium transition-colors
                    ${normalizedSpidaData && normalizedKatapultData && !isComparing
                      ? 'bg-black text-white hover:bg-gray-800'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {isComparing ? 'Comparing...' : 'Compare'}
                </button>
              </div>
            </div>
            
            <StatusDisplay message={statusMessage} />
          </div>
        )}

        {/* Results Section */}
        {processedPoles.length > 0 && (
          <>
            {/* Compact Stats Bar */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-8 text-sm">
                  <div>
                    <span className="text-gray-500">Total:</span>
                    <span className="ml-2 font-medium">{comparisonStats.totalPoles}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Matches:</span>
                    <span className="ml-2 font-medium text-green-600">{comparisonStats.totalMatches}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Height Δ:</span>
                    <span className="ml-2 font-medium text-yellow-600">{comparisonStats.mismatches.height}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Class Δ:</span>
                    <span className="ml-2 font-medium text-yellow-600">{comparisonStats.mismatches.class}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Species Δ:</span>
                    <span className="ml-2 font-medium text-yellow-600">{comparisonStats.mismatches.species}</span>
                  </div>
                </div>
                
                {/* Tab Navigation */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'all'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All Poles
                  </button>
                  <button
                    onClick={() => setActiveTab('mismatches')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'mismatches'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Mismatches
                  </button>
                  <button
                    onClick={() => setActiveTab('map')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'map'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Map
                  </button>
                </div>
              </div>
            </div>

            {/* Content based on active tab */}
            <div className="bg-white rounded-lg shadow-sm">
              {activeTab !== 'map' ? (
                <DataTable
                  poles={filteredPoles}
                  onEditPole={handleEditPole}
                  onSelectPole={setSelectedPoleForModal}
                />
              ) : (
                <div className="h-[600px]">
                  <MapWithSelector
                    poles={processedPoles}
                    onPoleSelect={setSelectedPoleForModal}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </main>

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

export default AppDesign3;