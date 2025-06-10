import { Attachment, EnhancedComparison } from './types';

const EPS = 0.003; // height tolerance (~3mm) - tighter to avoid mis-grouping on crowded cross-arms

export interface CompRow {
  spida: Attachment | null;
  kat: Attachment | null;
}

export interface GroupRow {
  parent: Attachment;               // INSULATOR
  kat: Attachment | null;           // Katapult match for parent
  wires: Attachment[];              // children
}

// Enhanced comparison versions
export interface EnhancedGroupRow {
  parent: EnhancedComparison;       // INSULATOR comparison
  children: EnhancedComparison[];   // child wire comparisons
}

// Group attachments by insulators with wires nested under them
export const groupByInsulator = (rows: CompRow[]): GroupRow[] => {
  const parents = rows.filter(r => r.spida?.type.toLowerCase().includes('insulator') && !r.spida?.synthetic);

  return parents.map(p => {
    const children = rows
      .filter(r => {
        // Skip if not a wire/cable or if it's an insulator
        if (!r.spida?.type || r.spida.type.toLowerCase().includes('insulator')) return false;
        
        // PRIORITY 1: explicit parent-child link (absolute priority)
        if (r.spida.parentInsulatorId === p.spida!.id) {
          return true;
        }
        
        // PRIORITY 2: height-based fallback ONLY if:
        // - No explicit parent link exists
        // - Same pole 
        // - Same height within tolerance
        // - This insulator is the ONLY one at this exact height (avoids crossarm ambiguity)
        if (!r.spida.parentInsulatorId && 
            r.spida.poleScid === p.spida!.poleScid &&
            Math.abs(r.spida.height - p.spida!.height) < EPS) {
          
          // Count real insulators at this exact height on this pole (exclude synthetic ones)
          const insulatorsAtSameHeight = rows.filter(otherRow => 
            otherRow.spida?.type.toLowerCase().includes('insulator') &&
            !otherRow.spida.synthetic &&
            otherRow.spida.poleScid === p.spida!.poleScid &&
            Math.abs(otherRow.spida.height - p.spida!.height) < EPS
          );
          
          // Only use height fallback if there's exactly one insulator at this height
          return insulatorsAtSameHeight.length === 1;
        }
        
        return false;
      })
      .map(r => r.spida!)
      .filter(Boolean);

    return { 
      parent: p.spida!, 
      kat: p.kat, 
      wires: children.sort((a, b) => b.height - a.height) // Sort wires by height (highest first)
    };
  });
};

