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
        label: 'SCID Exact Match', 
        badgeClass: 'badge-success',
        bgColor: 'var(--status-success)',
        icon: '🎯' 
      },
      [MatchTier.POLE_NUMBER_MATCH]: { 
        label: 'Pole Number Match', 
        badgeClass: 'badge-info',
        bgColor: 'var(--status-info)',
        icon: '📍' 
      },
      [MatchTier.COORDINATE_DIRECT_MATCH]: { 
        label: 'Coordinate Match', 
        badgeClass: 'badge-warning',
        bgColor: 'var(--status-warning)',
        icon: '📐' 
      },
      [MatchTier.COORDINATE_SPEC_VERIFIED]: { 
        label: 'Coordinate + Spec Match', 
        badgeClass: 'badge-warning',
        bgColor: 'var(--status-warning)',
        icon: '✅' 
      },
      [MatchTier.UNMATCHED_SPIDA]: { 
        label: 'Unmatched SPIDA', 
        badgeClass: 'badge-error',
        bgColor: 'var(--status-error)',
        icon: '❌' 
      },
      [MatchTier.UNMATCHED_KATAPULT]: { 
        label: 'Unmatched Katapult', 
        badgeClass: 'badge-error',
        bgColor: 'var(--status-error)',
        icon: '🔍' 
      },
    };
    return tierInfo[tier];
  };

  const totalPoles = stats.totalSpidaPoles + stats.totalKatapultPoles;
  const hasData = totalPoles > 0;
  const matchRate = totalPoles > 0 ? (stats.totalMatches / totalPoles) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Status Message */}
      <div className={`alert ${isComparing ? 'alert-warning' : 'alert-info'}`}>
        <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${isComparing ? 'bg-warning' : 'bg-info'}`} />
          <span className="text-sm font-medium">
            {statusMessage}
          </span>
        </div>
      </div>

      {/* Statistics Overview */}
      {hasData && (
        <div className="space-y-6">
          {/* Main Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="summary-card">
              <div className="summary-card-header">
                <div className="summary-card-title">Total Matches</div>
                <div className="summary-card-icon bg-success">
                  <span className="text-lg">✓</span>
                </div>
              </div>
              <div className="summary-card-value text-success">{stats.totalMatches}</div>
              <div className="text-xs text-muted">Successful matches found</div>
            </div>
            
            <div className="summary-card">
              <div className="summary-card-header">
                <div className="summary-card-title">Match Rate</div>
                <div className="summary-card-icon bg-info">
                  <span className="text-lg">📊</span>
                </div>
              </div>
              <div className="summary-card-value text-info">{matchRate.toFixed(1)}%</div>
              <div className="text-xs text-muted">{stats.totalMatches} of {totalPoles} poles</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-primary">Overall Progress</span>
              <span className="text-xs text-muted">{stats.totalMatches} of {totalPoles} poles matched</span>
            </div>
            <div className="progress">
              <div 
                className="progress-bar"
                style={{ 
                  width: `${matchRate}%`,
                  backgroundColor: matchRate > 80 ? 'var(--status-success)' : 
                                 matchRate > 60 ? 'var(--status-warning)' : 'var(--status-error)'
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>0%</span>
              <span className="font-medium">{matchRate.toFixed(1)}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Match Types Breakdown */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-primary">Match Type Breakdown</h4>
            <div className="space-y-3">
              {Object.entries(stats.matchesByTier).map(([tier, count]) => {
                if (count === 0) return null;
                
                const tierInfo = getTierDisplayInfo(tier as MatchTier);
                const percentage = totalPoles > 0 ? (count / totalPoles) * 100 : 0;
                
                return (
                  <div key={tier} className="summary-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{tierInfo.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-primary">{tierInfo.label}</div>
                          <div className="text-xs text-muted">{percentage.toFixed(1)}% of total poles</div>
                        </div>
                      </div>
                      <div className={`badge ${tierInfo.badgeClass}`}>
                        {count}
                      </div>
                    </div>
                    <div className="progress">
                      <div 
                        className="progress-bar"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: tierInfo.bgColor
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Sources Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="summary-card">
              <div className="summary-card-header">
                <div className="summary-card-title">SPIDA Poles</div>
                <div className="summary-card-icon bg-accent">
                  <span className="text-lg">📋</span>
                </div>
              </div>
              <div className="summary-card-value text-accent">{stats.totalSpidaPoles}</div>
              <div className="text-xs text-muted">Loaded from SPIDA JSON</div>
            </div>
            
            <div className="summary-card">
              <div className="summary-card-header">
                <div className="summary-card-title">Katapult Poles</div>
                <div className="summary-card-icon bg-accent">
                  <span className="text-lg">📊</span>
                </div>
              </div>
              <div className="summary-card-value text-accent">{stats.totalKatapultPoles}</div>
              <div className="text-xs text-muted">Loaded from Katapult JSON</div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="card">
            <h4 className="text-sm font-semibold text-primary mb-3">Quick Actions</h4>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-success">
                <span>✓</span>
                Perfect Matches: {stats.matchesByTier[MatchTier.SCID_EXACT_MATCH]}
              </span>
              <span className="badge badge-warning">
                <span>⚠</span>
                Need Review: {stats.matchesByTier[MatchTier.COORDINATE_DIRECT_MATCH] + stats.matchesByTier[MatchTier.COORDINATE_SPEC_VERIFIED]}
              </span>
              <span className="badge badge-error">
                <span>✗</span>
                Unmatched: {stats.matchesByTier[MatchTier.UNMATCHED_SPIDA] + stats.matchesByTier[MatchTier.UNMATCHED_KATAPULT]}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No data state */}
      {!hasData && !isComparing && (
        <div className="card text-center py-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-primary">No Data Available</h3>
              <p className="text-sm text-secondary mt-2">
                Load your SPIDA and Katapult JSON files and run the comparison to see detailed statistics and analysis.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
