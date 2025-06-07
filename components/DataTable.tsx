import React, { useState, useMemo } from 'react';
import { ProcessedPole, MatchTier } from '../types';

interface DataTableProps {
  data: ProcessedPole[];
  onEdit: (poleId: string, field: keyof ProcessedPole, value: string | number | boolean) => void;
  onViewDetails: (pole: ProcessedPole) => void;
  onExportKatapultAttributes?: () => void;
}

// Helper function for strict visual comparison (for UI highlighting)
const hasVisualMismatch = (value1: string | null | undefined, value2: string | null | undefined, fieldType?: 'scid' | 'poleNum' | 'spec' | 'percent' | 'other'): boolean => {
  const normalize = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return '';
    let normalized = String(val).trim().toUpperCase();
    
    // Handle percentage comparison - remove % symbols for comparison
    if (normalized.endsWith('%')) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  };
  
  const norm1 = normalize(value1);
  const norm2 = normalize(value2);
  
  // Consider empty/null values as potentially matching
  if (!norm1 && !norm2) return false;
  if (!norm1 || !norm2) return true;
  
  // Handle numeric fields where leading zeros shouldn't matter (SCIDs, Pole Numbers)
  if (fieldType === 'scid' || fieldType === 'poleNum') {
    // Check if both values are numeric (with potential leading zeros)
    const isNumeric1 = /^\d+$/.test(norm1);
    const isNumeric2 = /^\d+$/.test(norm2);
    
    if (isNumeric1 && isNumeric2) {
      // Convert to numbers to ignore leading zeros
      const num1 = parseInt(norm1, 10);
      const num2 = parseInt(norm2, 10);
      return num1 !== num2;
    }
  }
  
  return norm1 !== norm2;
};

const getMismatchClass = (pole: ProcessedPole, columnKey: string): string => {
  // Skip highlighting for unmatched poles
  if (pole.matchTier === MatchTier.UNMATCHED_SPIDA || pole.matchTier === MatchTier.UNMATCHED_KATAPULT) {
    return '';
  }

  const bothPolesExist = !!(pole.spida && pole.katapult);
  if (!bothPolesExist) return '';

  switch (columnKey) {
    case 'displaySpidaScid':
    case 'displayKatapultScid':
      return hasVisualMismatch(pole.displaySpidaScid, pole.displayKatapultScid, 'scid') ? 'cell-error' : '';
    case 'displaySpidaPoleNum':
    case 'displayKatapultPoleNum':
      return hasVisualMismatch(pole.displaySpidaPoleNum, pole.displayKatapultPoleNum, 'poleNum') ? 'cell-error' : '';
    case 'editableSpidaSpec':
    case 'displayKatapultPoleSpec':
      return hasVisualMismatch(pole.editableSpidaSpec, pole.displayKatapultPoleSpec, 'spec') ? 'cell-error' : '';
    case 'editableSpidaExistingPct':
    case 'displayKatapultExistingPct':
      return hasVisualMismatch(pole.editableSpidaExistingPct, pole.displayKatapultExistingPct, 'percent') ? 'cell-error' : '';
    case 'editableSpidaFinalPct':
    case 'displayKatapultFinalPct':
      return hasVisualMismatch(pole.editableSpidaFinalPct, pole.displayKatapultFinalPct, 'percent') ? 'cell-error' : '';
    case 'editableSpidaCommDrop':
    case 'displayKatapultCommDrop':
      return hasVisualMismatch(pole.editableSpidaCommDrop, pole.displayKatapultCommDrop, 'other') ? 'cell-error' : '';
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

export const DataTable: React.FC<DataTableProps> = ({ data, onEdit, onViewDetails, onExportKatapultAttributes }) => {
  const [filterType, setFilterType] = useState<'all' | 'errors' | 'warnings' | 'edited'>('all');

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
          
          {/* Export button and Filter Controls */}
          <div className="flex items-center justify-between w-full">
            {onExportKatapultAttributes && (
              <button
                onClick={onExportKatapultAttributes}
                className="btn btn-secondary mr-4 whitespace-nowrap"
              >
                Export Katapult Attributes
              </button>
            )}
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
      </div>

      {/* Data Display – always detailed view */}
      <div className="flex-1 overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="min-w-[130px]">SPIDA SCID</th>
              <th className="min-w-[130px]">Katapult SCID</th>
              <th className="min-w-[130px]">SPIDA Pole #</th>
              <th className="min-w-[130px]">Katapult Pole #</th>
              <th className="min-w-[160px]">SPIDA Spec</th>
              <th className="min-w-[160px]">Katapult Spec</th>
              <th className="min-w-[140px]">SPIDA Existing %</th>
              <th className="min-w-[140px]">Katapult Existing %</th>
              <th className="min-w-[140px]">SPIDA Final %</th>
              <th className="min-w-[140px]">Katapult Final %</th>
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

              return (
                <tr 
                  key={pole.id} 
                  className={`${pole.isEdited ? 'is-edited' : ''}`}
                >
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
                    {pole.editableSpidaSpec || 'N/A'}
                  </td>
                  <td className={getMismatchClass(pole, 'displayKatapultPoleSpec')}>
                    {pole.displayKatapultPoleSpec || 'N/A'}
                  </td>
                  <td className={getMismatchClass(pole, 'editableSpidaExistingPct')}>
                    {pole.editableSpidaExistingPct ? `${pole.editableSpidaExistingPct}%` : 'N/A'}
                  </td>
                  <td className={getMismatchClass(pole, 'displayKatapultExistingPct')}>
                    {pole.displayKatapultExistingPct || 'N/A'}
                  </td>
                  <td className={getMismatchClass(pole, 'editableSpidaFinalPct')}>
                    {pole.editableSpidaFinalPct ? `${pole.editableSpidaFinalPct}%` : 'N/A'}
                  </td>
                  <td className={getMismatchClass(pole, 'displayKatapultFinalPct')}>
                    {pole.displayKatapultFinalPct || 'N/A'}
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
      </div>
    </div>
  );
};