// Enhanced version: Group enhanced comparisons by insulators
export const groupEnhancedByInsulator = (comparisons: EnhancedComparison[]): EnhancedGroupRow[] => {
  const parents = comparisons.filter(comp => 
    (comp.spida?.type.toLowerCase().includes('insulator') && !comp.spida?.synthetic) || 
    (comp.katapult?.type.toLowerCase().includes('insulator') && !comp.katapult?.synthetic)
  );

  return parents.map(parent => {
    const parentHeight = parent.spida?.height || parent.katapult?.height || 0;
    const parentPole = parent.spida?.poleScid || parent.katapult?.poleScid || '';
    const parentSpidaId = parent.spida?.id || '';
    const parentKatapultId = parent.katapult?.id || '';

    const children = comparisons.filter(comp => {
      // Skip if this is the parent itself
      if (comp === parent) return false;
      
      // Check if child is not a real insulator (exclude synthetic ones)
      const isChildSpidaInsulator = comp.spida?.type.toLowerCase().includes('insulator') && !comp.spida?.synthetic;
      const isChildKatapultInsulator = comp.katapult?.type.toLowerCase().includes('insulator') && !comp.katapult?.synthetic;
      if (isChildSpidaInsulator || isChildKatapultInsulator) return false;
      
      // EXCLUDE communication services - they don't mount on insulators (Enhanced detection)
      const isCommService = 
        comp.spida?.type.toLowerCase().includes('communication') ||
        comp.spida?.type.toLowerCase().includes('service') ||
        comp.spida?.type.toLowerCase().includes('comm') ||
        comp.spida?.type.toLowerCase().includes('drop') ||
        comp.spida?.type.toLowerCase().includes('svc') ||
        comp.katapult?.type.toLowerCase().includes('communication') ||
        comp.katapult?.type.toLowerCase().includes('service') ||
        comp.katapult?.type.toLowerCase().includes('comm') ||
        comp.katapult?.type.toLowerCase().includes('drop') ||
        comp.katapult?.type.toLowerCase().includes('svc');
      if (isCommService) return false;
      
      // EXCLUDE pole tops - they should remain ungrouped
      const isPoleTop = 
        comp.spida?.type.toLowerCase().includes('pole top') ||
        comp.katapult?.type.toLowerCase().includes('pole top');
      if (isPoleTop) return false;
      
      // PRIORITY 1: Explicit parent link (absolute priority)
      if (comp.spida?.parentInsulatorId === parentSpidaId || 
          comp.katapult?.parentInsulatorId === parentKatapultId) {
        return true;
      }
      
      // PRIORITY 2: Height-based fallback with very strict conditions
      // Only for actual wires/cables that would realistically be on insulators
      // AND only if this is the unique insulator at this height (avoids crossarm ambiguity)
      if (!comp.spida?.parentInsulatorId && !comp.katapult?.parentInsulatorId) {
        const childHeight = comp.spida?.height || comp.katapult?.height || 0;
        const childPole = comp.spida?.poleScid || comp.katapult?.poleScid || '';
        
        // Must be on same pole and same height
        if (childPole === parentPole && Math.abs(childHeight - parentHeight) < EPS) {
          
          // Only group actual wires/cables, not equipment or services
          const isActualWire = 
            comp.spida?.type.toLowerCase().includes('wire') ||
            comp.spida?.type.toLowerCase().includes('cable') ||
            comp.spida?.type.toLowerCase().includes('neutral') ||
            comp.spida?.type.toLowerCase().includes('primary') ||
            comp.katapult?.type.toLowerCase().includes('wire') ||
            comp.katapult?.type.toLowerCase().includes('cable') ||
            comp.katapult?.type.toLowerCase().includes('neutral') ||
            comp.katapult?.type.toLowerCase().includes('primary');
            
          if (!isActualWire) return false;
          
          // Count real insulators at this exact height on this pole (exclude synthetic ones)
          const insulatorsAtSameHeight = comparisons.filter(otherComp => 
            ((otherComp.spida?.type.toLowerCase().includes('insulator') && !otherComp.spida.synthetic) || 
             (otherComp.katapult?.type.toLowerCase().includes('insulator') && !otherComp.katapult.synthetic)) &&
            (otherComp.spida?.poleScid === parentPole || otherComp.katapult?.poleScid === parentPole) &&
            Math.abs((otherComp.spida?.height || otherComp.katapult?.height || 0) - parentHeight) < EPS
          );
          
          // Only use height fallback if there's exactly one insulator at this height
          return insulatorsAtSameHeight.length === 1;
        }
      }
      
      return false;
    });

    return {
      parent,
      children: children.sort((a, b) => {
        const aHeight = a.spida?.height || a.katapult?.height || 0;
        const bHeight = b.spida?.height || b.katapult?.height || 0;
        return bHeight - aHeight; // Sort by height (highest first)
      })
    };
  });
};

// Remove duplicate flat wires that will be shown as children under insulators
export const removeDuplicateWires = (rows: CompRow[]): CompRow[] => {
  return rows.filter(r => {
    // Always keep real insulators (not synthetic ones)
    if (!r.spida?.type || (r.spida.type.toLowerCase().includes('insulator') && !r.spida.synthetic)) return true;
    
    // Check if this wire will be shown as a child under an insulator
    const linked = r.spida.parentInsulatorId
      ? // PRIORITY 1: Explicit parent relationship exists - absolute priority
        rows.some(p => p.spida?.id === r.spida!.parentInsulatorId)
      : // PRIORITY 2: Height-based fallback - only if unique insulator at height (avoids crossarm ambiguity)
        (() => {
          // Find real insulators at the same height on the same pole (exclude synthetic ones)
          const insulatorsAtSameHeight = rows.filter(p =>
            p.spida?.type.toLowerCase().includes('insulator') &&
            !p.spida.synthetic &&
            p.spida.poleScid === r.spida!.poleScid &&
            Math.abs(p.spida.height - r.spida!.height) < EPS
          );
          
          // Only use height fallback if there's exactly one insulator at this height
          return insulatorsAtSameHeight.length === 1;
        })();
    
    return !linked; // drop if it will be shown as child
  });
};

