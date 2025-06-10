// /components/SpidaQcTool/ComparisonPole.tsx

import React, { useState } from 'react';
import { ComparisonResult } from './types';
import ComparisonTable from './ComparisonTable';
import EnhancedComparisonTable from './EnhancedComparisonTable';
import { formatMetersToFeetInches } from '../../utils/measurements';

interface ComparisonPoleProps {
  result: ComparisonResult;
}

const ComparisonPole: React.FC<ComparisonPoleProps> = ({ result }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate summary stats for the header
  const totalSpidaMeasured = result.spidaMeasured.length;
  const totalKatapultExisting = result.katapultExisting.length;

  const totalKatapultProposed = result.katapultProposed.length;
  
  // Enhanced comparison stats (changes only)
  const changesCount = result.enhancedProposedComparison ? result.enhancedProposedComparison.length : 0;
  const newCount = result.enhancedProposedComparison ? 
    result.enhancedProposedComparison.filter(comp => comp.changeType === 'brand-new').length : 0;
  const modifiedCount = result.enhancedProposedComparison ? 
    result.enhancedProposedComparison.filter(comp => comp.changeType === 'height-change').length : 0;
  
  const changesLabel = changesCount > 0 ? 
    `${changesCount} change(s)` + (newCount > 0 ? ` (${newCount} new)` : '') + (modifiedCount > 0 ? ` (${modifiedCount} Δ)` : '') :
    'No changes';

  // Remove guy matching and cross-arm stats from header since tables are hidden

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  return (
    <div style={{ 
      border: '1px solid #4a5568', 
      borderRadius: '8px',
      marginBottom: '16px',
      backgroundColor: '#2d3748',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    }}>
      {/* Collapsible Header */}
      <div 
        onClick={toggleExpanded}
        style={{ 
          padding: '16px 20px',
          backgroundColor: isExpanded ? '#1a202c' : '#2d3748',
          borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: isExpanded ? '1px solid #4a5568' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ 
            fontSize: '1.2em', 
            fontWeight: '600',
            color: '#ffffff'
          }}>
            📍 {result.poleLabel}
          </span>
          
          {/* Pole Info Tags */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {result.poleInfo.species && (
              <span style={{ 
                backgroundColor: '#3182ce', 
                color: '#ffffff', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '0.85em',
                fontWeight: '500'
              }}>
                {result.poleInfo.species}
              </span>
            )}
            {result.poleInfo.classOfPole && (
              <span style={{ 
                backgroundColor: '#805ad5', 
                color: '#ffffff', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '0.85em',
                fontWeight: '500'
              }}>
                Class {result.poleInfo.classOfPole}
              </span>
            )}
            {result.poleInfo.height && (
              <span style={{ 
                backgroundColor: '#38a169', 
                color: '#ffffff', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '0.85em',
                fontWeight: '500'
              }}>
                {formatMetersToFeetInches(result.poleInfo.height)}
              </span>
            )}
          </div>
        </div>

        {/* Enhanced Summary Bar and Expand Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="text-xs font-mono gap-x-3 flex items-center">
            <span className="text-slate-300">{totalSpidaMeasured} vs {totalKatapultExisting}</span>
            <span className="text-slate-400">•</span>
            <span className="text-amber-400">{changesCount} changes</span>
            <span className="text-slate-400">•</span>
            <span className="text-green-400">{newCount} new</span>
            {modifiedCount > 0 && (
              <>
                <span className="text-slate-400">•</span>
                <span className="text-orange-400">{modifiedCount} Δ</span>
              </>
            )}
          </div>
          <span style={{ 
            fontSize: '1.2em', 
            color: '#a0aec0',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div style={{ padding: '20px', backgroundColor: '#1a202c' }}>
          <div style={{ display: 'grid', gap: '20px' }}>
            
            {/* Measured vs Existing Card */}
            <div style={{ 
              border: '1px solid #3182ce', 
              borderRadius: '8px',
              backgroundColor: '#2d3748'
            }}>
              <div style={{ 
                padding: '16px',
                backgroundColor: '#3182ce',
                borderRadius: '8px 8px 0 0',
                borderBottom: '1px solid #2c5282'
              }}>
                <h4 style={{ 
                  margin: '0', 
                  color: '#ffffff',
                  fontSize: '1.1em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📊 Measured (SPIDA) vs Existing (Katapult)
                  <span style={{ 
                    fontSize: '0.85em', 
                    fontWeight: 'normal',
                    backgroundColor: '#1a365d',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px'
                  }}>
                    {totalSpidaMeasured} vs {totalKatapultExisting}
                  </span>
                </h4>
              </div>
              
              <div style={{ padding: '16px' }}>
                {totalSpidaMeasured > 0 || totalKatapultExisting > 0 ? (
                  <ComparisonTable 
                    spidaAttachments={result.spidaMeasured}
                    katapultAttachments={result.katapultExisting}
                  />
                ) : (
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    color: '#a0aec0',
                    fontStyle: 'italic',
                    backgroundColor: '#1a202c',
                    border: '1px dashed #4a5568',
                    borderRadius: '4px'
                  }}>
                    No measured or existing attachments to compare
                  </div>
                )}
              </div>
            </div>

            {/* Recommended vs Proposed Card */}
            <div style={{ 
              border: '1px solid #38a169', 
              borderRadius: '8px',
              backgroundColor: '#2d3748'
            }}>
              <div style={{ 
                padding: '16px',
                backgroundColor: '#38a169',
                borderRadius: '8px 8px 0 0',
                borderBottom: '1px solid #2f855a'
              }}>
                <h4 style={{ 
                  margin: '0', 
                  color: '#ffffff',
                  fontSize: '1.1em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🔧 Recommended (SPIDA) vs Proposed (Katapult)
                  <span style={{ 
                    fontSize: '0.85em', 
                    fontWeight: 'normal',
                    backgroundColor: '#1c4532',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px'
                  }}>
                    {changesLabel} vs {totalKatapultProposed}
                  </span>
                </h4>
              </div>
              
              <div style={{ padding: '16px' }}>
                {result.enhancedProposedComparison && result.enhancedProposedComparison.length > 0 ? (
                  <EnhancedComparisonTable 
                    enhancedComparisons={result.enhancedProposedComparison}
                  />
                ) : (
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    color: '#a0aec0',
                    fontStyle: 'italic',
                    backgroundColor: '#1a202c',
                    border: '1px dashed #4a5568',
                    borderRadius: '4px'
                  }}>
                    {changesCount === 0 ? 
                      'No changes between Measured and Recommended designs' : 
                      'No proposed attachments to compare'
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Removed: Normalized Attachment Points, Production Guy Matching, and Cross-arm Mapping tables */}

          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonPole; 