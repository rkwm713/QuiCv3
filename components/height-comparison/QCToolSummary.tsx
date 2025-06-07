import React, { useState } from 'react';

interface QCToolSummaryProps {
  stats: {
    total: number;
    matches: number;
    changed: number;
    added: number;
    removed: number;
    katapultOnly: number;
    katapultMismatch: number;
    maxDeltaMeasRec: number;
    maxDeltaMeasKat: number;
    maxDeltaRecKat: number;
  };
}

export const QCToolSummary: React.FC<QCToolSummaryProps> = ({ stats }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDelta = (delta: number): string => {
    return delta === 0 ? '0 ft' : `${delta.toFixed(1)} ft`;
  };

  const maxDelta = Math.max(stats.maxDeltaMeasRec, stats.maxDeltaMeasKat, stats.maxDeltaRecKat);
  const totalIssues = stats.changed + stats.added + stats.removed + stats.katapultOnly + stats.katapultMismatch;
  const matchRate = stats.total > 0 ? ((stats.matches / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="bg-slate-750 border-b border-slate-700">
      {/* Collapsed Header - Always Visible */}
      <div className="p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left group hover:bg-slate-700/50 rounded-lg p-2 transition-colors"
        >
          <div className="flex items-center space-x-6">
            {/* Key Metrics */}
            <div className="flex items-center space-x-1">
              <span className="text-2xl font-bold text-white">{stats.total}</span>
              <span className="text-sm text-slate-400">total</span>
            </div>
            
            <div className="flex items-center space-x-1">
              <span className="text-2xl font-bold text-emerald-400">{stats.matches}</span>
              <span className="text-sm text-slate-400">matches</span>
            </div>
            
            {totalIssues > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-2xl font-bold text-yellow-400">{totalIssues}</span>
                <span className="text-sm text-slate-400">issues</span>
              </div>
            )}
            
            <div className="flex items-center space-x-1">
              <span className="text-lg font-medium text-emerald-400">{matchRate}%</span>
              <span className="text-sm text-slate-400">match rate</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              {isExpanded ? 'Hide Details' : 'Show Details'}
            </span>
            <svg 
              className={`w-5 h-5 text-slate-400 group-hover:text-slate-300 transition-all duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-700 p-4 bg-slate-800/50">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Total</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{stats.matches}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Matches</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{stats.changed}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Changed</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.added}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Added</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{stats.removed}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Removed</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.katapultOnly}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Katapult Only</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{stats.katapultMismatch}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Kat Mismatch</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{formatDelta(maxDelta)}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Max Δ Height</div>
            </div>
          </div>
          
          {stats.total > 0 && (
            <div className="bg-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Match Rate:</span>
                <span className="text-emerald-400 font-medium">
                  {matchRate}%
                </span>
              </div>
              
              {stats.changed > 0 && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-300">Change Rate:</span>
                  <span className="text-yellow-400 font-medium">
                    {((stats.changed / stats.total) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 