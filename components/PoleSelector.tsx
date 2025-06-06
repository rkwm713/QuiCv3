import React, { useState, useMemo } from 'react';
import { ProcessedPole, MatchTier } from '../types';
import { MAP_MARKER_COLORS } from '../constants';

interface PoleSelectorProps {
  processedPoles: ProcessedPole[];
  selectedPoleId: string | null;
  onPoleSelect: (pole: ProcessedPole) => void;
  onPoleClick: (pole: ProcessedPole) => void;
}

export const PoleSelector: React.FC<PoleSelectorProps> = ({
  processedPoles,
  selectedPoleId,
  onPoleSelect,
  onPoleClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<MatchTier | 'ALL'>('ALL');

  // Filter poles based on search term and tier filter
  const filteredPoles = useMemo(() => {
    return processedPoles.filter(pole => {
      const matchesSearch = searchTerm.length === 0 || 
        (pole.spida?.scid || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pole.katapult?.scid || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pole.spida?.poleNum || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pole.katapult?.poleNum || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTier = selectedTierFilter === 'ALL' || pole.matchTier === selectedTierFilter;
      
      return matchesSearch && matchesTier && pole.mapCoords; // Only show poles with coordinates
    });
  }, [processedPoles, searchTerm, selectedTierFilter]);

  // Group poles by match tier for better organization
  const groupedPoles = useMemo(() => {
    const groups: Record<MatchTier, ProcessedPole[]> = {
      [MatchTier.SCID_EXACT_MATCH]: [],
      [MatchTier.POLE_NUMBER_MATCH]: [],
      [MatchTier.COORDINATE_DIRECT_MATCH]: [],
      [MatchTier.COORDINATE_SPEC_VERIFIED]: [],
      [MatchTier.UNMATCHED_SPIDA]: [],
      [MatchTier.UNMATCHED_KATAPULT]: [],
    };

    filteredPoles.forEach(pole => {
      groups[pole.matchTier].push(pole);
    });

    return groups;
  }, [filteredPoles]);

  const getTierDisplayName = (tier: MatchTier): string => {
    return tier.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPoleDisplayId = (pole: ProcessedPole): string => {
    return pole.spida?.scid || pole.katapult?.scid || 
           pole.spida?.poleNum || pole.katapult?.poleNum || 
           `Pole ${pole.id.substring(0, 8)}`;
  };

  const getPoleSubtitle = (pole: ProcessedPole): string => {
    const parts = [];
    if (pole.spida?.scid) parts.push(`SPIDA: ${pole.spida.scid}`);
    if (pole.katapult?.scid) parts.push(`Katapult: ${pole.katapult.scid}`);
    if (parts.length === 0) {
      if (pole.spida?.poleNum) parts.push(`SPIDA: ${pole.spida.poleNum}`);
      if (pole.katapult?.poleNum) parts.push(`Katapult: ${pole.katapult.poleNum}`);
    }
    return parts.join(' • ');
  };

  return (
    <div className="h-full flex flex-col bg-slate-800/50 rounded-lg border border-slate-700/50">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <h3 className="text-lg font-semibold text-slate-200 mb-3">Pole Selector</h3>
        
        {/* Search Input */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Search poles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
          <div className="absolute right-3 top-2.5 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Tier Filter */}
        <select
          value={selectedTierFilter}
          onChange={(e) => setSelectedTierFilter(e.target.value as MatchTier | 'ALL')}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        >
          <option value="ALL">All Match Types</option>
          {Object.values(MatchTier).map(tier => (
            <option key={tier} value={tier}>
              {getTierDisplayName(tier)}
            </option>
          ))}
        </select>

        {/* Results Count */}
        <div className="mt-2 text-sm text-slate-400">
          {filteredPoles.length} of {processedPoles.filter(p => p.mapCoords).length} poles
        </div>
      </div>

      {/* Poles List */}
      <div className="flex-1 overflow-y-auto">
        {selectedTierFilter === 'ALL' ? (
          // Grouped view
          Object.entries(groupedPoles).map(([tier, poles]) => {
            if (poles.length === 0) return null;
            
            return (
              <div key={tier} className="mb-4">
                <div className="sticky top-0 bg-slate-800/90 backdrop-blur-sm px-4 py-2 border-b border-slate-700/30">
                  <div className="flex items-center space-x-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: MAP_MARKER_COLORS[tier as MatchTier] }}
                    />
                    <span className="text-sm font-medium text-slate-300">
                      {getTierDisplayName(tier as MatchTier)} ({poles.length})
                    </span>
                  </div>
                </div>
                
                {poles.map(pole => (
                  <div
                    key={pole.id}
                    className={`px-4 py-3 border-b border-slate-700/30 cursor-pointer transition-all duration-200 hover:bg-slate-700/30 ${
                      selectedPoleId === pole.id ? 'bg-emerald-500/20 border-emerald-500/50' : ''
                    }`}
                    onClick={() => onPoleSelect(pole)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate">
                          {getPoleDisplayId(pole)}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {getPoleSubtitle(pole)}
                        </div>
                        {pole.mapCoords && (
                          <div className="text-xs text-slate-500 mt-1">
                            {pole.mapCoords.lat.toFixed(4)}, {pole.mapCoords.lon.toFixed(4)}
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-2 flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPoleClick(pole);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="View details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: MAP_MARKER_COLORS[pole.matchTier] }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        ) : (
          // Flat view for filtered results
          filteredPoles.map(pole => (
            <div
              key={pole.id}
              className={`px-4 py-3 border-b border-slate-700/30 cursor-pointer transition-all duration-200 hover:bg-slate-700/30 ${
                selectedPoleId === pole.id ? 'bg-emerald-500/20 border-emerald-500/50' : ''
              }`}
              onClick={() => onPoleSelect(pole)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">
                    {getPoleDisplayId(pole)}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {getPoleSubtitle(pole)}
                  </div>
                  {pole.mapCoords && (
                    <div className="text-xs text-slate-500 mt-1">
                      {pole.mapCoords.lat.toFixed(4)}, {pole.mapCoords.lon.toFixed(4)}
                    </div>
                  )}
                </div>
                
                <div className="ml-2 flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPoleClick(pole);
                    }}
                    className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                    title="View details"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: MAP_MARKER_COLORS[pole.matchTier] }}
                  />
                </div>
              </div>
            </div>
          ))
        )}

        {filteredPoles.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p>No poles found matching your criteria</p>
            <p className="text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}; 