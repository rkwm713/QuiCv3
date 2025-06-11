// SplitScreenComparison.tsx
// Split-screen comparison with toggle between SPIDA-only and full comparison modes

import React, { useState, useMemo } from 'react';
import { ComparisonResult, Attachment } from './types';
import { formatHeightFtIn } from './comparisonHelpers';

interface SplitScreenComparisonProps {
  result: ComparisonResult;
}

interface ComparisonRow {
  id: string;
  measured: Attachment | null;
  recommended: Attachment | null;
  katapult: Attachment | null;
  matchType: 'exact' | 'modified' | 'new-spida' | 'new-katapult' | 'missing';
  heightChanges: {
    measuredToRecommended?: number;
    recommendedToKatapult?: number;
  };
}

const SplitScreenComparison: React.FC<SplitScreenComparisonProps> = ({ result }) => {
  const [showKatapult, setShowKatapult] = useState(false);

  // Helper to find matching attachments with hierarchical awareness
  const findMatch = (
    attachment: Attachment, 
    candidates: Attachment[], 
    sourceArray?: Attachment[]
  ): Attachment | null => {
    // If this attachment has a parent insulator, use structural matching
    if (attachment.parentInsulatorId && sourceArray) {
      // Find the parent insulator in the source array (same design)
      const parentInsulator = sourceArray.find(item =>
        item.type.toLowerCase().includes('insulator') &&
        item.id === attachment.parentInsulatorId
      );
      
      if (parentInsulator) {
        console.log(`🔗 Wire ${attachment.id} (${attachment.type}) has parent insulator ${parentInsulator.id} - using structural matching`);
        
        // Look for a matching parent insulator in candidates
        const matchingParentInsulator = candidates.find(candidate => {
          const sameOwner = parentInsulator.owner.toLowerCase() === candidate.owner.toLowerCase();
          const isInsulator = candidate.type.toLowerCase().includes('insulator');
          const similarHeight = Math.abs(parentInsulator.height - candidate.height) < 0.3;
          
          return sameOwner && isInsulator && similarHeight;
        });
        
        if (matchingParentInsulator) {
          console.log(`🔗 Found matching parent insulator ${matchingParentInsulator.id} for ${parentInsulator.id}`);
          
          // Look for a wire connected to this matching parent insulator
          const matchingWire = candidates.find(candidate => {
            // Must be a wire with the matching parent insulator
            if (candidate.parentInsulatorId !== matchingParentInsulator.id) return false;
            
            const sameOwner = attachment.owner.toLowerCase() === candidate.owner.toLowerCase();
            const sameType = attachment.type.toLowerCase().includes(candidate.type.toLowerCase()) ||
                            candidate.type.toLowerCase().includes(attachment.type.toLowerCase());
            
            return sameOwner && sameType;
          });
          
          if (matchingWire) {
            console.log(`🔗 Structural match found: ${attachment.id} → ${matchingWire.id} via parent insulators`);
            return matchingWire;
          }
        } else {
          console.log(`🔗 No matching parent insulator found for ${parentInsulator.id}`);
        }
      }
    }
    
    // If this attachment is an insulator, look for matching insulator first
    if (attachment.type.toLowerCase().includes('insulator')) {
      const matchingInsulator = candidates.find(candidate => {
        const sameOwner = attachment.owner.toLowerCase() === candidate.owner.toLowerCase();
        const isInsulator = candidate.type.toLowerCase().includes('insulator');
        const similarHeight = Math.abs(attachment.height - candidate.height) < 0.3; // Tighter tolerance for insulators
        
        return sameOwner && isInsulator && similarHeight;
      });
      
      if (matchingInsulator) return matchingInsulator;
    }
    
    // Fallback to simple matching for other types or when structural matching fails
    return candidates.find(candidate => {
      const sameOwner = attachment.owner.toLowerCase() === candidate.owner.toLowerCase();
      const sameType = attachment.type.toLowerCase().includes(candidate.type.toLowerCase()) ||
                      candidate.type.toLowerCase().includes(attachment.type.toLowerCase());
      const similarHeight = Math.abs(attachment.height - candidate.height) < 0.5; // 50cm tolerance
      
      return sameOwner && sameType && similarHeight;
    }) || null;
  };

  // Build comparison rows
  const comparisonRows = useMemo(() => {
    const rows: ComparisonRow[] = [];
    const processedRecommended = new Set<string>();
    const processedKatapult = new Set<string>();

    // Start with measured attachments as the baseline
    result.spidaMeasured.forEach(measured => {
      const recommended = findMatch(measured, result.spidaRecommended, result.spidaMeasured);
      const katapult = showKatapult ? findMatch(measured, [
        ...result.katapultExisting,
        ...result.katapultProposed
      ], result.spidaMeasured) : null;

      if (recommended) {
        processedRecommended.add(recommended.id || '');
      }
      if (katapult) {
        processedKatapult.add(katapult.id || '');
      }

      // Determine match type
      let matchType: ComparisonRow['matchType'] = 'exact';
      if (recommended && Math.abs(measured.height - recommended.height) > 0.05) {
        matchType = 'modified';
      }

      // Calculate height changes
      const heightChanges: ComparisonRow['heightChanges'] = {};
      if (recommended) {
        heightChanges.measuredToRecommended = recommended.height - measured.height;
      }
      if (katapult && recommended) {
        heightChanges.recommendedToKatapult = katapult.height - recommended.height;
      }

      rows.push({
        id: measured.id || `measured-${rows.length}`,
        measured,
        recommended,
        katapult,
        matchType,
        heightChanges
      });
    });

    // Add new recommended attachments (not in measured)
    result.spidaRecommended.forEach(recommended => {
      if (processedRecommended.has(recommended.id || '')) return;

      const katapult = showKatapult ? findMatch(recommended, [
        ...result.katapultExisting,
        ...result.katapultProposed
      ], result.spidaRecommended) : null;

      if (katapult) {
        processedKatapult.add(katapult.id || '');
      }

      const heightChanges: ComparisonRow['heightChanges'] = {};
      if (katapult) {
        heightChanges.recommendedToKatapult = katapult.height - recommended.height;
      }

      rows.push({
        id: recommended.id || `recommended-${rows.length}`,
        measured: null,
        recommended,
        katapult,
        matchType: 'new-spida',
        heightChanges
      });
    });

    // Add Katapult-only attachments if showing Katapult
    if (showKatapult) {
      [...result.katapultExisting, ...result.katapultProposed].forEach(katapult => {
        if (processedKatapult.has(katapult.id || '')) return;

        rows.push({
          id: katapult.id || `katapult-${rows.length}`,
          measured: null,
          recommended: null,
          katapult,
          matchType: 'new-katapult',
          heightChanges: {}
        });
      });
    }

    // Sort by height (highest first)
    return rows.sort((a, b) => {
      const aHeight = a.recommended?.height || a.measured?.height || a.katapult?.height || 0;
      const bHeight = b.recommended?.height || b.measured?.height || b.katapult?.height || 0;
      return bHeight - aHeight;
    });
  }, [result, showKatapult]);

  const getMatchStatusBadge = (matchType: ComparisonRow['matchType']) => {
    switch (matchType) {
      case 'exact':
        return <span className="px-2 py-1 text-xs bg-green-600 text-white rounded-full">✓ Match</span>;
      case 'modified':
        return <span className="px-2 py-1 text-xs bg-orange-500 text-white rounded-full">△ Modified</span>;
      case 'new-spida':
        return <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">+ New (SPIDA)</span>;
      case 'new-katapult':
        return <span className="px-2 py-1 text-xs bg-purple-600 text-white rounded-full">+ New (Katapult)</span>;
      case 'missing':
        return <span className="px-2 py-1 text-xs bg-red-600 text-white rounded-full">⚠ Missing</span>;
      default:
        return null;
    }
  };

  const DifferenceIndicator: React.FC<{ difference?: number }> = ({ difference }) => {
    if (difference === undefined || Math.abs(difference) < 0.01) {
      return <span className="text-slate-400 text-xs">—</span>;
    }

    const isHigher = difference > 0;
    const isSignificant = Math.abs(difference) > 0.15; // 6 inches
    
    return (
      <div className="flex items-center gap-1">
        <span className={`text-xs ${isSignificant ? 'font-bold' : ''} ${
          isHigher ? 'text-red-400' : 'text-green-400'
        }`}>
          {isHigher ? '▲' : '▼'} {formatHeightFtIn(Math.abs(difference))}
        </span>
        {isSignificant && (
          <span className="text-amber-400 text-xs" title="Significant height change (>6 inches)">
            ⚠
          </span>
        )}
      </div>
    );
  };

  const AttachmentCard: React.FC<{ 
    attachment: Attachment | null; 
    label: string;
    isHighlighted?: boolean;
  }> = ({ attachment, label, isHighlighted }) => {
    if (!attachment) {
      return (
        <div className="h-full min-h-[80px] bg-slate-800 border border-slate-600 rounded-lg p-3 flex items-center justify-center">
          <span className="text-slate-500 text-sm italic">No {label.toLowerCase()}</span>
        </div>
      );
    }

    return (
      <div className={`h-full min-h-[80px] border rounded-lg p-3 transition-all ${
        isHighlighted 
          ? 'bg-amber-900/30 border-amber-500 shadow-md' 
          : 'bg-slate-800 border-slate-600'
      }`}>
        <div className="flex items-start justify-between mb-2">
          <div className="text-xs font-medium text-slate-300 uppercase tracking-wider">
            {label}
          </div>
          <div className="text-lg font-mono font-bold text-white">
            {formatHeightFtIn(attachment.height)}
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="text-sm font-medium text-white">
            {attachment.owner} — {attachment.type}
          </div>
          <div className="text-xs text-slate-400 line-clamp-2">
            {attachment.description}
          </div>
          
          {/* Movement indicator for Katapult attachments */}
          {attachment.moveDirection && attachment.moveDirection !== 'none' && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-xs px-2 py-1 rounded ${
                attachment.moveDirection === 'up' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-orange-600 text-white'
              }`}>
                {attachment.moveDirection === 'up' ? '⬆️' : '⬇️'} {attachment.moveDescription}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
        <div>
          <h3 className="text-lg font-semibold text-white">Split Screen Comparison</h3>
          <p className="text-sm text-slate-300">
            {showKatapult 
              ? 'Comparing SPIDA Measured → Recommended → Katapult' 
              : 'Comparing SPIDA Measured → Recommended'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300">SPIDA Only</span>
          <button
            onClick={() => setShowKatapult(!showKatapult)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showKatapult ? 'bg-blue-600' : 'bg-slate-500'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showKatapult ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-sm text-slate-300">Include Katapult</span>
        </div>
      </div>

      {/* Column Headers */}
      <div className={`grid gap-4 ${showKatapult ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="text-center p-3 bg-blue-600 text-white font-semibold rounded-lg">
          SPIDA Measured ({result.spidaMeasured.length})
        </div>
        <div className="text-center p-3 bg-green-600 text-white font-semibold rounded-lg">
          SPIDA Recommended ({result.spidaRecommended.length})
        </div>
        {showKatapult && (
          <div className="text-center p-3 bg-purple-600 text-white font-semibold rounded-lg">
            Katapult ({result.katapultExisting.length + result.katapultProposed.length})
          </div>
        )}
      </div>

      {/* Comparison Rows */}
      <div className="space-y-2">
        {comparisonRows.map((row, index) => (
          <div key={row.id} className="bg-slate-900 rounded-lg p-4">
            {/* Row Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {getMatchStatusBadge(row.matchType)}
                <span className="text-sm text-slate-400">
                  Row {index + 1}
                </span>
              </div>
              
              {/* Height Difference Indicators */}
              <div className="flex items-center gap-4 text-sm">
                {row.heightChanges.measuredToRecommended !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">M→R:</span>
                    <DifferenceIndicator difference={row.heightChanges.measuredToRecommended} />
                  </div>
                )}
                {showKatapult && row.heightChanges.recommendedToKatapult !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">R→K:</span>
                    <DifferenceIndicator difference={row.heightChanges.recommendedToKatapult} />
                  </div>
                )}
              </div>
            </div>

            {/* Attachment Cards Grid */}
            <div className={`grid gap-4 ${showKatapult ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <AttachmentCard 
                attachment={row.measured} 
                label="Measured"
                isHighlighted={row.matchType === 'modified' && row.heightChanges.measuredToRecommended !== undefined}
              />
              <AttachmentCard 
                attachment={row.recommended} 
                label="Recommended"
                isHighlighted={row.matchType === 'modified' || row.matchType === 'new-spida'}
              />
              {showKatapult && (
                <AttachmentCard 
                  attachment={row.katapult} 
                  label="Katapult"
                  isHighlighted={row.matchType === 'new-katapult' || 
                    (row.heightChanges.recommendedToKatapult !== undefined && 
                     Math.abs(row.heightChanges.recommendedToKatapult) > 0.15)}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Comparison Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">
              {comparisonRows.filter(r => r.matchType === 'exact').length}
            </div>
            <div className="text-slate-400">Exact Matches</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-400">
              {comparisonRows.filter(r => r.matchType === 'modified').length}
            </div>
            <div className="text-slate-400">Modified</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">
              {comparisonRows.filter(r => r.matchType === 'new-spida').length}
            </div>
            <div className="text-slate-400">New (SPIDA)</div>
          </div>
          {showKatapult && (
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">
                {comparisonRows.filter(r => r.matchType === 'new-katapult').length}
              </div>
              <div className="text-slate-400">New (Katapult)</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitScreenComparison; 