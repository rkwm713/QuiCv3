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
    return null;
}; 