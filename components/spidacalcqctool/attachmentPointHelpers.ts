// Attachment Point normalization helpers
// Implements the strategy to converge SPIDA and Katapult data to a common "Attachment Point" model

import { Attachment, AttachmentPoint, WireGroup, AttachmentPointComparison } from './types';
import { buildArmMaps, getInsulatorArmId, getArmGroundHeight } from './armHelpers';

// Height tolerance for grouping wires (±0.05m ≈ 2 inches, ±0.1m for staggered builds)
const GROUPING_TOLERANCE_M = 0.05;
const STAGGERED_TOLERANCE_M = 0.1;

// Owner aliases for normalization
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

// Normalize owner strings for consistent matching
const normalizeOwner = (owner: string): string => {
  const key = owner.toLowerCase().replace(/[^a-z]/g, '');
  return OWNER_ALIASES[key] || key;
};

// Create a stable hash for grouping key
const hashGroupKey = (key: string): string => {
  // Simple hash function for consistent IDs
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
};

// Extract wire type/phase for grouping
const getWirePhase = (wire: Attachment): string => {
  const type = wire.type.toLowerCase();
  const description = wire.description.toLowerCase();
  
  // Try to extract phase information
  if (type.includes('primary') || description.includes('primary')) return 'primary';
  if (type.includes('neutral') || description.includes('neutral')) return 'neutral';
  if (type.includes('secondary') || description.includes('secondary')) return 'secondary';
  if (type.includes('service') || description.includes('service')) return 'service';
  if (type.includes('communication') || description.includes('comm')) return 'communication';
  
  // Fall back to the wire type itself
  return wire.type;
};

/**
 * Build SPIDA attachment points from insulator data
 * Rule: One Attachment Point per insulator ID
 * Height = insulator height unless on cross-arm (then use cross-arm height)
 */
export const buildSpidaAttachmentPoints = (
  structure: any,
  poleScid: string
): AttachmentPoint[] => {
  const points: AttachmentPoint[] = [];
  
  if (!structure.insulators) return points;
  
  // Build cross-arm maps for height calculations
  const armMaps = buildArmMaps(structure);
  
  structure.insulators.forEach((insulator: any) => {
    const armId = getInsulatorArmId(insulator.id, armMaps);
    let height: number;
    
    if (armId) {
      // Cross-arm mounted - use cross-arm height (insulator drop already encoded)
      height = getArmGroundHeight(armId, armMaps)!;
    } else {
      // Pole-top or other mounting - use insulator's absolute height
      const rawHeight = insulator.offset?.value ?? insulator.attachmentHeight?.value ?? 0;
      const unit = (insulator.attachmentHeight?.unit ?? insulator.offset?.unit ?? 'METRE') as 'METRE' | 'FEET' | 'INCH';
      height = toMetres(rawHeight, unit);
    }
    
    // Get wire IDs attached to this insulator
    const wires = Array.isArray(insulator.wires) ? [...insulator.wires] : [];
    
    points.push({
      id: insulator.id,
      source: 'spida',
      owner: normalizeOwner(insulator.owner?.id || 'unknown'),
      description: insulator.clientItem || 'Insulator',
      height: height,
      wires: wires,
      synthetic: false,
      poleScid: poleScid,
      originalData: insulator
    });
  });
  
  return points;
};

/**
 * Build Katapult attachment points from wire data
 * Rule: Group wires by owner + phase/size + height (±tolerance)
 * Create synthetic attachment points for groups without explicit insulators
 */
