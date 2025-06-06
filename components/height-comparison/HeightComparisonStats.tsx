import React from 'react';
import { HeightComparisonStats } from '../../types';
import { HEIGHT_COMPARISON_STATUS_COLORS } from './HeightComparisonConstants';

interface HeightComparisonStatsProps {
  stats: HeightComparisonStats;
}

export const HeightComparisonStatsBar: React.FC<HeightComparisonStatsProps> = ({ stats }) => {
  return (
    <div className="bg-slate-750 p-4 border-b border-slate-700">
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-slate-300 text-sm">Total:</span>
          <span className="font-bold text-white">{stats.total}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HEIGHT_COMPARISON_STATUS_COLORS['OK']}`}>
            OK
          </span>
          <span className="font-bold text-white">{stats.ok}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HEIGHT_COMPARISON_STATUS_COLORS['HEIGHT DIFF']}`}>
            HEIGHT DIFF
          </span>
          <span className="font-bold text-white">{stats.heightDiff}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HEIGHT_COMPARISON_STATUS_COLORS['ONLY IN KAT']}`}>
            ONLY IN KAT
          </span>
          <span className="font-bold text-white">{stats.onlyInKat}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HEIGHT_COMPARISON_STATUS_COLORS['ONLY IN SPIDA']}`}>
            ONLY IN SPIDA
          </span>
          <span className="font-bold text-white">{stats.onlyInSpida}</span>
        </div>
      </div>
    </div>
  );
}; 