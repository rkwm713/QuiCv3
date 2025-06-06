import React, { useState, useMemo } from 'react';
import { ProcessedPole, HeightComparisonItem, HeightComparisonData } from '../../types';
import { HeightComparisonService } from '../../services/heightComparisonService';
import { HeightComparisonFilters } from './HeightComparisonFilters';
import { HeightComparisonStatsBar } from './HeightComparisonStats';
import { HeightComparisonTableView } from './HeightComparisonTable';
import { HEIGHT_COMPARISON_CONSTANTS } from './HeightComparisonConstants';

interface HeightComparisonProps {
  poles: ProcessedPole[];
}

export const HeightComparison: React.FC<HeightComparisonProps> = ({ poles }) => {
  const [threshold, setThreshold] = useState<number>(HEIGHT_COMPARISON_CONSTANTS.DEFAULT_THRESHOLD);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('');
  const [sortField, setSortField] = useState<keyof HeightComparisonItem>('poleTag');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Generate comparison data
  const comparisonData = useMemo((): HeightComparisonData => {
    return HeightComparisonService.generateHeightComparison(poles, threshold);
  }, [poles, threshold]);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let items = [...comparisonData.items];

    // Apply filters
    if (statusFilter) {
      items = items.filter(item => item.status === statusFilter);
    }
    if (itemTypeFilter) {
      items = items.filter(item => item.itemType === itemTypeFilter);
    }

    // Apply sorting
    items.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
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

    return items;
  }, [comparisonData.items, statusFilter, itemTypeFilter, sortField, sortDirection]);

  const handleSort = (field: keyof HeightComparisonItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (poles.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <div className="text-center">
          <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium">No pole data available</h3>
          <p className="mt-1 text-sm">Load SPIDA and Katapult data to see height comparisons</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <HeightComparisonFilters
        comparisonData={comparisonData}
        threshold={threshold}
        onThresholdChange={setThreshold}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        itemTypeFilter={itemTypeFilter}
        onItemTypeFilterChange={setItemTypeFilter}
        filteredItemsCount={filteredAndSortedItems.length}
      />

      <HeightComparisonStatsBar stats={comparisonData.stats} />

      <HeightComparisonTableView
        items={filteredAndSortedItems}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      
      {filteredAndSortedItems.length > 0 && (
        <div className="bg-slate-750 px-6 py-3 border-t border-slate-700">
          <p className="text-sm text-slate-400">
            Showing {filteredAndSortedItems.length} of {comparisonData.stats.total} height comparison items
          </p>
        </div>
      )}
    </div>
  );
}; 