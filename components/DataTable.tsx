import React, { useState, useMemo } from 'react';
import { ProcessedPole, MatchTier } from '../types';

interface DataTableProps {
  data: ProcessedPole[];
  onEdit: (poleId: string, field: keyof ProcessedPole, value: string | number | boolean) => void;
  onViewDetails: (pole: ProcessedPole) => void;
}

const getMismatchClass = (pole: ProcessedPole, columnKey: string): string => {
  switch (columnKey) {
    case 'displaySpidaScid':
    case 'displayKatapultScid':
      return pole.isScidMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? 'cell-error' : '';
    case 'displaySpidaPoleNum':
    case 'displayKatapultPoleNum':
      return pole.isPoleNumMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? 'cell-error' : '';
    case 'editableSpidaSpec':
    case 'displayKatapultPoleSpec':
      return pole.isSpecMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? 'cell-error' : '';
    case 'editableSpidaExistingPct':
    case 'displayKatapultExistingPct':
      return pole.isExistingPctMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? 'cell-error' : '';
    case 'editableSpidaFinalPct':
    case 'displayKatapultFinalPct':
      return pole.isFinalPctMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? 'cell-error' : '';
    case 'editableSpidaCommDrop':
    case 'displayKatapultCommDrop':
      return pole.isCommDropMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? 'cell-error' : '';
    default:
      return '';
  }
};

const hasErrors = (pole: ProcessedPole): boolean => {
  return pole.isScidMismatch || 
         pole.isPoleNumMismatch || 
         pole.isSpecMismatch || 
         pole.isExistingPctMismatch || 
         pole.isFinalPctMismatch || 
         pole.isCommDropMismatch;
};

// Helper function to parse percentage string to number
const parsePercentage = (pctStr: string): number | null => {
  if (!pctStr || pctStr === 'N/A' || pctStr === '') return null;
  const numValue = parseFloat(pctStr.toString().replace('%', ''));
  return isNaN(numValue) ? null : numValue;
};

// Function to check if a pole should be flagged yellow for review
const shouldFlagForReview = (pole: ProcessedPole, columnKey: string): boolean => {
  // Check for loading > 90% in any loading column
  if (columnKey === 'editableSpidaExistingPct' || columnKey === 'displayKatapultExistingPct' ||
      columnKey === 'editableSpidaFinalPct' || columnKey === 'displayKatapultFinalPct') {
    
    let pctValue: number | null = null;
    
    if (columnKey === 'editableSpidaExistingPct') {
      pctValue = parsePercentage(pole.editableSpidaExistingPct);
    } else if (columnKey === 'displayKatapultExistingPct') {
      pctValue = parsePercentage(pole.displayKatapultExistingPct);
    } else if (columnKey === 'editableSpidaFinalPct') {
      pctValue = parsePercentage(pole.editableSpidaFinalPct);
    } else if (columnKey === 'displayKatapultFinalPct') {
      pctValue = parsePercentage(pole.displayKatapultFinalPct);
    }
    
    if (pctValue !== null && pctValue > 90) {
      return true;
    }
  }
  
  // Check for difference > 45% between recommended and measured percentages
  if (columnKey === 'editableSpidaExistingPct' || columnKey === 'editableSpidaFinalPct' ||
      columnKey === 'displayKatapultExistingPct' || columnKey === 'displayKatapultFinalPct') {
    
    // For SPIDA columns, compare existing vs final
    if (columnKey === 'editableSpidaExistingPct' || columnKey === 'editableSpidaFinalPct') {
      const existingPct = parsePercentage(pole.editableSpidaExistingPct);
      const finalPct = parsePercentage(pole.editableSpidaFinalPct);
      
      if (existingPct !== null && finalPct !== null) {
        const difference = Math.abs(existingPct - finalPct);
        if (difference > 45) {
          return true;
        }
      }
    }
    
    // For Katapult columns, compare existing vs final
    if (columnKey === 'displayKatapultExistingPct' || columnKey === 'displayKatapultFinalPct') {
      const existingPct = parsePercentage(pole.displayKatapultExistingPct);
      const finalPct = parsePercentage(pole.displayKatapultFinalPct);
      
      if (existingPct !== null && finalPct !== null) {
        const difference = Math.abs(existingPct - finalPct);
        if (difference > 45) {
          return true;
        }
      }
    }
  }
  
  return false;
};

