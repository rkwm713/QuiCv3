import React, { useState } from 'react';
import { ProcessedPole } from '../types';
import { InteractiveMap } from './InteractiveMap';
import { PoleSelector } from './PoleSelector';

interface MapWithSelectorProps {
  processedPoles: ProcessedPole[];
  onPoleClick: (pole: ProcessedPole) => void;
}

export const MapWithSelector: React.FC<MapWithSelectorProps> = ({
  processedPoles,
  onPoleClick,
}) => {
  const [selectedPoleId, setSelectedPoleId] = useState<string | null>(null);

  const handlePoleSelect = (pole: ProcessedPole) => {
    setSelectedPoleId(pole.id);
  };

  const handlePoleClick = (pole: ProcessedPole) => {
    setSelectedPoleId(pole.id);
    onPoleClick(pole);
  };

  if (processedPoles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 bg-slate-800 rounded-lg">
        Map will appear here once data is processed.
      </div>
    );
  }

  return (
    <div className="h-full flex gap-4">
      {/* Map Section - Takes up 70% of the width */}
      <div className="flex-1 min-w-0">
        <InteractiveMap
          processedPoles={processedPoles}
          onPoleClick={handlePoleClick}
          selectedPoleId={selectedPoleId}
        />
      </div>
      
      {/* Pole Selector - Takes up 30% of the width */}
      <div className="w-80 flex-shrink-0">
        <PoleSelector
          processedPoles={processedPoles}
          selectedPoleId={selectedPoleId}
          onPoleSelect={handlePoleSelect}
          onPoleClick={handlePoleClick}
        />
      </div>
    </div>
  );
}; 