export const buildKatapultAttachmentPoints = (
  wires: Attachment[],
  poleScid: string,
  existingInsulators: Attachment[] = []
): AttachmentPoint[] => {
  const points: AttachmentPoint[] = [];
  
  // First, handle any existing explicit insulators from Katapult
  existingInsulators.forEach(insulator => {
    if (insulator.type.toLowerCase().includes('insulator') && !insulator.synthetic) {
      points.push({
        id: insulator.id || `kat-ins-${points.length}`,
        source: 'katapult',
        owner: normalizeOwner(insulator.owner),
        description: insulator.description,
        height: insulator.height,
        wires: [], // Will be populated by wire analysis
        synthetic: false,
        poleScid: poleScid,
        originalData: insulator
      });
    }
  });
  
  // Filter out wires that should not be grouped (equipment, guys, etc.)
  const groupableWires = wires.filter(wire => {
    const type = wire.type.toLowerCase();
    
    // Skip guys, equipment, pole tops
    if (type.includes('guy') || type.includes('equipment') || type.includes('pole top')) {
      return false;
    }
    
    // Skip obvious equipment types
    if (type.includes('transformer') || type.includes('light') || type.includes('riser')) {
      return false;
    }
    
    // Include wires, cables, and services
    return type.includes('wire') || type.includes('cable') || type.includes('primary') || 
           type.includes('neutral') || type.includes('secondary') || type.includes('service') ||
           type.includes('communication') || type.includes('comm');
  });
  
  // Group wires by owner + phase + height
  const groups = new Map<string, WireGroup>();
  
  groupableWires.forEach(wire => {
    const owner = normalizeOwner(wire.owner);
    const phase = getWirePhase(wire);
    const heightRounded = Math.round(wire.height * 100) / 100; // Round to cm
    
    // Create grouping key
    const baseKey = `${poleScid}|${owner}|${phase}|${heightRounded}`;
    
    // Try to find existing group within tolerance
    let matchedKey: string | null = null;
    for (const [existingKey, group] of groups) {
      if (group.owner === owner && getWirePhase(group.wires[0]) === phase) {
        const heightDiff = Math.abs(group.height - wire.height);
        const tolerance = (phase === 'primary' && group.wires.length === 1) ? 
          STAGGERED_TOLERANCE_M : GROUPING_TOLERANCE_M;
        
        if (heightDiff <= tolerance) {
          matchedKey = existingKey;
          break;
        }
      }
    }
    
    if (matchedKey) {
      // Add to existing group
      groups.get(matchedKey)!.wires.push(wire);
    } else {
      // Create new group
      groups.set(baseKey, {
        key: baseKey,
        owner: owner,
        height: wire.height,
        wires: [wire],
        hasInsulator: false // Will check against existing insulators
      });
    }
  });
  
  // Check if groups have existing insulators
  groups.forEach(group => {
    const hasExistingInsulator = points.some(point => {
      return point.owner === group.owner && 
             Math.abs(point.height - group.height) <= GROUPING_TOLERANCE_M;
    });
    group.hasInsulator = hasExistingInsulator;
  });
  
  // Create synthetic attachment points for groups without insulators
  groups.forEach(group => {
    if (!group.hasInsulator) {
      const firstWire = group.wires[0];
      const syntheticId = `kat-${hashGroupKey(group.key)}`;
      
      points.push({
        id: syntheticId,
        source: 'katapult',
        owner: group.owner,
        description: `Synthetic – ${firstWire.type}`,
        height: group.height,
        wires: group.wires.map(w => w.id || ''),
        synthetic: true,
        poleScid: poleScid,
        originalData: { groupedWires: group.wires }
      });
    } else {
      // Add wires to existing insulator point
      const existingPoint = points.find(point => 
        point.owner === group.owner && 
        Math.abs(point.height - group.height) <= GROUPING_TOLERANCE_M
      );
      if (existingPoint) {
        existingPoint.wires.push(...group.wires.map(w => w.id || ''));
      }
    }
  });
  
  return points;
};

/**
 * Compare SPIDA and Katapult attachment points
 * Returns normalized comparison results
 */
export const compareAttachmentPoints = (
  spidaPoints: AttachmentPoint[],
  katapultPoints: AttachmentPoint[]
): AttachmentPointComparison[] => {
  const comparisons: AttachmentPointComparison[] = [];
  const matchedKatapultIds = new Set<string>();
  
  // Round height to inches for indexing (more forgiving than exact matching)
  const roundToInches = (height: number): number => {
    return Math.round(height * 39.3701); // Convert to inches and round
  };
  
  // Index Katapult points by (owner, height_inches, description)
  const katapultIndex = new Map<string, AttachmentPoint>();
  katapultPoints.forEach(point => {
    const key = `${point.owner}|${roundToInches(point.height)}|${point.description}`;
    katapultIndex.set(key, point);
  });
  
  // Find matches for SPIDA points
  spidaPoints.forEach(spidaPoint => {
    const key = `${spidaPoint.owner}|${roundToInches(spidaPoint.height)}|${spidaPoint.description}`;
    const exactMatch = katapultIndex.get(key);
    
    if (exactMatch) {
      // Exact match found
      comparisons.push({
        spidaPoint: spidaPoint,
        katapultPoint: exactMatch,
        matchType: 'exact',
        heightDifference: Math.abs(spidaPoint.height - exactMatch.height)
      });
      matchedKatapultIds.add(exactMatch.id);
    } else {
      // Try height-only matching with tolerance
      const heightMatch = katapultPoints.find(katPoint => {
        return katPoint.owner === spidaPoint.owner &&
               Math.abs(katPoint.height - spidaPoint.height) <= GROUPING_TOLERANCE_M &&
               !matchedKatapultIds.has(katPoint.id);
      });
      
      if (heightMatch) {
        comparisons.push({
          spidaPoint: spidaPoint,
          katapultPoint: heightMatch,
          matchType: 'height-only',
          heightDifference: Math.abs(spidaPoint.height - heightMatch.height)
        });
        matchedKatapultIds.add(heightMatch.id);
      } else {
        // No match found
        comparisons.push({
          spidaPoint: spidaPoint,
          katapultPoint: null,
          matchType: 'spida-only',
          heightDifference: undefined
        });
      }
    }
  });
  
  // Add unmatched Katapult points
  katapultPoints.forEach(katapultPoint => {
    if (!matchedKatapultIds.has(katapultPoint.id)) {
      comparisons.push({
        spidaPoint: null,
        katapultPoint: katapultPoint,
        matchType: 'katapult-only',
        heightDifference: undefined
      });
    }
  });
  
  return comparisons;
};

// Unit conversion helper (matches the one in SpidaQcTool)
const toMetres = (val: number, unit: 'METRE' | 'FEET' | 'INCH'): number => {
  if (unit === 'METRE') return val;
  if (unit === 'FEET') return val * 0.3048;
  return val * 0.0254; // INCH
}; 