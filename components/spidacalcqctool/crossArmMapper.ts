// Enhanced Cross-arm Mapper for SPIDA vs Katapult QC
// Implements hierarchical SPIDA mapping and height-based Katapult clustering

export interface CrossArmWiring {
  system: 'SPIDA' | 'Katapult';
  crossArmId: string;
  crossArmHt: number;           // Height in feet for consistent display
  insulatorId: string | null;   // null for Katapult pseudo-arms
  wireId: string;
  wireType?: string;
  wireOwner?: string;
  originalData?: any;           // Reference to original object
}

export interface CrossArmGroup {
  armId: string;
  armHeight: number;            // feet
  system: 'SPIDA' | 'Katapult';
  wires: CrossArmWiring[];
  isPseudo?: boolean;           // true for Katapult pseudo-arms
}

// Katapult standard height bands (from anchor calibration)
const K_TX_BANDS_FT = [16.5, 14.5, 10.5, 6.5, 2.5];
const BAND_TOL_FT = 0.25; // +/-3" snap window

// Unit conversion helpers
const metersToFeet = (m: number): number => m * 3.28084;
const feetToMeters = (ft: number): number => ft * 0.3048;
const inchesToFeet = (inches: number): number => inches / 12;

/**
 * Snap any raw height to the nearest Katapult standard band
 */
const snapToHeightBand = (heightFt: number): number => {
  const nearestBand = K_TX_BANDS_FT.find(band => 
    Math.abs(band - heightFt) <= BAND_TOL_FT
  );
  return nearestBand ?? heightFt;
};

/**
 * Extract SPIDA cross-arm wiring with full hierarchy
 */
export const extractSpidaCrossArmWiring = (structure: any): CrossArmWiring[] => {
  const wiringTable: CrossArmWiring[] = [];
  
  if (!structure) {
    console.warn('🔧 No structure data provided to extractSpidaCrossArmWiring');
    return wiringTable;
  }
  
  if (!structure.crossArms || !Array.isArray(structure.crossArms) || structure.crossArms.length === 0) {
    console.log('🔧 No cross-arms found in SPIDA structure');
    return wiringTable;
  }
  
  if (!structure.insulators || !Array.isArray(structure.insulators)) {
    console.warn('🔧 No insulators array found in SPIDA structure');
    return wiringTable;
  }
  
  if (!structure.wires || !Array.isArray(structure.wires)) {
    console.warn('🔧 No wires array found in SPIDA structure');
    return wiringTable;
  }
  
  // Build lookup maps
  const armById = Object.fromEntries(structure.crossArms.map((a: any) => [a.id, a]));
  const insById = Object.fromEntries(structure.insulators.map((i: any) => [i.id, i]));
  const wireById = Object.fromEntries(structure.wires.map((w: any) => [w.id, w]));
  
  for (const arm of structure.crossArms) {
    try {
      if (!arm.id) {
        console.warn('🔧 Cross-arm missing ID, skipping');
        continue;
      }
      
      // Get cross-arm height (prefer attachmentHeight, fallback to offset)
      const rawHeight = arm.attachmentHeight?.value ?? arm.offset?.value ?? 0;
      const unit = arm.attachmentHeight?.unit ?? arm.offset?.unit ?? 'METRE';
      const armHeightFt = unit === 'METRE' ? metersToFeet(rawHeight) : 
                         unit === 'FEET' ? rawHeight : 
                         inchesToFeet(rawHeight);
      
      if (rawHeight === 0) {
        console.warn(`🔧 Cross-arm ${arm.id} has zero height, may indicate missing height data`);
      }
      
      console.log(`🔧 Processing SPIDA cross-arm ${arm.id} at ${armHeightFt.toFixed(1)}ft (raw: ${rawHeight}, unit: ${unit})`);
      
      // Process insulators on this arm
      if (arm.insulators && Array.isArray(arm.insulators)) {
        for (const insId of arm.insulators) {
          const insulator = insById[insId];
          if (!insulator) {
            console.warn(`🔧 Insulator ${insId} referenced by cross-arm ${arm.id} not found`);
            continue;
          }
          
          // Process wires on this insulator
          if (insulator.wires && Array.isArray(insulator.wires)) {
            for (const wireId of insulator.wires) {
              const wire = wireById[wireId];
              if (!wire) {
                console.warn(`🔧 Wire ${wireId} referenced by insulator ${insId} not found`);
                continue;
              }
              
              wiringTable.push({
                system: 'SPIDA',
                crossArmId: arm.id,
                crossArmHt: armHeightFt,
                insulatorId: insId,
                wireId: wireId,
                wireType: wire.usageGroup || wire.type || 'Wire',
                wireOwner: wire.owner?.id || 'Unknown',
                originalData: { arm, insulator, wire }
              });
            }
          } else {
            console.log(`🔧 Insulator ${insId} on cross-arm ${arm.id} has no wires`);
          }
        }
      } else {
        console.log(`🔧 Cross-arm ${arm.id} has no insulators`);
      }
    } catch (error) {
      console.error(`🔧 Error processing cross-arm ${arm.id}:`, error);
    }
  }
  
  console.log(`🔧 Extracted ${wiringTable.length} SPIDA cross-arm wiring entries`);
  return wiringTable;
};

