import React from 'react';
import { EnhancedComparison } from './types';
import { formatHeightFtIn } from './comparisonHelpers';
import { sortWithCrossArmHierarchy } from './crossArmSorting';

interface EnhancedComparisonTableProps {
  enhancedComparisons: EnhancedComparison[];
}

interface EnhancedGroupedInsulator {
  insulator: EnhancedComparison;
  wires: EnhancedComparison[];
}

const EnhancedComparisonTable: React.FC<EnhancedComparisonTableProps> = ({
  enhancedComparisons,
}) => {
  // Group enhanced comparisons with cross-arm hierarchy awareness
  const groupEnhancedComparisons = () => {
    const insulators: EnhancedGroupedInsulator[] = [];
    const ungroupedComparisons: EnhancedComparison[] = [];

    // Extract all SPIDA attachments for hierarchy sorting
    const spidaAttachments = enhancedComparisons
      .filter(comp => comp.spida)
      .map(comp => comp.spida!);
    
    // Apply cross-arm hierarchy sorting
    const sortedSpidaAttachments = sortWithCrossArmHierarchy(spidaAttachments);

    // Process comparisons in hierarchy-sorted order
    sortedSpidaAttachments.forEach(attachment => {
      // Find the corresponding enhanced comparison
      const comparison = enhancedComparisons.find(comp => 
        comp.spida?.id === attachment.id
      );
      
      if (!comparison) return;

      if (attachment.type.toLowerCase().includes('insulator') && !attachment.type.toLowerCase().includes('cross-arm')) {
        // This is a regular insulator - group it with its wires
        const insulatorId = comparison.spida?.id || comparison.katapult?.id;
        
        // Find wires connected to this insulator
        const connectedWires = enhancedComparisons
          .filter(comp => 
            comp.spida?.parentInsulatorId === insulatorId ||
            comp.katapult?.parentInsulatorId === insulatorId
          )
          .sort((a, b) => {
            const aHeight = a.spida?.height || a.katapult?.height || 0;
            const bHeight = b.spida?.height || b.katapult?.height || 0;
            return bHeight - aHeight; // Sort wires by height too
          });

        insulators.push({
          insulator: comparison,
          wires: connectedWires
        });
      } else if (!attachment.parentInsulatorId) {
        // This is an ungrouped attachment (cross-arms, guys, equipment, etc.)
        ungroupedComparisons.push(comparison);
      }
      // Skip wires that are connected to insulators (they're handled in insulator grouping above)
    });

    // Add any Katapult-only comparisons that weren't included above
    enhancedComparisons
      .filter(comp => !comp.spida && comp.katapult)
      .sort((a, b) => {
        const aHeight = a.katapult?.height || 0;
        const bHeight = b.katapult?.height || 0;
        return bHeight - aHeight;
      })
      .forEach(comp => {
        if (comp.katapult?.type.toLowerCase().includes('insulator') && !comp.katapult?.type.toLowerCase().includes('cross-arm')) {
          // Katapult-only insulator
          const insulatorId = comp.katapult.id;
          const connectedWires = enhancedComparisons
            .filter(c => 
              c.spida?.parentInsulatorId === insulatorId ||
              c.katapult?.parentInsulatorId === insulatorId
            )
            .sort((a, b) => {
              const aHeight = a.spida?.height || a.katapult?.height || 0;
              const bHeight = b.spida?.height || b.katapult?.height || 0;
              return bHeight - aHeight;
            });
          
          insulators.push({
            insulator: comp,
            wires: connectedWires
          });
        } else if (!comp.katapult?.parentInsulatorId) {
          ungroupedComparisons.push(comp);
        }
      });

    return { insulators, ungroupedComparisons };
  };

  const { insulators, ungroupedComparisons } = groupEnhancedComparisons();
  
  // Create a merged and ordered list for rendering with cross-arm hierarchy
  const createOrderedRenderList = () => {
    const spidaAttachments = enhancedComparisons
      .filter(comp => comp.spida)
      .map(comp => comp.spida!);
    const sortedSpidaAttachments = sortWithCrossArmHierarchy(spidaAttachments);
    const renderItems: Array<{ type: 'insulator' | 'ungrouped'; data: any }> = [];
    
    sortedSpidaAttachments.forEach(attachment => {
      if (attachment.type.toLowerCase().includes('insulator') && !attachment.type.toLowerCase().includes('cross-arm')) {
        // Find the corresponding insulator group
        const insulatorGroup = insulators.find(ins => ins.insulator.spida?.id === attachment.id);
        if (insulatorGroup) {
          renderItems.push({ type: 'insulator', data: insulatorGroup });
        }
      } else if (!attachment.parentInsulatorId) {
        // Find the corresponding ungrouped comparison
        const ungroupedItem = ungroupedComparisons.find(ung => ung.spida?.id === attachment.id);
        if (ungroupedItem) {
          renderItems.push({ type: 'ungrouped', data: ungroupedItem });
        }
      }
    });
    
    // Add any Katapult-only comparisons
    ungroupedComparisons
      .filter(comp => !comp.spida && comp.katapult)
      .forEach(comp => {
        renderItems.push({ type: 'ungrouped', data: comp });
      });
    
    return renderItems;
  };
  
  const orderedRenderList = createOrderedRenderList();

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
        {/* Render attachments in hierarchy-sorted order */}
        {orderedRenderList.map((item, idx) => {
          if (item.type === 'insulator') {
            const group = item.data as EnhancedGroupedInsulator;
            return (
          <React.Fragment key={group.insulator.spida?.id || group.insulator.katapult?.id || `enhanced-insulator-group-${idx}`}>
            {/* Insulator parent row */}
            <tr className="bg-slate-800 text-white">
              <td style={styles.tdParent}>
                                  {group.insulator.spida || group.insulator.katapult ? (
                    <div style={{ fontWeight: 600, color: '#d1d5db' }}>
                      📍 {group.insulator.spida?.owner || group.insulator.katapult?.owner} ‒ {group.insulator.spida?.description || group.insulator.katapult?.description}
                      {(group.insulator.spida?.parentCrossArmId || group.insulator.katapult?.parentCrossArmId) && (
                        <span style={{ color: '#f59e0b', fontSize: '0.8em', marginLeft: '8px' }}>
                          (on cross-arm {group.insulator.spida?.parentCrossArmId || group.insulator.katapult?.parentCrossArmId})
                        </span>
                      )}
                      {group.insulator.changeType === 'brand-new' && (
                        <span style={{ 
                          backgroundColor: '#10b981', 
                          color: 'white', 
                          padding: '2px 6px', 
                          borderRadius: '8px', 
                          fontSize: '0.7em', 
                          fontWeight: 'bold',
                          marginLeft: '6px' 
                        }}>
                          {group.insulator.sourceLabel === 'KATAPULT NEW' ? 'KATAPULT NEW' : 'NEW'}
                        </span>
                      )}
                      {group.insulator.changeType === 'height-change' && (
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
                          title={`Height changed from ${group.insulator.measuredHeight?.toFixed(1)}ft to ${(group.insulator.spida?.height || group.insulator.katapult?.height)?.toFixed(1)}ft`}
                        >
                          Δ
                        </span>
                      )}
                      {group.insulator.changeType === 'height-change' && group.insulator.measuredHeight && (
                        <span style={{ color: '#f59e0b', fontSize: '0.8em', marginLeft: '8px' }}>
                          (was {formatHeightFtIn(group.insulator.measuredHeight)})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#718096' }}>No match found</span>
                  )}
              </td>

              {/* Measured (SPIDA) height */}
              <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                {group.insulator.measuredHeight !== undefined ? (
                  <span style={{ color: '#a0aec0' }}>
                    {formatHeightFtIn(group.insulator.measuredHeight)}
                  </span>
                ) : (
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>NEW</span>
                )}
              </td>

              {/* Proposed height (from Recommended design) */}
              <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                {group.insulator.spida ? (
                  formatHeightFtIn(group.insulator.spida.height)
                ) : (
                  <span style={{ color: '#718096' }}>—</span>
                )}
              </td>

              {/* Katapult height / info */}
              <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                {group.insulator.katapult ? (
                  <div style={{ 
                    opacity: group.insulator.katapult.synthetic ? 0.7 : 1, 
                    fontStyle: group.insulator.katapult.synthetic ? 'italic' : 'normal' 
                  }}>
                    {formatHeightFtIn(group.insulator.katapult.height)}
                    {group.insulator.katapult.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                  </div>
                ) : (
                  <span style={{ color: '#718096' }}>No proposed match found</span>
                )}
              </td>

              {/* Difference */}
              <td style={{ ...styles.tdParent, textAlign: 'center' }}>
                <DeltaCell spida={group.insulator.spida} kat={group.insulator.katapult} />
              </td>
            </tr>

            {/* Connected wires as child rows */}
            {group.wires.map((wireComp, wireIdx) => (
              <tr
                key={wireComp.spida?.id || wireComp.katapult?.id || `enhanced-wire-${wireIdx}`}
                className="bg-slate-900/80 text-slate-300"
              >
                <td style={{ ...styles.tdChild, paddingLeft: '2rem' }}>
                  {wireComp.spida || wireComp.katapult ? (
                    <div style={{ fontWeight: 400, color: '#a0aec0' }}>
                      🔌 {wireComp.spida?.owner || wireComp.katapult?.owner} ‒ {wireComp.spida?.description || wireComp.katapult?.description}
                      {wireComp.changeType === 'brand-new' && (
                        <span style={{ 
                          backgroundColor: '#10b981', 
                          color: 'white', 
                          padding: '2px 6px', 
                          borderRadius: '8px', 
                          fontSize: '0.7em', 
                          fontWeight: 'bold',
                          marginLeft: '6px' 
                        }}>
                          {wireComp.sourceLabel === 'KATAPULT NEW' ? 'KATAPULT NEW' : 'NEW'}
                        </span>
                      )}
                      {wireComp.changeType === 'height-change' && (
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
                          title={`Height changed from ${wireComp.measuredHeight?.toFixed(1)}ft to ${(wireComp.spida?.height || wireComp.katapult?.height)?.toFixed(1)}ft`}
                        >
                          Δ
                        </span>
                      )}
                      {wireComp.changeType === 'height-change' && wireComp.measuredHeight && (
                        <span style={{ color: '#f59e0b', fontSize: '0.8em', marginLeft: '8px' }}>
                          (was {formatHeightFtIn(wireComp.measuredHeight)})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#718096' }}>No match found</span>
                  )}
                </td>

                {/* Measured (SPIDA) height */}
                <td style={{ ...styles.tdChild, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2em', fontWeight: 500 }}>
                  {wireComp.measuredHeight !== undefined ? (
                    <span style={{ color: '#a0aec0' }}>
                      {formatHeightFtIn(wireComp.measuredHeight)}
                    </span>
                  ) : (
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>NEW</span>
                  )}
                </td>

                {/* Proposed height (from Recommended design) */}
                <td style={{ ...styles.tdChild, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2em', fontWeight: 500 }}>
                  {wireComp.spida ? (
                    formatHeightFtIn(wireComp.spida.height)
                  ) : (
                    <span style={{ color: '#718096' }}>—</span>
                  )}
                </td>

                {/* Katapult height / info */}
                <td style={{ ...styles.tdChild, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2em', fontWeight: 500 }}>
                  {wireComp.katapult ? (
                    <div style={{ 
                      opacity: wireComp.katapult.synthetic ? 0.7 : 1, 
                      fontStyle: wireComp.katapult.synthetic ? 'italic' : 'normal' 
                    }}>
                      {formatHeightFtIn(wireComp.katapult.height)}
                      {wireComp.katapult.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                    </div>
                  ) : (
                    <span style={{ color: '#718096' }}>No proposed match found</span>
                  )}
                </td>

                {/* Difference */}
                <td style={{ ...styles.tdChild, textAlign: 'center' }}>
                  <DeltaCell spida={wireComp.spida} kat={wireComp.katapult} />
                </td>
              </tr>
            ))}
          </React.Fragment>
        );
      } else {
        // Ungrouped attachment (including cross-arms, equipment, guys)
        const comparison = item.data as EnhancedComparison;
        const { spida, katapult } = comparison;
        
        // Determine type from either spida or katapult data
        const spidaType = spida?.type.toLowerCase() || '';
        const katapultType = katapult?.type.toLowerCase() || '';
        
        // Check for different attachment types
        const isCrossArm = spidaType.includes('cross-arm') || katapultType.includes('cross-arm');
        const isEquipment = spidaType.includes('transformer') || katapultType.includes('transformer') ||
                           spidaType.includes('light') || katapultType.includes('light') ||
                           spidaType.includes('equipment') || katapultType.includes('equipment') ||
                           spidaType.includes('pole top') || katapultType.includes('pole top') ||
                           spidaType.includes('riser') || katapultType.includes('riser') ||
                           spidaType.includes('drip') || katapultType.includes('drip') ||
                           spidaType.includes('loop') || katapultType.includes('loop');
        const isGuy = spidaType.includes('guy') || katapultType.includes('guy');
        
        // Use wrench icon for cross-arms, equipment, and guys
        const needsWrenchIcon = isCrossArm || isEquipment || isGuy;
        const icon = needsWrenchIcon ? '🔧 ' : '';

        return (
          <tr
            key={spida?.id || katapult?.id || `enhanced-${idx}`}
            className={`${idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} text-white`}
          >
            {/* SPIDA attachment cell */}
            <td style={styles.td}>
              {spida || katapult ? (
                <div style={{ fontWeight: 500, color: '#a0aec0' }}>
                  {icon}{spida?.owner || katapult?.owner} ‒ {spida?.description || katapult?.description}
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
    padding: '8px 12px',
    verticalAlign: 'top' as const,
  },
};

export default EnhancedComparisonTable; 