import React, { useState, useMemo } from 'react';
import { ProcessedPole, MatchTier } from '../types';
import { TABLE_COLUMNS, MATCH_TIER_COLORS, MISMATCH_HIGHLIGHT_CLASS, EDIT_HIGHLIGHT_CLASS } from '../constants';

interface DataTableProps {
  data: ProcessedPole[];
  onEdit: (poleId: string, field: keyof ProcessedPole, value: string | number | boolean) => void;
  onViewDetails: (pole: ProcessedPole) => void;
}

const getMismatchClass = (pole: ProcessedPole, columnKey: string): string => {
  switch (columnKey) {
    case 'displaySpidaScid':
    case 'displayKatapultScid':
      return pole.isScidMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? MISMATCH_HIGHLIGHT_CLASS : '';
    case 'displaySpidaPoleNum':
    case 'displayKatapultPoleNum':
      return pole.isPoleNumMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? MISMATCH_HIGHLIGHT_CLASS : '';
    case 'editableSpidaSpec':
    case 'displayKatapultPoleSpec':
      return pole.isSpecMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? MISMATCH_HIGHLIGHT_CLASS : '';
    case 'editableSpidaExistingPct':
    case 'displayKatapultExistingPct':
      return pole.isExistingPctMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? MISMATCH_HIGHLIGHT_CLASS : '';
    case 'editableSpidaFinalPct':
    case 'displayKatapultFinalPct':
      return pole.isFinalPctMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? MISMATCH_HIGHLIGHT_CLASS : '';
    case 'editableSpidaCommDrop':
    case 'displayKatapultCommDrop':
      return pole.isCommDropMismatch && pole.matchTier !== MatchTier.UNMATCHED_SPIDA && pole.matchTier !== MatchTier.UNMATCHED_KATAPULT ? MISMATCH_HIGHLIGHT_CLASS : '';
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

export const DataTable: React.FC<DataTableProps> = ({ data, onEdit, onViewDetails }) => {
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const filteredData = useMemo(() => {
    if (!showErrorsOnly) return data;
    return data.filter(hasErrors);
  }, [data, showErrorsOnly]);

  const errorCount = useMemo(() => {
    return data.filter(hasErrors).length;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H9a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-200">No comparison data</h3>
          <p className="text-slate-400 max-w-md">
            Load your SPIDA and Katapult JSON files, then run the comparison to see detailed results here.
          </p>
        </div>
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-100"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-200"></div>
        </div>
      </div>
    );
  }

  const handleInputChange = (poleId: string, field: keyof ProcessedPole, value: string) => {
    onEdit(poleId, field, value);
  };

  const handleSelectChange = (poleId: string, field: keyof ProcessedPole, value: string) => {
     onEdit(poleId, field, value as 'Yes' | 'No' | '');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Table Header with Summary and Filter Toggle */}
      <div className="flex-shrink-0 p-4 bg-slate-800/90 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Comparison Results</h3>
            <div className="flex items-center space-x-4 text-sm text-slate-400">
              <span>
                Showing {filteredData.length} of {data.length} pole{data.length !== 1 ? 's' : ''}
              </span>
              {errorCount > 0 && (
                <span className="text-red-400">
                  ({errorCount} with errors)
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Filter Toggle */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-300">Filter:</span>
              <div className="flex items-center space-x-2">
                <span className={`text-xs transition-colors duration-200 ${!showErrorsOnly ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                  All
                </span>
                <button
                  onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-800
                    ${showErrorsOnly ? 'bg-red-500' : 'bg-slate-600'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
                      ${showErrorsOnly ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
                <span className={`text-xs transition-colors duration-200 ${showErrorsOnly ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                  Errors Only
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-4 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500/30 rounded"></div>
                <span>Mismatch</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500/30 rounded"></div>
                <span>Edited</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full divide-y divide-slate-700/50">
            <thead className="bg-slate-800/50 sticky top-0 z-10">
              <tr>
                {TABLE_COLUMNS.map((col, index) => (
                  <th 
                    key={col.key} 
                    scope="col" 
                    className={`
                      px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider
                      border-r border-slate-700/30 last:border-r-0
                      ${col.className || ''}
                      ${index === 0 ? 'sticky left-0 bg-slate-800/90 z-20' : ''}
                    `}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{col.label}</span>
                      {col.editable && (
                        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider min-w-[120px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredData.map((pole, rowIndex) => (
                <tr 
                  key={pole.id} 
                  className={`
                    group transition-all duration-200
                    hover:bg-slate-700/20 hover:shadow-lg hover:shadow-black/10
                    ${pole.isEdited ? EDIT_HIGHLIGHT_CLASS : ''}
                    ${rowIndex % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/10'}
                  `}
                >
                  {TABLE_COLUMNS.map((col, colIndex) => {
                    const value = pole[col.key as keyof ProcessedPole] as string | number | boolean;
                    const mismatchClass = getMismatchClass(pole, col.key);
                    const tierColorClass = col.key === 'matchTier' ? MATCH_TIER_COLORS[pole.matchTier] : '';
                    
                    return (
                      <td 
                        key={col.key} 
                        className={`
                          px-4 py-3 text-sm transition-all duration-200
                          border-r border-slate-700/20 last:border-r-0
                          ${tierColorClass} ${mismatchClass} ${col.className || ''}
                          ${colIndex === 0 ? 'sticky left-0 bg-slate-800/90 z-10 group-hover:bg-slate-700/40' : ''}
                          ${mismatchClass ? 'animate-pulse' : ''}
                        `}
                      >
                        {col.editable && pole.spida ? (
                          col.type === 'select' && col.options ? (
                            <select
                              value={value as string}
                              onChange={(e) => handleSelectChange(pole.id, col.key as keyof ProcessedPole, e.target.value)}
                              className="
                                w-full bg-slate-700/80 border border-slate-600/50 text-slate-200 text-sm 
                                rounded-lg shadow-sm transition-all duration-200
                                focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 
                                hover:bg-slate-600/80 hover:border-slate-500/50
                                p-2
                              "
                            >
                              {col.options.map(opt => <option key={opt} value={opt}>{opt || 'N/A'}</option>)}
                            </select>
                          ) : col.type === 'number' && (col.key === 'editableSpidaExistingPct' || col.key === 'editableSpidaFinalPct') ? (
                            <div className="relative w-full">
                              <input
                                type="number"
                                value={value as string | number}
                                onChange={(e) => handleInputChange(pole.id, col.key as keyof ProcessedPole, e.target.value)}
                                className="
                                  w-full bg-slate-700/80 border border-slate-600/50 text-slate-200 text-sm 
                                  rounded-lg shadow-sm transition-all duration-200
                                  focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 
                                  hover:bg-slate-600/80 hover:border-slate-500/50
                                  p-2 pr-8
                                "
                              />
                              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none text-sm">
                                %
                              </span>
                            </div>
                          ) : (
                            <input
                              type={col.type || 'text'}
                              value={value as string | number}
                              onChange={(e) => handleInputChange(pole.id, col.key as keyof ProcessedPole, e.target.value)}
                              className="
                                w-full bg-slate-700/80 border border-slate-600/50 text-slate-200 text-sm 
                                rounded-lg shadow-sm transition-all duration-200
                                focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 
                                hover:bg-slate-600/80 hover:border-slate-500/50
                                p-2
                              "
                            />
                          )
                        ) : (
                          <div className={`
                            text-slate-300 
                            ${col.key === 'matchTier' ? 'font-medium' : ''}
                            ${value?.toString() === 'N/A' ? 'text-slate-500 italic' : ''}
                          `}>
                            {value?.toString() ?? 'N/A'}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-sm min-w-[120px]">
                    <button 
                      onClick={() => onViewDetails(pole)}
                      className="
                        inline-flex items-center space-x-1 px-3 py-1.5 
                        bg-emerald-500/10 hover:bg-emerald-500/20 
                        text-emerald-400 hover:text-emerald-300
                        border border-emerald-500/30 hover:border-emerald-500/50
                        rounded-lg font-medium text-xs
                        transition-all duration-200 transform hover:scale-105
                        focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                      "
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
