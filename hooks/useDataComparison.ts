import { useState, useCallback } from 'react';
import { 
  NormalizedPole, 
  ProcessedPole, 
  ComparisonStats
} from '../types';
import { 
  performComparison
} from '../services/dataProcessingService';
import { INITIAL_STATS } from '../constants';

export interface UseDataComparisonReturn {
  // State
  normalizedSpidaData: NormalizedPole[] | null;
  normalizedKatapultData: NormalizedPole[] | null;
  processedPoles: ProcessedPole[];
  comparisonStats: ComparisonStats;
  isComparing: boolean;
  
  // Actions
  setNormalizedSpidaData: (data: NormalizedPole[] | null) => void;
  setNormalizedKatapultData: (data: NormalizedPole[] | null) => void;
  handleCompare: () => void;
  resetComparison: () => void;
  
  // Computed values
  hasValidData: boolean;
  canCompare: boolean;
}

export const useDataComparison = (): UseDataComparisonReturn => {
  const [normalizedSpidaData, setNormalizedSpidaData] = useState<NormalizedPole[] | null>(null);
  const [normalizedKatapultData, setNormalizedKatapultData] = useState<NormalizedPole[] | null>(null);
  const [processedPoles, setProcessedPoles] = useState<ProcessedPole[]>([]);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats>(INITIAL_STATS);
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = useCallback(() => {
    if (!normalizedSpidaData || !normalizedKatapultData) {
      console.error('Cannot compare: Both SPIDA and Katapult data must be loaded');
      return;
    }

    setIsComparing(true);
    
    // Use setTimeout to prevent blocking the UI
    setTimeout(() => {
      try {
        const { processedPoles: comparedPoles, stats } = performComparison(
          normalizedSpidaData, 
          normalizedKatapultData
        );
        
        setProcessedPoles(comparedPoles);
        setComparisonStats(stats);
        
        console.log(`✅ Comparison complete: ${stats.totalMatches} matches found`);
      } catch (error) {
        console.error('Error during comparison:', error);
        setProcessedPoles([]);
        setComparisonStats(INITIAL_STATS);
        throw error; // Re-throw so caller can handle
      } finally {
        setIsComparing(false);
      }
    }, 50);
  }, [normalizedSpidaData, normalizedKatapultData]);

  const resetComparison = useCallback(() => {
    setProcessedPoles([]);
    setComparisonStats(INITIAL_STATS);
    setIsComparing(false);
  }, []);

  // Reset comparison when data changes
  const setSpidaDataWithReset = useCallback((data: NormalizedPole[] | null) => {
    setNormalizedSpidaData(data);
    resetComparison();
  }, [resetComparison]);

  const setKatapultDataWithReset = useCallback((data: NormalizedPole[] | null) => {
    setNormalizedKatapultData(data);
    resetComparison();
  }, [resetComparison]);

  // Computed values
  const hasValidData = !!(normalizedSpidaData?.length || normalizedKatapultData?.length);
  const canCompare = !!(normalizedSpidaData?.length && normalizedKatapultData?.length);

  return {
    // State
    normalizedSpidaData,
    normalizedKatapultData,
    processedPoles,
    comparisonStats,
    isComparing,
    
    // Actions
    setNormalizedSpidaData: setSpidaDataWithReset,
    setNormalizedKatapultData: setKatapultDataWithReset,
    handleCompare,
    resetComparison,
    
    // Computed values
    hasValidData,
    canCompare,
  };
}; 