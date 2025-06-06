/**
 * @deprecated Use HeightComparison from './height-comparison' instead
 * This file is kept for backward compatibility only
 */
import React from 'react';
import { ProcessedPole } from '../types';
import { HeightComparison } from './height-comparison';

interface HeightComparisonTableProps {
  poles: ProcessedPole[];
}

const HeightComparisonTable: React.FC<HeightComparisonTableProps> = ({ poles }) => {
  return <HeightComparison poles={poles} />;
};

export default HeightComparisonTable; 