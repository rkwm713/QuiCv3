import React from 'react';
import { HeightComparisonData } from '../../types';
import { HEIGHT_COMPARISON_FILTERS } from './HeightComparisonConstants';

interface HeightComparisonFiltersProps {
  comparisonData: HeightComparisonData;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  itemTypeFilter: string;
  onItemTypeFilterChange: (itemType: string) => void;
  filteredItemsCount: number;
}

export const HeightComparisonFilters: React.FC<HeightComparisonFiltersProps> = ({
  comparisonData,
  threshold,
  onThresholdChange,
  statusFilter,
  onStatusFilterChange,
  itemTypeFilter,
  onItemTypeFilterChange,
  filteredItemsCount,
}) => {
  return (
    <>
      {/* Header with Threshold Setting */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div>
              <h2 className="text-xl font-bold text-white">Height Comparison</h2>
              <p className="text-emerald-100 text-sm">
                Verify pole heights, wires, and attachments match between Katapult and SPIDAcalc
              </p>
            </div>
          </div>
          
          {/* Threshold Setting */}
          <div className="flex items-center space-x-2 text-white">
            <label className="text-sm font-medium">Threshold:</label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value) || 0.5)}
              step="0.1"
              min="0"
              max="10"
              className="w-20 px-2 py-1 bg-white/20 text-white rounded border border-white/30 text-sm"
            />
            <span className="text-sm">ft</span>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-750 p-4 border-b border-slate-700">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-slate-300">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-3 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
            >
              <option value="">All Statuses</option>
              {HEIGHT_COMPARISON_FILTERS.STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-slate-300">Item Type:</label>
            <select
              value={itemTypeFilter}
              onChange={(e) => onItemTypeFilterChange(e.target.value)}
              className="px-3 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
            >
              <option value="">All Types</option>
              {HEIGHT_COMPARISON_FILTERS.ITEM_TYPE_OPTIONS.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-400">
            Showing {filteredItemsCount} of {comparisonData.stats.total} items
          </div>
        </div>
      </div>
    </>
  );
}; 