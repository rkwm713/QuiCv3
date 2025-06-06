import React, { useState, useMemo } from 'react';
import { ProcessedPole, HeightComparisonItem, HeightComparisonData } from '../types';
import { HeightComparisonService } from '../services/heightComparisonService';

interface HeightComparisonTableProps {
  poles: ProcessedPole[];
}

const HeightComparisonTable: React.FC<HeightComparisonTableProps> = ({ poles }) => {
  const [threshold, setThreshold] = useState(0.5);
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

  const formatHeight = (height: number | null): string => {
    return height !== null ? `${height.toFixed(1)} ft` : 'N/A';
  };

  const formatDelta = (delta: number | null): string => {
    return delta !== null ? `±${delta.toFixed(1)} ft` : 'N/A';
  };

  const QCIcon: React.FC = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );

  const SortIcon: React.FC<{ field: keyof HeightComparisonItem }> = ({ field }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return (
      <svg className={`w-4 h-4 ${sortDirection === 'asc' ? 'text-emerald-400' : 'text-emerald-400 rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  };

  if (poles.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <div className="text-center">
          <QCIcon />
          <h3 className="mt-2 text-sm font-medium">No pole data available</h3>
          <p className="mt-1 text-sm">Load SPIDA and Katapult data to see height comparisons</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <QCIcon />
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
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 0.5)}
              step="0.1"
              min="0"
              max="10"
              className="w-20 px-2 py-1 bg-white/20 text-white rounded border border-white/30 text-sm"
            />
            <span className="text-sm">ft</span>
          </div>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="bg-slate-750 p-4 border-b border-slate-700">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-300 text-sm">Total:</span>
            <span className="font-bold text-white">{comparisonData.stats.total}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HeightComparisonService.getStatusColor('OK')}`}>
              OK
            </span>
            <span className="font-bold text-white">{comparisonData.stats.ok}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HeightComparisonService.getStatusColor('HEIGHT DIFF')}`}>
              HEIGHT DIFF
            </span>
            <span className="font-bold text-white">{comparisonData.stats.heightDiff}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HeightComparisonService.getStatusColor('ONLY IN KAT')}`}>
              ONLY IN KAT
            </span>
            <span className="font-bold text-white">{comparisonData.stats.onlyInKat}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HeightComparisonService.getStatusColor('ONLY IN SPIDA')}`}>
              ONLY IN SPIDA
            </span>
            <span className="font-bold text-white">{comparisonData.stats.onlyInSpida}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-750 p-4 border-b border-slate-700">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-slate-300">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="OK">OK</option>
              <option value="HEIGHT DIFF">HEIGHT DIFF</option>
              <option value="ONLY IN KAT">ONLY IN KAT</option>
              <option value="ONLY IN SPIDA">ONLY IN SPIDA</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-slate-300">Item Type:</label>
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value)}
              className="px-3 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
            >
              <option value="">All Types</option>
              <option value="Pole">Pole</option>
              <option value="Wire">Wire</option>
              <option value="Other Attachment">Other Attachment</option>
            </select>
          </div>
          <div className="text-sm text-slate-400">
            Showing {filteredAndSortedItems.length} of {comparisonData.stats.total} items
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {filteredAndSortedItems.length === 0 ? (
          <div className="p-8 text-center">
            <QCIcon />
            <h3 className="mt-2 text-sm font-medium text-slate-300">No items match current filters</h3>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your filter criteria</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-750">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('poleTag')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Pole Tag</span>
                    <SortIcon field="poleTag" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('itemType')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Item Type</span>
                    <SortIcon field="itemType" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Description</span>
                    <SortIcon field="description" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('katapultHeightFt')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Katapult Height (ft)</span>
                    <SortIcon field="katapultHeightFt" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('spidaHeightFt')}
                >
                  <div className="flex items-center space-x-1">
                    <span>SPIDA Height (ft)</span>
                    <SortIcon field="spidaHeightFt" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('delta')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Δ</span>
                    <SortIcon field="delta" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    <SortIcon field="status" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {filteredAndSortedItems.map((item, index) => (
                <tr key={`${item.poleTag}-${item.itemType}-${item.description}-${index}`} className="hover:bg-slate-750">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {item.poleTag}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.itemType === 'Pole' ? 'bg-blue-900/20 text-blue-400 border border-blue-500' :
                      item.itemType === 'Wire' ? 'bg-orange-900/20 text-orange-400 border border-orange-500' :
                      'bg-purple-900/20 text-purple-400 border border-purple-500'
                    }`}>
                      {item.itemType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300 max-w-xs">
                    <div className="truncate" title={item.description}>
                      {item.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                    {formatHeight(item.katapultHeightFt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                    {formatHeight(item.spidaHeightFt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                    {formatDelta(item.delta)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HeightComparisonService.getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
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

export default HeightComparisonTable; 