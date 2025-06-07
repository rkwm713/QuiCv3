import React from 'react';
import { HeightComparisonData } from '../../types';

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
  comparisonData: _comparisonData,
  threshold: _threshold,
  onThresholdChange: _onThresholdChange,
  statusFilter: _statusFilter,
  onStatusFilterChange: _onStatusFilterChange,
  itemTypeFilter: _itemTypeFilter,
  onItemTypeFilterChange: _onItemTypeFilterChange,
  filteredItemsCount: _filteredItemsCount,
}) => {
    return null;
}; 