// Get match tier badge styling
const getMatchTierBadge = (tier: MatchTier) => {
  const badgeConfig = {
    [MatchTier.SCID_EXACT_MATCH]: { label: 'Exact Match', class: 'badge-success' },
    [MatchTier.POLE_NUMBER_MATCH]: { label: 'Pole Number', class: 'badge-info' },
    [MatchTier.COORDINATE_DIRECT_MATCH]: { label: 'Coordinate', class: 'badge-warning' },
    [MatchTier.COORDINATE_SPEC_VERIFIED]: { label: 'Coord + Spec', class: 'badge-warning' },
    [MatchTier.UNMATCHED_SPIDA]: { label: 'Unmatched SPIDA', class: 'badge-error' },
    [MatchTier.UNMATCHED_KATAPULT]: { label: 'Unmatched Katapult', class: 'badge-error' },
  };
  return badgeConfig[tier];
};

export const DataTable: React.FC<DataTableProps> = ({ data, onEdit, onViewDetails }) => {
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [filterType, setFilterType] = useState<'all' | 'errors' | 'warnings' | 'edited'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const errorCount = data.filter(hasErrors).length;
    const reviewCount = data.filter(pole => 
      shouldFlagForReview(pole, 'editableSpidaExistingPct') ||
      shouldFlagForReview(pole, 'displayKatapultExistingPct') ||
      shouldFlagForReview(pole, 'editableSpidaFinalPct') ||
      shouldFlagForReview(pole, 'displayKatapultFinalPct')
    ).length;
    const editedCount = data.filter(pole => pole.isEdited).length;
    
    return { errorCount, reviewCount, editedCount, totalCount: data.length };
  }, [data]);

  const filteredData = useMemo(() => {
    switch (filterType) {
      case 'errors':
        return data.filter(hasErrors);
      case 'warnings':
        return data.filter(pole => 
          shouldFlagForReview(pole, 'editableSpidaExistingPct') ||
          shouldFlagForReview(pole, 'displayKatapultExistingPct') ||
          shouldFlagForReview(pole, 'editableSpidaFinalPct') ||
          shouldFlagForReview(pole, 'displayKatapultFinalPct')
        );
      case 'edited':
        return data.filter(pole => pole.isEdited);
      default:
        return data;
    }
  }, [data, filterType]);

  const toggleRowExpansion = (poleId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(poleId)) {
      newExpanded.delete(poleId);
    } else {
      newExpanded.add(poleId);
    }
    setExpandedRows(newExpanded);
  };

  if (!data || data.length === 0) {
    return (
      <div className="card h-full flex flex-col items-center justify-center text-center py-12">
        <div className="flex flex-col items-center space-y-6">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H9a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <h3 className="card-title">No comparison data</h3>
            <p className="card-description mt-2">
              Load your SPIDA and Katapult JSON files, then run the comparison to see detailed results here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (poleId: string, field: keyof ProcessedPole, value: string) => {
    onEdit(poleId, field, value);
  };

  return (
    <div className="card h-full flex flex-col p-0">
      {/* Header without Summary Cards */}
      <div className="border-b border-primary p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="card-title">Katapult Attribute Check</h3>
            <p className="card-description">Verify pole heights, wires, and attachments match between Katapult and SPIDAcalc</p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'summary' 
                  ? 'bg-accent text-white' 
                  : 'bg-secondary text-secondary hover:bg-hover'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'detailed' 
                  ? 'bg-accent text-white' 
                  : 'bg-secondary text-secondary hover:bg-hover'
              }`}
            >
              Detailed
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-secondary">Status:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="select"
            >
              <option value="all">All Statuses</option>
              <option value="errors">Errors Only</option>
              <option value="warnings">Warnings Only</option>
              <option value="edited">Edited Only</option>
            </select>
          </div>
          
          <div className="text-sm text-muted">
            Showing {filteredData.length} of {stats.totalCount} items
          </div>
        </div>
      </div>

      {/* Data Display */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'summary' ? (
          /* Summary View - Card-based layout */
          <div className="p-6 space-y-4">
            {filteredData.map((pole) => {
              const hasError = hasErrors(pole);
              const hasWarning = shouldFlagForReview(pole, 'editableSpidaExistingPct') ||
                               shouldFlagForReview(pole, 'displayKatapultExistingPct') ||
                               shouldFlagForReview(pole, 'editableSpidaFinalPct') ||
                               shouldFlagForReview(pole, 'displayKatapultFinalPct');
              const isExpanded = expandedRows.has(pole.id);
              const tierBadge = getMatchTierBadge(pole.matchTier);

              return (
                <div
                  key={pole.id}
                  className={`card transition-all hover:shadow-lg ${
                    hasError ? 'border-error' : hasWarning ? 'border-warning' : pole.isEdited ? 'border-accent' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Match Tier Badge */}
                      <div className={`badge ${tierBadge.class}`}>
                        {tierBadge.label}
                      </div>
                      
                      {/* Primary Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="text-sm font-medium text-primary">
                              SPIDA: {pole.displaySpidaScid || 'N/A'}
                            </div>
                            <div className="text-xs text-secondary">
                              Pole: {pole.displaySpidaPoleNum || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-primary">
                              Katapult: {pole.displayKatapultScid || 'N/A'}
                            </div>
                            <div className="text-xs text-secondary">
                              Pole: {pole.displayKatapultPoleNum || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status Indicators */}
                      <div className="flex items-center space-x-2">
                        {hasError && (
                          <span className="badge badge-error">Error</span>
                        )}
                        {hasWarning && (
                          <span className="badge badge-warning">Review</span>
                        )}
                        {pole.isEdited && (
                          <span className="badge badge-info">Edited</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onViewDetails(pole)}
                        className="btn btn-ghost btn-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => toggleRowExpansion(pole.id)}
                        className="btn btn-ghost btn-sm"
                      >
                        <svg 
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-primary">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-secondary mb-2">SPIDA Data</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted">Spec:</span>
                              <span className="text-primary">{pole.editableSpidaSpec || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted">Existing %:</span>
                              <span className="text-primary">{pole.editableSpidaExistingPct || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted">Final %:</span>
                              <span className="text-primary">{pole.editableSpidaFinalPct || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted">Comm Drop:</span>
                              <span className="text-primary">{pole.editableSpidaCommDrop || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-semibold text-secondary mb-2">Katapult Data</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted">Spec:</span>
                              <span className="text-primary">{pole.displayKatapultPoleSpec || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted">Existing %:</span>
                              <span className="text-primary">{pole.displayKatapultExistingPct || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted">Final %:</span>
                              <span className="text-primary">{pole.displayKatapultFinalPct || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted">Comm Drop:</span>
                              <span className="text-primary">{pole.displayKatapultCommDrop || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Detailed View - Improved Table */
          <table className="table">
            <thead>
              <tr>
                <th className="sticky-column min-w-[180px]">Match Tier</th>
                <th className="min-w-[130px]">SPIDA SCID</th>
                <th className="min-w-[130px]">Katapult SCID</th>
                <th className="min-w-[130px]">SPIDA Pole #</th>
                <th className="min-w-[130px]">Katapult Pole #</th>
                <th className="min-w-[160px]">SPIDA Spec</th>
                <th className="min-w-[160px]">Katapult Spec</th>
                <th className="min-w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((pole) => {
                const hasError = hasErrors(pole);
                const hasWarning = shouldFlagForReview(pole, 'editableSpidaExistingPct') ||
                                 shouldFlagForReview(pole, 'displayKatapultExistingPct') ||
                                 shouldFlagForReview(pole, 'editableSpidaFinalPct') ||
                                 shouldFlagForReview(pole, 'displayKatapultFinalPct');
                const tierBadge = getMatchTierBadge(pole.matchTier);

                return (
                  <tr 
                    key={pole.id} 
                    className={`${
                      hasError ? 'has-error' : 
                      hasWarning ? 'has-warning' : 
                      pole.isEdited ? 'is-edited' : ''
                    }`}
                  >
                    <td className="sticky-column">
                      <div className={`badge ${tierBadge.class}`}>
                        {tierBadge.label}
                      </div>
                    </td>
                    <td className={getMismatchClass(pole, 'displaySpidaScid')}>
                      {pole.displaySpidaScid || 'N/A'}
                    </td>
                    <td className={getMismatchClass(pole, 'displayKatapultScid')}>
                      {pole.displayKatapultScid || 'N/A'}
                    </td>
                    <td className={getMismatchClass(pole, 'displaySpidaPoleNum')}>
                      {pole.displaySpidaPoleNum || 'N/A'}
                    </td>
                    <td className={getMismatchClass(pole, 'displayKatapultPoleNum')}>
                      {pole.displayKatapultPoleNum || 'N/A'}
                    </td>
                    <td className={getMismatchClass(pole, 'editableSpidaSpec')}>
                      {pole.spida ? (
                        <input
                          type="text"
                          value={pole.editableSpidaSpec}
                          onChange={(e) => handleInputChange(pole.id, 'editableSpidaSpec', e.target.value)}
                          className="input w-full"
                        />
                      ) : (
                        pole.editableSpidaSpec || 'N/A'
                      )}
                    </td>
                    <td className={getMismatchClass(pole, 'displayKatapultPoleSpec')}>
                      {pole.displayKatapultPoleSpec || 'N/A'}
                    </td>
                    <td>
                      <button 
                        onClick={() => onViewDetails(pole)}
                        className="btn btn-ghost btn-sm"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