/**
 * Extract Katapult wiring and create pseudo cross-arms by height clustering
 */
export const extractKatapultCrossArmWiring = (
  katapultData: any, 
  poleTag: string,
  traceData: any
): CrossArmWiring[] => {
  const wiringTable: CrossArmWiring[] = [];
  
  if (!katapultData.nodes || !katapultData.photos) {
    return wiringTable;
  }
  
  // Find the node for this pole
  const node = Object.values(katapultData.nodes).find((n: any) => {
    const rawPoleTag = n.attributes.electric_pole_tag?.assessment ??
                      (Object.values(n.attributes.pole_tag ?? {}) as any)[0]?.tagtext ??
                      n.attributes.scid?.auto_button ?? '';
    return extractPoleTag(rawPoleTag) === poleTag;
  }) as any;
  
  if (!node || !node.photos) {
    return wiringTable;
  }
  
  // Collect all wires from all main photos
  const allWires: Array<{
    id: string;
    heightFt: number;
    traceId: string;
    type: string;
    owner: string;
  }> = [];
  
  // Find main photos
  const mainPhotoIds = Object.keys(node.photos).filter((photoId) => {
    const photo = node.photos?.[photoId];
    const assoc = photo?.association as any;
    return assoc === 'main' || assoc === true ||
           !!katapultData.photos?.[photoId]?.photofirst_data;
  });
  
  for (const photoId of mainPhotoIds) {
    const photoData = katapultData.photos[photoId]?.photofirst_data;
    if (!photoData?.wire) continue;
    
    Object.entries(photoData.wire).forEach(([wireId, wireData]: [string, any]) => {
      if (!wireData._measured_height || !wireData._trace) return;
      
      const trace = traceData[wireData._trace];
      if (!trace) return;
      
      // Convert height to feet and snap to band
      const rawHeightFt = inchesToFeet(wireData._measured_height);
      const snappedHeightFt = snapToHeightBand(rawHeightFt);
      
      allWires.push({
        id: wireId,
        heightFt: snappedHeightFt,
        traceId: wireData._trace,
        type: trace.cable_type || trace._trace_type || 'Wire',
        owner: trace.company || 'Unknown'
      });
    });
  }
  
  // Group wires by height band to create pseudo cross-arms
  const heightBuckets = new Map<number, typeof allWires>();
  
  for (const wire of allWires) {
    if (!heightBuckets.has(wire.heightFt)) {
      heightBuckets.set(wire.heightFt, []);
    }
    heightBuckets.get(wire.heightFt)!.push(wire);
  }
  
  // Create pseudo cross-arms for each height band
  let pseudoArmId = 1;
  
  for (const [heightFt, wires] of heightBuckets) {
    const pseudoArmIdStr = `KArm#${pseudoArmId}@${heightFt}ft`;
    
    console.log(`🔧 Creating Katapult pseudo cross-arm ${pseudoArmIdStr} with ${wires.length} wires`);
    
    for (const wire of wires) {
      wiringTable.push({
        system: 'Katapult',
        crossArmId: pseudoArmIdStr,
        crossArmHt: heightFt,
        insulatorId: null, // Katapult has no explicit insulators
        wireId: wire.id,
        wireType: wire.type,
        wireOwner: wire.owner,
        originalData: { wire, pseudoArm: true }
      });
    }
    
    pseudoArmId++;
  }
  
  console.log(`🔧 Extracted ${wiringTable.length} Katapult cross-arm wiring entries from ${heightBuckets.size} pseudo cross-arms`);
  return wiringTable;
};

/**
 * Group wiring entries by cross-arm for display
 */