// Enhanced version: Remove duplicate wires that will be shown as children
export const removeEnhancedDuplicateWires = (comparisons: EnhancedComparison[]): EnhancedComparison[] => {
  return comparisons.filter(comp => {
    // Always keep real insulators and pole tops (not synthetic ones)
    const isSpidaInsulator = comp.spida?.type.toLowerCase().includes('insulator') && !comp.spida?.synthetic;
    const isKatapultInsulator = comp.katapult?.type.toLowerCase().includes('insulator') && !comp.katapult?.synthetic;
    const isPoleTop = comp.spida?.type.toLowerCase().includes('pole top') || 
                     comp.katapult?.type.toLowerCase().includes('pole top');
    
    if (isSpidaInsulator || isKatapultInsulator || isPoleTop) return true;
    
    // Always keep communication services - they should never be grouped under insulators (Enhanced detection)
    const isCommService = 
      comp.spida?.type.toLowerCase().includes('communication') ||
      comp.spida?.type.toLowerCase().includes('service') ||
      comp.spida?.type.toLowerCase().includes('comm') ||
      comp.spida?.type.toLowerCase().includes('drop') ||
      comp.spida?.type.toLowerCase().includes('svc') ||
      comp.katapult?.type.toLowerCase().includes('communication') ||
      comp.katapult?.type.toLowerCase().includes('service') ||
      comp.katapult?.type.toLowerCase().includes('comm') ||
      comp.katapult?.type.toLowerCase().includes('drop') ||
      comp.katapult?.type.toLowerCase().includes('svc');
    if (isCommService) return true;
    
    // Always keep equipment types - they should never be grouped under insulators
    const isEquipment = 
      comp.spida?.type.toLowerCase().includes('transformer') ||
      comp.spida?.type.toLowerCase().includes('light') ||
      comp.spida?.type.toLowerCase().includes('riser') ||
      comp.spida?.type.toLowerCase().includes('drip') ||
      comp.spida?.type.toLowerCase().includes('loop') ||
      comp.katapult?.type.toLowerCase().includes('transformer') ||
      comp.katapult?.type.toLowerCase().includes('light') ||
      comp.katapult?.type.toLowerCase().includes('riser') ||
      comp.katapult?.type.toLowerCase().includes('drip') ||
      comp.katapult?.type.toLowerCase().includes('loop');
    if (isEquipment) return true;
    
    // Always keep guys - they should never be grouped under insulators
    const isGuy = 
      comp.spida?.type.toLowerCase().includes('guy') ||
      comp.katapult?.type.toLowerCase().includes('guy');
    if (isGuy) return true;
    
    // For actual wires/cables, check if they will be shown as children under an insulator
    const parentHeight = comp.spida?.height || comp.katapult?.height || 0;
    const parentPole = comp.spida?.poleScid || comp.katapult?.poleScid || '';
    const spidaParentId = comp.spida?.parentInsulatorId;
    const katapultParentId = comp.katapult?.parentInsulatorId;
    
    // Only consider wires/cables for grouping
    const isActualWire = 
      comp.spida?.type.toLowerCase().includes('wire') ||
      comp.spida?.type.toLowerCase().includes('cable') ||
      comp.spida?.type.toLowerCase().includes('neutral') ||
      comp.spida?.type.toLowerCase().includes('primary') ||
      comp.katapult?.type.toLowerCase().includes('wire') ||
      comp.katapult?.type.toLowerCase().includes('cable') ||
      comp.katapult?.type.toLowerCase().includes('neutral') ||
      comp.katapult?.type.toLowerCase().includes('primary');
    
    if (!isActualWire) return true; // Keep non-wire items that aren't explicitly handled above
    
    const linked = spidaParentId || katapultParentId
      ? // PRIORITY 1: Explicit parent relationship exists - absolute priority
        comparisons.some(p =>
          (p.spida?.id === spidaParentId || p.katapult?.id === spidaParentId) ||
          (p.spida?.id === katapultParentId || p.katapult?.id === katapultParentId))
      : // PRIORITY 2: Height-based fallback - only if unique insulator at height (avoids crossarm ambiguity)
        (() => {
          // Find real insulators at the same height on the same pole (exclude synthetic ones)
          const insulatorsAtSameHeight = comparisons.filter(p =>
            ((p.spida?.type.toLowerCase().includes('insulator') && !p.spida.synthetic) || 
             (p.katapult?.type.toLowerCase().includes('insulator') && !p.katapult.synthetic)) &&
            (p.spida?.poleScid === parentPole || p.katapult?.poleScid === parentPole) &&
            Math.abs((p.spida?.height || p.katapult?.height || 0) - parentHeight) < EPS
          );
          
          // Only use height fallback if there's exactly one insulator at this height
          return insulatorsAtSameHeight.length === 1;
        })();
    
    return !linked; // drop if it will be shown as child
  });
};

// Helper to format height in feet and inches
export const formatHeightFtIn = (heightMeters: number): string => {
  const totalFeet = heightMeters * 3.28084;
  const feet = Math.floor(totalFeet);
  const inches = Math.round((totalFeet - feet) * 12);
  
  if (inches >= 12) {
    return `${feet + 1}' 0"`;
  }
  
  return inches > 0 ? `${feet}' ${inches}"` : `${feet}' 0"`;
};

// Helper to calculate and format height difference
export const calculateDifference = (spidaHeight: number, katapultHeight: number): {
  difference: number;
  text: string;
  isSignificant: boolean;
} => {
  const difference = spidaHeight - katapultHeight;
  const isSignificant = Math.abs(difference) > 0.15; // >6 inches
  
  const diffText = difference > 0 
    ? `+${formatHeightFtIn(Math.abs(difference))} higher`
    : `-${formatHeightFtIn(Math.abs(difference))} lower`;
  
  return {
    difference,
    text: diffText,
    isSignificant
  };
}; 