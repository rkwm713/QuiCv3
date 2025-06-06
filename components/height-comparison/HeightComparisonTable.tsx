import React from 'react';
import { HeightComparisonItem } from '../../types';
import { HEIGHT_COMPARISON_STATUS_COLORS, HEIGHT_COMPARISON_ITEM_TYPE_COLORS } from './HeightComparisonConstants';

interface HeightComparisonTableProps {
  items: HeightComparisonItem[];
  sortField: keyof HeightComparisonItem;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof HeightComparisonItem) => void;
}

const SortIcon: React.FC<{ field: keyof HeightComparisonItem; currentField: keyof HeightComparisonItem; direction: 'asc' | 'desc' }> = ({ 
  field, 
  currentField, 
  direction 
}) => {
  if (currentField !== field) {
    return (
      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  
  return (
    <svg className={`w-4 h-4 ${direction === 'asc' ? 'text-emerald-400' : 'text-emerald-400 rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
};

const formatHeight = (height: number | null): string => {
  return height !== null ? `${height.toFixed(1)} ft` : 'N/A';
};

const formatDelta = (delta: number | null): string => {
  return delta !== null ? `±${delta.toFixed(1)} ft` : 'N/A';
};

export const HeightComparisonTableView: React.FC<HeightComparisonTableProps> = ({
  items,
  sortField,
  sortDirection,
  onSort,
}) => {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center">
        <svg className="w-5 h-5 mx-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-slate-300">No items match current filters</h3>
        <p className="mt-1 text-sm text-slate-500">Try adjusting your filter criteria</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-750">
          <tr>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
              onClick={() => onSort('poleTag')}
            >
              <div className="flex items-center space-x-1">
                <span>Pole Tag</span>
                <SortIcon field="poleTag" currentField={sortField} direction={sortDirection} />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
              onClick={() => onSort('itemType')}
            >
              <div className="flex items-center space-x-1">
                <span>Item Type</span>
                <SortIcon field="itemType" currentField={sortField} direction={sortDirection} />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
              onClick={() => onSort('description')}
            >
              <div className="flex items-center space-x-1">
                <span>Description</span>
                <SortIcon field="description" currentField={sortField} direction={sortDirection} />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
              onClick={() => onSort('katapultHeightFt')}
            >
              <div className="flex items-center space-x-1">
                <span>Katapult Height (ft)</span>
                <SortIcon field="katapultHeightFt" currentField={sortField} direction={sortDirection} />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
              onClick={() => onSort('spidaHeightFt')}
            >
              <div className="flex items-center space-x-1">
                <span>SPIDA Height (ft)</span>
                <SortIcon field="spidaHeightFt" currentField={sortField} direction={sortDirection} />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
              onClick={() => onSort('delta')}
            >
              <div className="flex items-center space-x-1">
                <span>Δ</span>
                <SortIcon field="delta" currentField={sortField} direction={sortDirection} />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
              onClick={() => onSort('status')}
            >
              <div className="flex items-center space-x-1">
                <span>Status</span>
                <SortIcon field="status" currentField={sortField} direction={sortDirection} />
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-slate-800 divide-y divide-slate-700">
          {items.map((item, index) => (
            <tr key={`${item.poleTag}-${item.itemType}-${item.description}-${index}`} className="hover:bg-slate-750">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                {item.poleTag}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${HEIGHT_COMPARISON_ITEM_TYPE_COLORS[item.itemType]}`}>
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
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${HEIGHT_COMPARISON_STATUS_COLORS[item.status]}`}>
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 