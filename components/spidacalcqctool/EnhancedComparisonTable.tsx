import React from 'react';
import { EnhancedComparison } from './types';
import { formatHeightFtIn } from './comparisonHelpers';

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
  // Group enhanced comparisons with insulators as parents and wires as children
  const groupEnhancedComparisons = () => {
    const insulators: EnhancedGroupedInsulator[] = [];
    const ungroupedComparisons: EnhancedComparison[] = [];

    // Find all insulators first
    enhancedComparisons
      .filter(comp => 
        (comp.spida?.type.toLowerCase().includes('insulator') || 
         comp.katapult?.type.toLowerCase().includes('insulator'))
      )
      .sort((a, b) => {
        const aHeight = a.spida?.height || a.katapult?.height || 0;
        const bHeight = b.spida?.height || b.katapult?.height || 0;
        return bHeight - aHeight; // Sort by height (highest first)
      })
      .forEach(insulatorComp => {
        const insulatorId = insulatorComp.spida?.id || insulatorComp.katapult?.id;
        
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
          insulator: insulatorComp,
          wires: connectedWires
        });
      });

    // Find ungrouped comparisons (not insulators and not connected to insulators)
    enhancedComparisons
      .filter(comp => 
        !(comp.spida?.type.toLowerCase().includes('insulator') || 
          comp.katapult?.type.toLowerCase().includes('insulator')) &&
        !comp.spida?.parentInsulatorId &&
        !comp.katapult?.parentInsulatorId
      )
      .sort((a, b) => {
        const aHeight = a.spida?.height || a.katapult?.height || 0;
        const bHeight = b.spida?.height || b.katapult?.height || 0;
        return bHeight - aHeight;
      })
      .forEach(comp => {
        ungroupedComparisons.push(comp);
      });

    return { insulators, ungroupedComparisons };
  };

  const { insulators, ungroupedComparisons } = groupEnhancedComparisons();

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
        {/* Render insulators with their wires */}
        {insulators.map((group, idx) => (
          <React.Fragment key={group.insulator.spida?.id || group.insulator.katapult?.id || `enhanced-insulator-group-${idx}`}>
            {/* Insulator parent row */}
            <tr className="bg-slate-800 text-white">
              <td style={styles.tdParent}>
                {group.insulator.spida || group.insulator.katapult ? (
                  <div style={{ fontWeight: 600, color: '#d1d5db' }}>
                    📍 {group.insulator.spida?.owner || group.insulator.katapult?.owner} ‒ {group.insulator.spida?.description || group.insulator.katapult?.description}
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
        ))}

        {/* Render ungrouped comparisons */}
        {ungroupedComparisons.map((comparison, idx) => {
          const { spida, katapult } = comparison;

          return (
            <tr
              key={spida?.id || katapult?.id || `enhanced-${idx}`}
              className={`${idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} text-white`}
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