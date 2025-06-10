import React from 'react';
import { EnhancedComparison } from './types';
import { formatHeightFtIn, groupEnhancedByInsulator, removeEnhancedDuplicateWires } from './comparisonHelpers';

interface EnhancedComparisonTableProps {
  enhancedComparisons: EnhancedComparison[];
}

const EnhancedComparisonTable: React.FC<EnhancedComparisonTableProps> = ({
  enhancedComparisons,
}) => {
  // Helper to clean up insulator names - remove redundant "Insulator (" prefix and ")" suffix
  const cleanInsulatorName = (type: string): string => {
    if (type.startsWith('Insulator (') && type.endsWith(')')) {
      return type.slice(11, -1); // Remove "Insulator (" and ")"
    }
    return type;
  };

  // Sort all comparisons by height (highest first) - pole tops will naturally be first since they're tallest
  const sortedComparisons = [...enhancedComparisons].sort((a, b) => {
    const aHeight = a.spida?.height || a.katapult?.height || 0;
    const bHeight = b.spida?.height || b.katapult?.height || 0;
    return bHeight - aHeight; // Sort by height (highest first)
  });

  // Use the proven helper functions for consistent grouping
  const filteredComparisons = removeEnhancedDuplicateWires(sortedComparisons);
  const groupedRows = groupEnhancedByInsulator(sortedComparisons);
  const ungroupedComparisons = filteredComparisons
    .filter(comp => 
      !comp.spida?.type.toLowerCase().includes('insulator') && 
      !comp.katapult?.type.toLowerCase().includes('insulator')
    );

  // Create unified items array for proper height-based sorting
  const allItems: Array<{ type: 'grouped' | 'ungrouped', height: number, data: any, index: number }> = [];
  
  // Add grouped items (use parent height for sorting)
  groupedRows.forEach((group, idx) => {
    const height = group.parent.spida?.height || group.parent.katapult?.height || 0;
    allItems.push({
      type: 'grouped',
      height: height,
      data: group,
      index: idx
    });
  });
  
  // Add ungrouped items (use attachment height for sorting)
  ungroupedComparisons.forEach((comp, idx) => {
    const height = comp.spida?.height || comp.katapult?.height || 0;
    allItems.push({
      type: 'ungrouped',
      height: height,
      data: comp,
      index: idx
    });
  });
  
  // Sort all items by height (highest first)
  const sortedItems = allItems.sort((a, b) => b.height - a.height);

  const DeltaCell: React.FC<{ spida: any; kat: any }> = ({ spida, kat }) => {
    if (!spida || !kat) return <span className="text-slate-400 text-xs">N/A</span>;
    
    const difference = spida.height - kat.height;
    if (Math.abs(difference) < 0.01) return <span className="text-slate-400 text-xs">—</span>;
    
    const isHigher = difference > 0;
    const chipClasses = isHigher 
      ? "px-1.5 rounded text-xs font-mono text-red-400 bg-red-900/40"
      : "px-1.5 rounded text-xs font-mono text-green-400 bg-green-900/40";
    
    return (
      <span className={chipClasses}>
        {isHigher ? '▲' : '▼'} {formatHeightFtIn(Math.abs(difference))}
      </span>
    );
  };

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: 0,
        border: 'none',
        fontSize: '0.9em',
        backgroundColor: '#1e1e1e',
        color: '#ffffff',
      }}
    >
      <thead className="sticky top-0 z-[5] bg-slate-700/90 backdrop-blur font-medium text-xs border-b border-slate-600">
        <tr>
          <th style={styles.thCondensed}>SPIDA Attachment</th>
          <th style={{...styles.thCondensed, textAlign: 'center'}}>Measured (SPIDA) Height</th>
          <th style={{...styles.thCondensed, textAlign: 'center'}}>Proposed Height</th>
          <th style={{...styles.thCondensed, textAlign: 'center'}}>Katapult Height</th>
          <th style={{...styles.thCondensed, textAlign: 'center'}}>Difference</th>
        </tr>
      </thead>
      <tbody>
        {/* Render all items sorted by height (highest first) */}
        {sortedItems.map((item, globalIdx) => {
          if (item.type === 'grouped') {
            const group = item.data;
            return (
              <React.Fragment key={group.parent.spida?.id || group.parent.katapult?.id || `enhanced-group-${item.index}`}>
                {/* Parent insulator row */}
                <tr className="bg-slate-800 text-white group-odd:bg-slate-800/80">
                  <td style={styles.tdParent}>
                    {group.parent.spida || group.parent.katapult ? (
                      <div style={{ fontWeight: 600, color: '#d1d5db' }}>
                        {group.parent.spida?.owner || group.parent.katapult?.owner} ‒ {group.parent.spida?.description || group.parent.katapult?.description}
                        {group.parent.changeType === 'brand-new' && (
                          <span style={{ 
                            backgroundColor: '#10b981', 
                            color: 'white', 
                            padding: '2px 6px', 
                            borderRadius: '8px', 
                            fontSize: '0.7em', 
                            fontWeight: 'bold',
                            marginLeft: '6px' 
                          }}>
                            {group.parent.sourceLabel === 'KATAPULT NEW' ? 'KATAPULT NEW' : 'NEW'}
                          </span>
                        )}
                        {group.parent.changeType === 'height-change' && (
                          <span 
                            style={{ 
                              backgroundColor: '#f59e0b', 
                              color: 'white', 
                              padding: '2px 6px', 
                              borderRadius: '8px', 
                              fontSize: '0.7em', 
                              fontWeight: 'bold',
                              marginLeft: '6px' 
                            }}
                            title={`Height changed from ${group.parent.measuredHeight?.toFixed(1)}ft to ${(group.parent.spida?.height || group.parent.katapult?.height)?.toFixed(1)}ft`}
                          >
                            Δ
                          </span>
                        )}
                        {group.parent.changeType === 'height-change' && group.parent.measuredHeight && (
                          <span style={{ color: '#f59e0b', fontSize: '0.8em', marginLeft: '8px' }}>
                            (was {formatHeightFtIn(group.parent.measuredHeight)})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#718096' }}>No match found</span>
                    )}
                  </td>
                  
                  {/* Measured (SPIDA) height */}
                  <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                    {group.parent.measuredHeight !== undefined ? (
                      <span style={{ color: '#a0aec0' }}>
                        {formatHeightFtIn(group.parent.measuredHeight)}
                      </span>
                    ) : (
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>NEW</span>
                    )}
                  </td>

                  {/* Proposed height (from Recommended design) */}
                  <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                    {group.parent.spida ? (
                      formatHeightFtIn(group.parent.spida.height)
                    ) : (
                      <span style={{ color: '#718096' }}>—</span>
                    )}
                  </td>

                  {/* Katapult height / info */}
                  <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                    {group.parent.katapult ? (
                      <div style={{ 
                        opacity: group.parent.katapult.synthetic ? 0.7 : 1, 
                        fontStyle: group.parent.katapult.synthetic ? 'italic' : 'normal' 
                      }}>
                        {formatHeightFtIn(group.parent.katapult.height)}
                        {group.parent.katapult.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                      </div>
                    ) : (
                      <span style={{ color: '#718096' }}>No proposed match found</span>
                    )}
                  </td>

                  {/* Difference */}
                  <td style={{ ...styles.tdParent, textAlign: 'center' }}>
                    <DeltaCell spida={group.parent.spida} kat={group.parent.katapult} />
                  </td>
                </tr>

                {/* Child wires row */}
                {group.children.length > 0 && (
                  <tr className="bg-slate-900/80 text-slate-300">
                    <td colSpan={5} style={{ ...styles.tdChild, paddingLeft: '2.5rem', paddingTop: '0.375rem', paddingBottom: '0.375rem' }}>
                      <ul style={{ listStyleType: 'disc', marginLeft: '1rem', margin: 0, padding: 0 }}>
                        {group.children.map((child: EnhancedComparison, wireIdx: number) => (
                          <li key={child.spida?.id || child.katapult?.id || `enhanced-wire-${wireIdx}`} style={{ marginBottom: '0.125rem' }}>
                            <span className="inline-block px-1 rounded bg-slate-600/40 text-slate-200 text-[10px] mr-2">{child.spida?.owner || child.katapult?.owner}</span>
                            {child.spida?.description || child.spida?.type || child.katapult?.description || child.katapult?.type}
                            {child.changeType === 'brand-new' && (
                              <span style={{ 
                                backgroundColor: '#10b981', 
                                color: 'white', 
                                padding: '1px 4px', 
                                borderRadius: '4px', 
                                fontSize: '0.6em', 
                                fontWeight: 'bold',
                                marginLeft: '4px' 
                              }}>
                                {child.sourceLabel === 'KATAPULT NEW' ? 'KAT NEW' : 'NEW'}
                              </span>
                            )}
                            {child.changeType === 'height-change' && (
                              <span style={{ 
                                backgroundColor: '#f59e0b', 
                                color: 'white', 
                                padding: '1px 4px', 
                                borderRadius: '4px', 
                                fontSize: '0.6em', 
                                fontWeight: 'bold',
                                marginLeft: '4px' 
                              }}>
                                Δ
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          } else {
            // Ungrouped item
            const comparison = item.data;
            const { spida, katapult } = comparison;

            return (
              <tr
                key={spida?.id || katapult?.id || `enhanced-ungrouped-${item.index}`}
                className={`${globalIdx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} text-white`}
              >
                {/* SPIDA attachment cell */}
                <td style={styles.td}>
                  {spida || katapult ? (
                    <div style={{ fontWeight: 500, color: '#a0aec0' }}>
                      {spida?.owner || katapult?.owner} ‒ {spida?.description || katapult?.description}
                      {comparison.changeType === 'brand-new' && (
                        <span style={{ 
                          backgroundColor: '#10b981', 
                          color: 'white', 
                          padding: '2px 6px', 
                          borderRadius: '8px', 
                          fontSize: '0.7em', 
                          fontWeight: 'bold',
                          marginLeft: '6px' 
                        }}>
                          {comparison.sourceLabel === 'KATAPULT NEW' ? 'KATAPULT NEW' : 'NEW'}
                        </span>
                      )}
                      {comparison.changeType === 'height-change' && (
                        <span 
                          style={{ 
                            backgroundColor: '#f59e0b', 
                            color: 'white', 
                            padding: '2px 6px', 
                            borderRadius: '8px', 
                            fontSize: '0.7em', 
                            fontWeight: 'bold',
                            marginLeft: '6px' 
                          }}
                          title={`Height changed from ${comparison.measuredHeight?.toFixed(1)}ft to ${(spida?.height || katapult?.height)?.toFixed(1)}ft`}
                        >
                          Δ
                        </span>
                      )}
                      {comparison.changeType === 'height-change' && comparison.measuredHeight && (
                        <span style={{ color: '#f59e0b', fontSize: '0.8em', marginLeft: '8px' }}>
                          (was {formatHeightFtIn(comparison.measuredHeight)})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#718096' }}>No match found</span>
                  )}
                </td>

                {/* Measured (SPIDA) height */}
                <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                  {comparison.measuredHeight !== undefined ? (
                    <span style={{ color: '#a0aec0' }}>
                      {formatHeightFtIn(comparison.measuredHeight)}
                    </span>
                  ) : (
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>NEW</span>
                  )}
                </td>

                {/* Proposed height (from Recommended design) */}
                <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                  {spida ? (
                    formatHeightFtIn(spida.height)
                  ) : (
                    <span style={{ color: '#718096' }}>—</span>
                  )}
                </td>

                {/* Katapult height / info */}
                <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                  {katapult ? (
                    <div style={{ 
                      opacity: katapult.synthetic ? 0.7 : 1, 
                      fontStyle: katapult.synthetic ? 'italic' : 'normal' 
                    }}>
                      {formatHeightFtIn(katapult.height)}
                      {katapult.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                    </div>
                  ) : (
                    <span style={{ color: '#718096' }}>No proposed match found</span>
                  )}
                </td>

                {/* Difference */}
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <DeltaCell spida={spida} kat={katapult} />
                </td>
              </tr>
            );
          }
        })}
      </tbody>
    </table>
  );
};

const styles = {
  th: {
    border: '1px solid #4a5568',
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  thCondensed: {
    padding: '8px 12px',
    textAlign: 'left' as const,
    color: '#e2e8f0',
  },
  td: {
    border: '1px solid #4a5568',
    padding: '10px 12px',
    verticalAlign: 'top' as const,
  },
  tdParent: {
    border: '1px solid #4a5568',
    padding: '12px 16px',
    verticalAlign: 'top' as const,
  },
  tdChild: {
    border: '1px solid #4a5568',
    fontSize: '0.875rem',
  },
};

export default EnhancedComparisonTable; 