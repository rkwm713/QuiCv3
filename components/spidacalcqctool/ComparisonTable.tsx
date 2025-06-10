import React from 'react';
import { Attachment } from './types';
import { formatHeightFtIn } from './comparisonHelpers';

interface ComparisonTableProps {
  spidaAttachments: Attachment[];
  katapultAttachments: Attachment[];
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

  // Sort all attachments by height (highest first)
  const sortedSpidaAttachments = [...spidaAttachments]
    .sort((a, b) => b.height - a.height);

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
        {sortedSpidaAttachments.map((spida, idx) => {
          const kat = findMatchingAttachment(spida);
          
          return (
            <tr
              key={spida?.id || `spida-${idx}`}
              className={`${idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} text-white`}
            >
              {/* SPIDA attachment cell */}
              <td style={styles.td}>
                <div style={{ fontWeight: 500, color: '#a0aec0' }}>
                  {spida.owner} ‒ {spida.description}
                </div>
              </td>

              {/* SPIDA height */}
              <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                {formatHeightFtIn(spida.height)}
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
                <DeltaCell spida={spida} kat={kat} />
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
};

export default ComparisonTable; 