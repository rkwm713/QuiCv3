import React from 'react';
import { Attachment } from './types';
import { formatHeightFtIn } from './comparisonHelpers';
import { sortWithCrossArmHierarchy, isFirstInsulatorOnCrossArm } from './crossArmSorting';

interface ComparisonTableProps {
  spidaAttachments: Attachment[];
  katapultAttachments: Attachment[];
}

interface GroupedInsulator {
  insulator: Attachment;
  katMatch: Attachment | null;
  wires: Array<{ wire: Attachment; katMatch: Attachment | null }>;
}

// Owner aliases for better matching
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

// Helper to map equipment types for better matching
const mapEquipmentType = (type: string): string => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('communication') || lowerType.includes('comm') || lowerType.includes('service') || lowerType.includes('drop')) return 'communication_service';
  if (lowerType.includes('drip') || lowerType.includes('loop')) return 'drip_loop';
  if (lowerType.includes('guy')) return 'guy';
  if (lowerType.includes('street') && lowerType.includes('light')) return 'street_light';
  if (lowerType.includes('transformer')) return 'transformer';
  return lowerType;
};

// Fallback owner heuristics for equipment types
const ownerFromEquipmentType = (equipmentType: string): string => {
  const lowerType = equipmentType.toLowerCase();
  if (lowerType.includes('drip') || lowerType.includes('loop')) return 'cps';
  if (lowerType.includes('communication') || lowerType.includes('service') || lowerType.includes('comm')) return 'charter';
  if (lowerType.includes('street') || lowerType.includes('light')) return 'city';
  if (lowerType.includes('guy') || lowerType.includes('guying')) return 'cps';
  return 'unknown';
};

