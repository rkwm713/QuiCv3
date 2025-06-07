/**
 * @deprecated Use HeightComparison from './height-comparison' instead
 * This file is kept for backward compatibility only
 */
import React from 'react';
import { SpidaJsonFullFormat, KatapultJsonFormat } from '../types';
import { HeightComparison } from './height-comparison';

interface HeightComparisonTableProps {
  spidaJson: SpidaJsonFullFormat | null;
  katapultJson?: KatapultJsonFormat | null;
}

const HeightComparisonTable: React.FC<HeightComparisonTableProps> = ({ spidaJson, katapultJson }) => {
  return <HeightComparison spidaJson={spidaJson} katapultJson={katapultJson} />;
};

export default HeightComparisonTable; 