export const groupWiringByCrossArm = (
  spidaWiring: CrossArmWiring[],
  katapultWiring: CrossArmWiring[]
): CrossArmGroup[] => {
  const groups: CrossArmGroup[] = [];
  
  // Process SPIDA cross-arms
  const spidaArmGroups = new Map<string, CrossArmWiring[]>();
  for (const entry of spidaWiring) {
    if (!spidaArmGroups.has(entry.crossArmId)) {
      spidaArmGroups.set(entry.crossArmId, []);
    }
    spidaArmGroups.get(entry.crossArmId)!.push(entry);
  }
  
  for (const [armId, wires] of spidaArmGroups) {
    groups.push({
      armId,
      armHeight: wires[0].crossArmHt,
      system: 'SPIDA',
      wires: wires.sort((a, b) => b.crossArmHt - a.crossArmHt), // Sort by height desc
      isPseudo: false
    });
  }
  
  // Process Katapult pseudo cross-arms
  const katapultArmGroups = new Map<string, CrossArmWiring[]>();
  for (const entry of katapultWiring) {
    if (!katapultArmGroups.has(entry.crossArmId)) {
      katapultArmGroups.set(entry.crossArmId, []);
    }
    katapultArmGroups.get(entry.crossArmId)!.push(entry);
  }
  
  for (const [armId, wires] of katapultArmGroups) {
    groups.push({
      armId,
      armHeight: wires[0].crossArmHt,
      system: 'Katapult',
      wires: wires.sort((a, b) => b.crossArmHt - a.crossArmHt), // Sort by height desc
      isPseudo: true
    });
  }
  
  // Sort all groups by height descending
  return groups.sort((a, b) => b.armHeight - a.armHeight);
};

/**
 * Find matching cross-arms between SPIDA and Katapult based on height proximity
 */
export const matchCrossArms = (
  spidaGroups: CrossArmGroup[],
  katapultGroups: CrossArmGroup[],
  toleranceFt: number = 1.0
): Array<{
  spidaGroup: CrossArmGroup | null;
  katapultGroup: CrossArmGroup | null;
  heightDifferenceFt?: number;
  matchType: 'exact' | 'close' | 'spida-only' | 'katapult-only';
}> => {
  const matches: Array<{
    spidaGroup: CrossArmGroup | null;
    katapultGroup: CrossArmGroup | null;
    heightDifferenceFt?: number;
    matchType: 'exact' | 'close' | 'spida-only' | 'katapult-only';
  }> = [];
  
  const usedKatapultGroups = new Set<string>();
  
  // Try to match each SPIDA group with a Katapult group
  for (const spidaGroup of spidaGroups) {
    let bestMatch: CrossArmGroup | null = null;
    let smallestDiff = Infinity;
    
    for (const katapultGroup of katapultGroups) {
      if (usedKatapultGroups.has(katapultGroup.armId)) continue;
      
      const heightDiff = Math.abs(spidaGroup.armHeight - katapultGroup.armHeight);
      if (heightDiff <= toleranceFt && heightDiff < smallestDiff) {
        bestMatch = katapultGroup;
        smallestDiff = heightDiff;
      }
    }
    
    if (bestMatch) {
      usedKatapultGroups.add(bestMatch.armId);
      matches.push({
        spidaGroup,
        katapultGroup: bestMatch,
        heightDifferenceFt: smallestDiff,
        matchType: smallestDiff < 0.1 ? 'exact' : 'close'
      });
    } else {
      matches.push({
        spidaGroup,
        katapultGroup: null,
        matchType: 'spida-only'
      });
    }
  }
  
  // Add unmatched Katapult groups
  for (const katapultGroup of katapultGroups) {
    if (!usedKatapultGroups.has(katapultGroup.armId)) {
      matches.push({
        spidaGroup: null,
        katapultGroup,
        matchType: 'katapult-only'
      });
    }
  }
  
  return matches.sort((a, b) => {
    const aHeight = a.spidaGroup?.armHeight || a.katapultGroup?.armHeight || 0;
    const bHeight = b.spidaGroup?.armHeight || b.katapultGroup?.armHeight || 0;
    return bHeight - aHeight; // Sort by height descending
  });
};

// Helper function to extract pole tag (reused from main component)
const extractPoleTag = (poleLabel: string): string => {
  const match = poleLabel.match(/([A-Z]+\d+)/);
  return match ? match[1] : poleLabel;
}; 