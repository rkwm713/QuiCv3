import React from 'react';
import { ComparisonStats, MatchTier } from '../types';

interface StatusDisplayProps {
  stats: ComparisonStats;
  statusMessage: string;
  isComparing: boolean;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ stats, statusMessage, isComparing }) => {
  const getTierDisplayInfo = (tier: MatchTier) => {
    const tierInfo = {
      [MatchTier.SCID_EXACT_MATCH]: { 
        label: 'SCID Exact', 
        color: 'bg-emerald-500', 
        bgColor: 'bg-emerald-500/10',
        icon: '🎯' 
      },
      [MatchTier.POLE_NUMBER_MATCH]: { 
        label: 'Pole Number', 
        color: 'bg-blue-500', 
        bgColor: 'bg-blue-500/10',
        icon: '📍' 
      },
      [MatchTier.COORDINATE_DIRECT_MATCH]: { 
        label: 'Coordinate Direct', 
        color: 'bg-yellow-500', 
        bgColor: 'bg-yellow-500/10',
        icon: '📐' 
      },
      [MatchTier.COORDINATE_SPEC_VERIFIED]: { 
        label: 'Coordinate + Spec', 
        color: 'bg-orange-500', 
        bgColor: 'bg-orange-500/10',
        icon: '✅' 
      },
      [MatchTier.UNMATCHED_SPIDA]: { 
        label: 'Unmatched SPIDA', 
        color: 'bg-red-500', 
        bgColor: 'bg-red-500/10',
        icon: '❌' 
      },
      [MatchTier.UNMATCHED_KATAPULT]: { 
        label: 'Unmatched Katapult', 
        color: 'bg-purple-500', 
        bgColor: 'bg-purple-500/10',
        icon: '🔍' 
      },
    };
    return tierInfo[tier];
  };

  const totalPoles = stats.totalSpidaPoles + stats.totalKatapultPoles;
  const hasData = totalPoles > 0;

  return (
    <div className="space-y-4">
      {/* Status Message */}
      <div className={`
        p-4 rounded-lg border transition-all duration-300
        ${isComparing 
          ? 'bg-yellow-500/10 border-yellow-500/30 animate-pulse' 
          : 'bg-slate-700/50 border-slate-600/50'
        }
      `}>
        <div className="flex items-center space-x-3">
          <div className={`
            w-2 h-2 rounded-full transition-all duration-300
            ${isComparing ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}
          `} />
          <span className="text-sm text-slate-200 font-medium">
            {statusMessage}
          </span>
        </div>
      </div>

      {/* Statistics Overview */}
      {hasData && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-yellow-400/10 to-blue-500/10 border border-yellow-400/20 rounded-lg p-3">
              <div className="text-xs text-emerald-400 font-medium uppercase tracking-wide">Total Matches</div>
              <div className="text-xl font-bold text-emerald-300 mt-1">{stats.totalMatches}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="text-xs text-blue-400 font-medium uppercase tracking-wide">Success Rate</div>
              <div className="text-xl font-bold text-blue-300 mt-1">{stats.matchSuccessRate}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Match Distribution</span>
              <span>{stats.totalMatches} of {totalPoles} poles</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${totalPoles > 0 ? (stats.totalMatches / totalPoles) * 100 : 0}%` 
                }}
              />
            </div>
          </div>

          {/* Match Tiers Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-slate-300 uppercase tracking-wide">Match Types</h4>
            <div className="space-y-2">
              {Object.entries(stats.matchesByTier).map(([tier, count]) => {
                const tierInfo = getTierDisplayInfo(tier as MatchTier);
                const percentage = totalPoles > 0 ? (count / totalPoles) * 100 : 0;
                
                return (
                  <div key={tier} className="group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{tierInfo.icon}</span>
                        <span className="text-slate-300">{tierInfo.label}</span>
                      </div>
                      <span className="text-slate-400 font-mono">{count}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`
                          h-full rounded-full transition-all duration-1000 ease-out
                          ${tierInfo.color} group-hover:scale-105
                        `}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Sources Summary */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className={`
              p-3 rounded-lg border transition-all duration-300 hover:scale-105
              ${stats.totalSpidaPoles > 0 
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' 
                : 'bg-slate-700/30 border-slate-600/30 text-slate-400'
              }
            `}>
              <div className="font-medium">SPIDA Poles</div>
              <div className="text-lg font-bold mt-1">{stats.totalSpidaPoles}</div>
            </div>
            <div className={`
              p-3 rounded-lg border transition-all duration-300 hover:scale-105
              ${stats.totalKatapultPoles > 0 
                ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-300' 
                : 'bg-slate-700/30 border-slate-600/30 text-slate-400'
              }
            `}>
              <div className="font-medium">Katapult Poles</div>
              <div className="text-lg font-bold mt-1">{stats.totalKatapultPoles}</div>
            </div>
          </div>
        </div>
      )}

      {/* No data state */}
      {!hasData && !isComparing && (
        <div className="text-center py-8 space-y-3">
          <div className="w-12 h-12 mx-auto bg-slate-700 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-slate-400 text-sm">
            Load data files and run comparison to see statistics
          </div>
        </div>
      )}
    </div>
  );
};
