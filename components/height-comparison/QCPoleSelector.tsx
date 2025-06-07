import React from 'react';
import { ComparisonRow } from '../../types';

interface QCPoleSelectorProps {
  rows: ComparisonRow[];
  selectedPole: string | null;
  onPoleSelect: (poleScid: string | null) => void;
}

interface PoleInfo {
  scid: string;
  totalAttachments: number;
  errorCount: number;
  hasErrors: boolean;
}

export const QCPoleSelector: React.FC<QCPoleSelectorProps> = ({ 
  rows, 
  selectedPole, 
  onPoleSelect 
}) => {
  // Group rows by pole SCID and calculate stats
  const poleStats = React.useMemo(() => {
    const poleMap = new Map<string, PoleInfo>();
    
    rows.forEach(row => {
      const poleScid = row.key.split('-')[0];
      
      if (!poleMap.has(poleScid)) {
        poleMap.set(poleScid, {
          scid: poleScid,
          totalAttachments: 0,
          errorCount: 0,
          hasErrors: false
        });
      }
      
      const pole = poleMap.get(poleScid)!;
      pole.totalAttachments++;
      
      // Count errors (anything that's not a match)
      if (row.status !== 'Match') {
        pole.errorCount++;
        pole.hasErrors = true;
      }
    });
    
    // Sort numerically by SCID instead of alphabetically
    return Array.from(poleMap.values()).sort((a, b) => {
      const scidA = parseInt(a.scid, 10);
      const scidB = parseInt(b.scid, 10);
      return scidA - scidB;
    });
  }, [rows]);

  if (poleStats.length === 0) {
    return (
      <div className="w-40 bg-slate-800 border-r border-slate-700 p-3">
        <div className="text-center text-slate-400 py-6">
          <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm">No poles to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-40 bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Compact Header - Only show clear button when filtered */}
      {selectedPole && (
        <div className="p-2 border-b border-slate-700">
          <button
            onClick={() => onPoleSelect(null)}
            className="w-full text-xs px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors"
            title="Show all poles"
          >
            Clear Filter (showing {selectedPole})
          </button>
        </div>
      )}

      {/* Pole List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-1 space-y-1">
          {poleStats.map((pole) => {
            const isSelected = selectedPole === pole.scid;
            
            return (
              <button
                key={pole.scid}
                onClick={() => onPoleSelect(isSelected ? null : pole.scid)}
                className={`
                  w-full text-left px-2 py-1.5 rounded-md transition-all duration-200 border
                  ${isSelected 
                    ? 'border-emerald-500 bg-emerald-500/20 shadow-lg' 
                    : pole.hasErrors
                      ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                      : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <span className="font-mono font-bold text-white text-lg">
                      {pole.scid}
                    </span>
                    {pole.hasErrors ? (
                      <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  
                  <div className="text-right">
                    {pole.hasErrors ? (
                      <div className="text-xs font-medium text-red-300 leading-tight">
                        {pole.errorCount} error{pole.errorCount !== 1 ? 's' : ''}
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-emerald-300 leading-tight">
                        All good
                      </div>
                    )}
                    <div className="text-xs text-slate-500 leading-tight">
                      {pole.totalAttachments} item{pole.totalAttachments !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}; 