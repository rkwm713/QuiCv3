import React, { useState, useMemo } from 'react';
import { SpidaJsonFullFormat, KatapultJsonFormat, ComparisonRow, QCComparisonData } from '../../types';
import { generateQCComparison } from '../../services/qcToolService';
import { QCToolTable } from './QCToolTable';
import { QCPoleSelector } from './QCPoleSelector';

interface QCToolProps {
  spidaJson: SpidaJsonFullFormat | null;
  katapultJson?: KatapultJsonFormat | null;
}

export const HeightComparison: React.FC<QCToolProps> = ({ spidaJson, katapultJson }) => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [minDeltaHeight, setMinDeltaHeight] = useState<number>(0);
  const [sortField, setSortField] = useState<keyof ComparisonRow>('key');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedPole, setSelectedPole] = useState<string | null>(null);
  const [hasRunComparison, setHasRunComparison] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Generate comparison data only after user runs comparison
  const comparisonData = useMemo((): QCComparisonData => {
    if (!hasRunComparison) {
      return { rows: [], stats: { total: 0, matches: 0, changed: 0, added: 0, removed: 0, katapultOnly: 0, katapultMismatch: 0, maxDeltaMeasRec: 0, maxDeltaMeasKat: 0, maxDeltaRecKat: 0 } };
    }
    return generateQCComparison(spidaJson, katapultJson);
  }, [spidaJson, katapultJson, hasRunComparison]);

  // Filter and sort items
  const filteredAndSortedRows = useMemo(() => {
    let rows = [...comparisonData.rows];

    // Apply pole filter first
    if (selectedPole) {
      rows = rows.filter(row => row.key.startsWith(`${selectedPole}-`));
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'All') {
      rows = rows.filter(row => row.status === statusFilter);
    }
    
    // Apply delta height filter
    if (minDeltaHeight > 0) {
      rows = rows.filter(row => {
        const maxDelta = Math.max(
          Math.abs(row.deltaHeightMeasRec || 0),
          Math.abs(row.deltaHeightMeasKat || 0),
          Math.abs(row.deltaHeightRecKat || 0)
        );
        return maxDelta >= minDeltaHeight;
      });
    }

    // Apply sorting
    rows.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      // Special handling for different sort fields
      if (sortField === 'deltaHeightMeasRec') {
        aVal = Math.abs(a.deltaHeightMeasRec || 0);
        bVal = Math.abs(b.deltaHeightMeasRec || 0);
      } else if (sortField === 'deltaHeightMeasKat') {
        aVal = Math.abs(a.deltaHeightMeasKat || 0);
        bVal = Math.abs(b.deltaHeightMeasKat || 0);
      } else if (sortField === 'deltaHeightRecKat') {
        aVal = Math.abs(a.deltaHeightRecKat || 0);
        bVal = Math.abs(b.deltaHeightRecKat || 0);
      } else if (sortField === 'key') {
        // Sort by pole SCID first, then attachment ID
        const [aPole, aAtt] = a.key.split('-');
        const [bPole, bAtt] = b.key.split('-');
        const poleComparison = aPole.localeCompare(bPole);
        if (poleComparison !== 0) return sortDirection === 'asc' ? poleComparison : -poleComparison;
        aVal = aAtt;
        bVal = bAtt;
      }
      
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return rows;
  }, [comparisonData.rows, selectedPole, statusFilter, minDeltaHeight, sortField, sortDirection]);

  const handleSort = (field: keyof ComparisonRow) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRunComparison = () => {
    if (!spidaJson) return;
    
    setIsComparing(true);
    
    // Use setTimeout to show loading state
    setTimeout(() => {
      setHasRunComparison(true);
      setIsComparing(false);
    }, 100);
  };

  if (!spidaJson) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <div className="text-center">
          <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium">No SPIDA data available</h3>
          <p className="mt-1 text-sm">Load SPIDA JSON to compare Measured vs Recommended designs</p>
        </div>
      </div>
    );
  }

  if (!hasRunComparison) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-2">QC Tool - Attachment Comparison</h2>
          <p className="text-slate-300 text-sm mb-4">
            Compare attachments from SPIDA Measured vs Recommended designs, with optional Katapult data integration.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-slate-750 rounded-lg border border-slate-600">
              <div className="flex-shrink-0">
                {spidaJson ? (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">SPIDA JSON</h3>
                <p className="text-xs text-slate-400">
                  {spidaJson ? '✓ Loaded (Required)' : 'Not loaded (Required)'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-slate-750 rounded-lg border border-slate-600">
              <div className="flex-shrink-0">
                {katapultJson ? (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Katapult JSON</h3>
                <p className="text-xs text-slate-400">
                  {katapultJson ? '✓ Loaded (Optional)' : 'Not loaded (Optional)'}
                </p>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleRunComparison}
            disabled={!spidaJson || isComparing}
            className={`
              w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2
              ${!spidaJson || isComparing
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            `}
          >
            {isComparing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Running QC Comparison...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Run QC Comparison</span>
              </>
            )}
          </button>
          
          {katapultJson && (
            <p className="text-xs text-emerald-400 mt-2 text-center">
              ✓ Three-way comparison (SPIDA Measured vs Recommended vs Katapult)
            </p>
          )}
          {!katapultJson && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Two-way comparison (SPIDA Measured vs Recommended) - Load Katapult JSON for three-way comparison
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex">
      {/* Pole Selector - moved to left side */}
      <QCPoleSelector
        rows={comparisonData.rows}
        selectedPole={selectedPole}
        onPoleSelect={setSelectedPole}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <QCToolTable
            rows={filteredAndSortedRows}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            threshold={minDeltaHeight}
            onThresholdChange={setMinDeltaHeight}
          />
        </div>
        
        {filteredAndSortedRows.length > 0 && (
          <div className="bg-slate-750 px-6 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              Showing {filteredAndSortedRows.length} of {comparisonData.stats.total} attachment comparisons
              {selectedPole && ` for pole ${selectedPole}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 