const ComparisonTable: React.FC<ComparisonTableProps> = ({
  spidaAttachments,
  katapultAttachments,
}) => {
  // Helper that finds the best‐matching Katapult attachment for a given SPIDA attachment
  const findMatchingAttachment = (spidaAttachment: Attachment): Attachment | null => {
    let bestMatch: Attachment | null = null;
    let smallestDifference = Infinity;

    katapultAttachments.forEach((katapultAttachment) => {
      const spidaType = spidaAttachment.type.toLowerCase();
      const katapultType = katapultAttachment.type.toLowerCase();

      // Normalize owner names for flexible comparison
      const normalizedSpidaOwner = normalizeOwner(spidaAttachment.owner);
      const normalizedKatapultOwner = normalizeOwner(katapultAttachment.owner);

      // Allow pass-through when either side is 'Unknown' (missing owner data)
      const spidaOwner = normalizedSpidaOwner !== 'unknown' ? normalizedSpidaOwner : ownerFromEquipmentType(spidaType);
      const katapultOwner = normalizedKatapultOwner !== 'unknown' ? normalizedKatapultOwner : ownerFromEquipmentType(katapultType);
      
      // Relax owner match for guys & comm-drops
      const spidaMappedTypeForOwner = mapEquipmentType(spidaType);
      const ownerSensitive = !['guy', 'communication_service'].includes(spidaMappedTypeForOwner);
      
      const sameOwner = 
        ownerSensitive
          ? (katapultOwner !== 'unknown' && spidaOwner !== 'unknown' ? spidaOwner === katapultOwner : true)
          : true;

      if (!sameOwner) return;

      // Exact insulator-to-insulator match (highest priority)
      const isInsulatorToInsulatorMatch = 
        spidaType.includes('insulator') && katapultType.includes('insulator');

      // Direct type match for non-insulators
      const spidaMappedType = mapEquipmentType(spidaType);
      const katapultMappedType = mapEquipmentType(katapultType);
      
      const isDirectNonInsulatorMatch = 
        !spidaType.includes('insulator') && 
        (spidaType.includes(katapultType) || 
         katapultType.includes(spidaType) ||
         spidaMappedType === katapultMappedType);

      // Legacy fallback: SPIDA insulator to Katapult wire
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
        matchPriority = 3;
        isValidMatch = true;
      } else if (isDirectNonInsulatorMatch) {
        matchPriority = 2;
        isValidMatch = true;
      } else if (isInsulatorToWireMatch) {
        matchPriority = 1;
        isValidMatch = true;
      }

      if (isValidMatch) {
        const heightDifference = Math.abs(spidaAttachment.height - katapultAttachment.height);

        // Dynamic height tolerance for communication services
        const spidaMappedTypeForTolerance = mapEquipmentType(spidaType);
        const heightTolerance = spidaMappedTypeForTolerance === 'communication_service' ? 1.0 : 0.5;

        const weightedDifference = heightDifference - (matchPriority * 0.1);
        
        if (heightDifference < heightTolerance && weightedDifference < smallestDifference) {
          smallestDifference = weightedDifference;
          bestMatch = katapultAttachment;
        }
      }
    });

    return bestMatch;
  };

  // Group wires under their parent insulators with cross-arm hierarchy
  const groupAttachments = () => {
    const insulators: GroupedInsulator[] = [];
    const ungroupedAttachments: Array<{ attachment: Attachment; katMatch: Attachment | null }> = [];

    // Use cross-arm hierarchy sorting for proper display order
    const sortedSpidaAttachments = sortWithCrossArmHierarchy(spidaAttachments);

    // Process attachments in their hierarchy-sorted order
    sortedSpidaAttachments.forEach(attachment => {
      if (attachment.type.toLowerCase().includes('insulator') && !attachment.type.toLowerCase().includes('cross-arm')) {
        // This is a regular insulator - group it with its wires
        const katMatch = findMatchingAttachment(attachment);
        
        // Find wires connected to this insulator
        const connectedWires = spidaAttachments
          .filter(att => att.parentInsulatorId === attachment.id)
          .sort((a, b) => b.height - a.height) // Sort wires by height too
          .map(wire => ({
            wire,
            katMatch: findMatchingAttachment(wire)
          }));

        insulators.push({
          insulator: attachment,
          katMatch,
          wires: connectedWires
        });
      } else if (!attachment.parentInsulatorId) {
        // This is an ungrouped attachment (cross-arms, guys, equipment, etc.)
        ungroupedAttachments.push({
          attachment,
          katMatch: findMatchingAttachment(attachment)
        });
      }
      // Skip wires that are connected to insulators (they're handled in the insulator grouping above)
    });

    return { insulators, ungroupedAttachments };
  };

  const { insulators, ungroupedAttachments } = groupAttachments();
  
  // Create a merged and ordered list for rendering
  const createOrderedRenderList = () => {
    const sortedSpidaAttachments = sortWithCrossArmHierarchy(spidaAttachments);
    const renderItems: Array<{ type: 'insulator' | 'ungrouped'; data: any }> = [];
    
    sortedSpidaAttachments.forEach(attachment => {
      if (attachment.type.toLowerCase().includes('insulator') && !attachment.type.toLowerCase().includes('cross-arm')) {
        // Find the corresponding insulator group
        const insulatorGroup = insulators.find(ins => ins.insulator.id === attachment.id);
        if (insulatorGroup) {
          renderItems.push({ type: 'insulator', data: insulatorGroup });
        }
      } else if (!attachment.parentInsulatorId) {
        // Find the corresponding ungrouped attachment
        const ungroupedItem = ungroupedAttachments.find(ung => ung.attachment.id === attachment.id);
        if (ungroupedItem) {
          renderItems.push({ type: 'ungrouped', data: ungroupedItem });
        }
      }
    });
    
    return renderItems;
  };
  
  const orderedRenderList = createOrderedRenderList();

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
        {/* Render attachments in hierarchy-sorted order */}
        {orderedRenderList.map((item, idx) => {
          if (item.type === 'insulator') {
            const group = item.data as GroupedInsulator;
            return (
              <React.Fragment key={group.insulator.id || `insulator-group-${idx}`}>
                {/* Insulator parent row */}
                <tr className="bg-slate-800 text-white">
                  <td style={styles.tdParent}>
                    <div style={{ fontWeight: 600, color: '#d1d5db' }}>
                      📍 {group.insulator.owner} ‒ {group.insulator.description}
                      {group.insulator.parentCrossArmId && (
                        <span style={{ color: '#f59e0b', fontSize: '0.8em', marginLeft: '8px' }}>
                          (on cross-arm {group.insulator.parentCrossArmId})
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                    {formatHeightFtIn(group.insulator.height)}
                  </td>
                  <td style={{ ...styles.tdParent, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                    {group.katMatch ? (
                      <div style={{ 
                        opacity: group.katMatch.synthetic ? 0.7 : 1, 
                        fontStyle: group.katMatch.synthetic ? 'italic' : 'normal' 
                      }}>
                        <div style={{ fontWeight: 600 }}>
                          {formatHeightFtIn(group.katMatch.height)}
                          {group.katMatch.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                        </div>
                        <small style={{ color: '#a0aec0' }}>
                          {group.katMatch.owner} ‒ {group.katMatch.description}
                        </small>
                      </div>
                    ) : (
                      <span style={{ color: '#718096' }}>No match found</span>
                    )}
                  </td>
                  <td style={{ ...styles.tdParent, textAlign: 'center' }}>
                    <DeltaCell spida={group.insulator} kat={group.katMatch} />
                  </td>
                </tr>

                {/* Connected wires as child rows */}
                {group.wires.map((wireGroup, wireIdx) => (
                  <tr
                    key={wireGroup.wire.id || `wire-${wireIdx}`}
                    className="bg-slate-900/80 text-slate-300"
                  >
                    <td style={{ ...styles.tdChild, paddingLeft: '2rem' }}>
                      <div style={{ fontWeight: 400, color: '#a0aec0' }}>
                        🔌 {wireGroup.wire.owner} ‒ {wireGroup.wire.description}
                      </div>
                    </td>
                    <td style={{ ...styles.tdChild, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2em', fontWeight: 500 }}>
                      {formatHeightFtIn(wireGroup.wire.height)}
                    </td>
                    <td style={{ ...styles.tdChild, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2em', fontWeight: 500 }}>
                      {wireGroup.katMatch ? (
                        <div style={{ 
                          opacity: wireGroup.katMatch.synthetic ? 0.7 : 1, 
                          fontStyle: wireGroup.katMatch.synthetic ? 'italic' : 'normal' 
                        }}>
                          <div style={{ fontWeight: 500 }}>
                            {formatHeightFtIn(wireGroup.katMatch.height)}
                            {wireGroup.katMatch.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                          </div>
                          <small style={{ color: '#a0aec0' }}>
                            {wireGroup.katMatch.owner} ‒ {wireGroup.katMatch.description}
                          </small>
                        </div>
                      ) : (
                        <span style={{ color: '#718096' }}>No match found</span>
                      )}
                    </td>
                    <td style={{ ...styles.tdChild, textAlign: 'center' }}>
                      <DeltaCell spida={wireGroup.wire} kat={wireGroup.katMatch} />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          } else {
            // Ungrouped attachment (including cross-arms)
            const ungroupedItem = item.data as { attachment: Attachment; katMatch: Attachment | null };
            const isCrossArm = ungroupedItem.attachment.type.toLowerCase().includes('cross-arm');
            
            return (
              <tr
                key={ungroupedItem.attachment.id || `ungrouped-${idx}`}
                className={`${idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} text-white`}
              >
                <td style={styles.td}>
                  <div style={{ fontWeight: 500, color: '#a0aec0' }}>
                    {isCrossArm ? '🔧 ' : ''}{ungroupedItem.attachment.owner} ‒ {ungroupedItem.attachment.description}
                  </div>
                </td>
                <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                  {formatHeightFtIn(ungroupedItem.attachment.height)}
                </td>
                <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                  {ungroupedItem.katMatch ? (
                    <div style={{ 
                      opacity: ungroupedItem.katMatch.synthetic ? 0.7 : 1, 
                      fontStyle: ungroupedItem.katMatch.synthetic ? 'italic' : 'normal' 
                    }}>
                      <div style={{ fontWeight: 600 }}>
                        {formatHeightFtIn(ungroupedItem.katMatch.height)}
                        {ungroupedItem.katMatch.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
                      </div>
                      <small style={{ color: '#a0aec0' }}>
                        {ungroupedItem.katMatch.owner} ‒ {ungroupedItem.katMatch.description}
                      </small>
                    </div>
                  ) : (
                    <span style={{ color: '#718096' }}>No match found</span>
                  )}
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <DeltaCell spida={ungroupedItem.attachment} kat={ungroupedItem.katMatch} />
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

export default ComparisonTable; 