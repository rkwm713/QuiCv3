import React from 'react';
import { Attachment } from './types';
import { groupByInsulator, removeDuplicateWires, formatHeightFtIn, CompRow } from './comparisonHelpers';

interface ComparisonTableProps {
  spidaAttachments: Attachment[];
  katapultAttachments: Attachment[];
}

// Owner aliases for better matching (sync with main parser)
const OWNER_ALIASES: Record<string, string> = {
  'cpsenergy': 'cps',
  'cpsenerg': 'cps',
  'attcom': 'at&t',
  'att': 'at&t',
  'at&t': 'at&t',
  'suddenlink': 'suddenlink',
  'charter': 'charter',
  'chartercomm': 'charter',
  'spectrum': 'charter',
  'city': 'city',
  'municipal': 'city',
};

// Helper to normalize owner strings for flexible comparisons
const normalizeOwner = (owner: string): string => {
  const key = owner.toLowerCase().replace(/[^a-z]/g, '');
  return OWNER_ALIASES[key] || key;
};

const ComparisonTable: React.FC<ComparisonTableProps> = ({
  spidaAttachments,
  katapultAttachments,
}) => {
  // Helper to clean up insulator names - remove redundant "Insulator (" prefix and ")" suffix
  const cleanInsulatorName = (type: string): string => {
    if (type.startsWith('Insulator (') && type.endsWith(')')) {
      return type.slice(11, -1); // Remove "Insulator (" and ")"
    }
    return type;
  };
  // Helper to map equipment types for better matching (sync with main parser)
  const mapEquipmentType = (type: string): string => {
    const lowerType = type.toLowerCase();
    // Fix 2: Normalize all communication service variations to one canonical type
    if (lowerType.includes('communication') || lowerType.includes('comm') || lowerType.includes('service') || lowerType.includes('drop')) return 'communication_service';
    if (lowerType.includes('drip') || lowerType.includes('loop')) return 'drip_loop';
    if (lowerType.includes('guy')) return 'guy'; // Guy wire normalization
    if (lowerType.includes('street') && lowerType.includes('light')) return 'street_light';
    if (lowerType.includes('transformer')) return 'transformer';
    return lowerType;
  };

  // Fallback owner heuristics for equipment types (sync with main parser)
  const ownerFromEquipmentType = (equipmentType: string): string => {
    const lowerType = equipmentType.toLowerCase();
    if (lowerType.includes('drip') || lowerType.includes('loop')) return 'cps';
    if (lowerType.includes('communication') || lowerType.includes('service') || lowerType.includes('comm')) return 'charter';
    if (lowerType.includes('street') || lowerType.includes('light')) return 'city';
    if (lowerType.includes('guy') || lowerType.includes('guying')) return 'cps'; // Utilities typically own guys
    return 'unknown';
  };

  // Helper that finds the best‐matching Katapult attachment for a given SPIDA attachment
  const findMatchingAttachment = (spidaAttachment: Attachment): Attachment | null => {
    let bestMatch: Attachment | null = null;
    let smallestDifference = Infinity;

    katapultAttachments.forEach((katapultAttachment) => {
      const spidaType = spidaAttachment.type.toLowerCase();
      const katapultType = katapultAttachment.type.toLowerCase();

      // Normalize owner names for flexible comparison (e.g., "CPS" vs. "CPS Energy")
      const normalizedSpidaOwner = normalizeOwner(spidaAttachment.owner);
      const normalizedKatapultOwner = normalizeOwner(katapultAttachment.owner);

      // Allow pass-through when either side is 'Unknown' (missing owner data)
      // Also handle equipment type fallback logic
      const spidaOwner = normalizedSpidaOwner !== 'unknown' ? normalizedSpidaOwner : ownerFromEquipmentType(spidaType);
      const katapultOwner = normalizedKatapultOwner !== 'unknown' ? normalizedKatapultOwner : ownerFromEquipmentType(katapultType);
      
      // Fix 3: Relax owner match for guys & comm-drops
      const spidaMappedTypeForOwner = mapEquipmentType(spidaType);
      const ownerSensitive = !['guy', 'communication_service'].includes(spidaMappedTypeForOwner);
      
      const sameOwner = 
        ownerSensitive
          ? (katapultOwner !== 'unknown' && spidaOwner !== 'unknown' ? spidaOwner === katapultOwner : true)
          : true; // ignore owner mismatch for guys & drops

      if (!sameOwner) return;

      /*
        Condition 1 ──────
        Exact insulator-to-insulator match (highest priority)
        This is the preferred match since Katapult wire heights = SPIDA insulator heights
      */
      const isInsulatorToInsulatorMatch = 
        spidaType.includes('insulator') && katapultType.includes('insulator');

      /*
        Condition 2 ──────
        Direct type match for non-insulators (wires, guys, equipment)
        Enhanced with equipment type mapping
      */
      const spidaMappedType = mapEquipmentType(spidaType);
      const katapultMappedType = mapEquipmentType(katapultType);
      
      const isDirectNonInsulatorMatch = 
        !spidaType.includes('insulator') && 
        (spidaType.includes(katapultType) || 
         katapultType.includes(spidaType) ||
         spidaMappedType === katapultMappedType);

      /*
        Condition 3 ──────
        Legacy fallback: SPIDA insulator to Katapult wire (lower priority)
        Only used when no synthetic insulator is available
      */
      const isInsulatorToWireMatch =
        spidaType.includes('insulator') &&
        !katapultType.includes('insulator') &&
        (katapultType.includes('wire') ||
          katapultType.includes('cable') ||
          katapultType.includes('primary') ||
          katapultType.includes('neutral'));

      let matchPriority = 0;
      let isValidMatch = false;

      if (isInsulatorToInsulatorMatch) {
        matchPriority = 3; // Highest priority
        isValidMatch = true;
      } else if (isDirectNonInsulatorMatch) {
        matchPriority = 2; // Medium priority
        isValidMatch = true;
      } else if (isInsulatorToWireMatch) {
        matchPriority = 1; // Lowest priority
        isValidMatch = true;
      }

      if (isValidMatch) {
        const heightDifference = Math.abs(spidaAttachment.height - katapultAttachment.height);

        // Fix 4: Dynamic height tolerance for communication services
        const spidaMappedTypeForTolerance = mapEquipmentType(spidaType);
        const heightTolerance = spidaMappedTypeForTolerance === 'communication_service' ? 1.0 : 0.5; // feet (converted from meters: 0.3 vs 0.15)

        // Track the closest match within dynamic tolerance, with priority weighting
        const weightedDifference = heightDifference - (matchPriority * 0.1); // Slight priority boost
        
        if (heightDifference < heightTolerance && weightedDifference < smallestDifference) {
          smallestDifference = weightedDifference;
          bestMatch = katapultAttachment;
        }
      }
    });

    return bestMatch;
  };

  // Sort all attachments by height (highest first) - pole tops will naturally be first since they're tallest
  const prioritizedSpidaAttachments = [...spidaAttachments]
    .sort((a, b) => b.height - a.height);

  // Create comparison rows and group by insulator
  const compRows: CompRow[] = prioritizedSpidaAttachments
    .map((spida) => ({ spida, kat: findMatchingAttachment(spida) }));

  // Remove duplicate wires and group by insulators
  const filteredRows = removeDuplicateWires(compRows);
  const groupedRows = groupByInsulator(compRows);
  const ungroupedRows = filteredRows
    .filter(r => !r.spida?.type.toLowerCase().includes('insulator'));

  // Create unified items array for proper height-based sorting
  const allItems: Array<{ type: 'grouped' | 'ungrouped', height: number, data: any, index: number }> = [];
  
  // Add grouped items (use parent insulator height for sorting)
  groupedRows.forEach((group, idx) => {
    allItems.push({
      type: 'grouped',
      height: group.parent.height,
      data: group,
      index: idx
    });
  });
  
  // Add ungrouped items (use attachment height for sorting)
  ungroupedRows.forEach((row, idx) => {
    const height = row.spida?.height || 0;
    allItems.push({
      type: 'ungrouped',
      height: height,
      data: row,
      index: idx
    });
  });
  
  // Sort all items by height (highest first)
  const sortedItems = allItems.sort((a, b) => b.height - a.height);

  const DeltaCell: React.FC<{ spida: Attachment; kat: Attachment | null }> = ({ spida, kat }) => {
    if (!kat) return <span className="text-slate-400 text-xs">N/A</span>;
    
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
          <th style={{...styles.thCondensed, textAlign: 'center'}}>SPIDA Height</th>
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
              <React.Fragment key={group.parent.id || `group-${item.index}`}>
                {/* Parent insulator row */}
                <tr className="bg-slate-800 text-white group-odd:bg-slate-800/80">
                  <td style={styles.tdParent}>
                    <div style={{ fontWeight: 600, color: '#d1d5db' }}>
                      {group.parent.owner} ‒ {group.parent.description}
                    </div>
                  </td>
                  <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                    {formatHeightFtIn(group.parent.height)}
                  </td>
                  <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                    {group.kat ? (
                      <div style={{ 
                        opacity: group.kat.synthetic ? 0.7 : 1, 
                        fontStyle: group.kat.synthetic ? 'italic' : 'normal' 
                      }}>
                        {formatHeightFtIn(group.kat.height)}
                        {group.kat.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                      </div>
                    ) : (
                      <span style={{ color: '#718096' }}>No match</span>
                    )}
                  </td>
                  <td style={{ ...styles.tdParent, textAlign: 'center' }}>
                    <DeltaCell spida={group.parent} kat={group.kat} />
                  </td>
                </tr>

                {/* Child wires row */}
                {group.wires.length > 0 && (
                  <tr className="bg-slate-900/80 text-slate-300">
                    <td colSpan={4} style={{ ...styles.tdChild, paddingLeft: '2.5rem', paddingTop: '0.375rem', paddingBottom: '0.375rem' }}>
                      <ul style={{ listStyleType: 'disc', marginLeft: '1rem', margin: 0, padding: 0 }}>
                        {group.wires.map((wire: Attachment, wireIdx: number) => (
                          <li key={wire.id || `wire-${wireIdx}`} style={{ marginBottom: '0.125rem' }}>
                            <span className="inline-block px-1 rounded bg-slate-600/40 text-slate-200 text-[10px] mr-2">{wire.owner}</span>
                            {wire.description || wire.type}
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
            const { spida, kat } = item.data;
            return (
              <tr
                key={spida?.id || `ungrouped-${item.index}`}
                className={`${globalIdx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} text-white`}
              >
                {/* SPIDA attachment cell */}
                <td style={styles.td}>
                  {spida && (
                    <div style={{ fontWeight: 500, color: '#a0aec0' }}>
                      {spida.owner} ‒ {spida.description}
                    </div>
                  )}
                </td>

                {/* SPIDA height */}
                <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                  {spida && formatHeightFtIn(spida.height)}
                </td>

                {/* Katapult height / info */}
                <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                  {kat ? (
                    <div style={{ 
                      opacity: kat.synthetic ? 0.7 : 1, 
                      fontStyle: kat.synthetic ? 'italic' : 'normal' 
                    }}>
                      <div style={{ fontWeight: 600 }}>
                        {formatHeightFtIn(kat.height)}
                        {kat.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                      </div>
                      <small style={{ color: '#a0aec0' }}>
                        {kat.owner} ‒ {kat.description}
                      </small>
                    </div>
                  ) : (
                    <span style={{ color: '#718096' }}>No match found</span>
                  )}
                </td>

                {/* Difference */}
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  {spida && <DeltaCell spida={spida} kat={kat} />}
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

export default ComparisonTable; 