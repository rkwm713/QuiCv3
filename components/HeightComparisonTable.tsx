/**
 * @deprecated Use SpidaQcTool from './spidacalcqctool' instead
 * This file is kept for backward compatibility only
 */
import React from 'react';
import { SpidaJsonFullFormat, KatapultJsonFormat } from '../types';
import SpidaQcTool from './spidacalcqctool/SpidaQcTool';

interface HeightComparisonTableProps {
  spidaJson: SpidaJsonFullFormat | null;
  katapultJson?: KatapultJsonFormat | null;
}

const HeightComparisonTable: React.FC<HeightComparisonTableProps> = () => {
  return <SpidaQcTool />;
};

export default HeightComparisonTable; 