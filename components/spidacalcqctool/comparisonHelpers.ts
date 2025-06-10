import { Attachment, EnhancedComparison } from './types';

const EPS = 0.01; // height tolerance (ft ≈ ⅛″)

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
  const parents = rows.filter(r => r.spida?.type.toLowerCase().includes('insulator'));

  return parents.map(p => {
    const children = rows
      .filter(r =>
        r.spida?.type && !r.spida.type.toLowerCase().includes('insulator') &&
        (
          // PRIORITY 1: explicit parent-child link (most reliable)
          r.spida.parentInsulatorId === p.spida!.id ||
          // PRIORITY 2: height-based fallback ONLY if no explicit link exists
          // AND we can uniquely identify the parent (no other insulators at same height on same pole)
          (
            !r.spida.parentInsulatorId &&
            r.spida.poleScid === p.spida!.poleScid &&
            Math.abs(r.spida.height - p.spida!.height) < EPS &&
            // Ensure this insulator is the ONLY one at this height on this pole
            rows.filter(otherRow => 
              otherRow.spida?.type.toLowerCase().includes('insulator') &&
              otherRow.spida.poleScid === p.spida!.poleScid &&
              Math.abs(otherRow.spida.height - p.spida!.height) < EPS
            ).length === 1
          )
        )
      )
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
    comp.spida?.type.toLowerCase().includes('insulator') || 
    comp.katapult?.type.toLowerCase().includes('insulator')
  );

  return parents.map(parent => {
    const parentHeight = parent.spida?.height || parent.katapult?.height || 0;
    const parentPole = parent.spida?.poleScid || parent.katapult?.poleScid || '';
    const parentId = parent.spida?.id || parent.katapult?.id || '';

    const children = comparisons.filter(comp => {
      // Skip if this is the parent itself
      if (comp === parent) return false;
      
      // Check if child is not an insulator
      const isChildSpidaInsulator = comp.spida?.type.toLowerCase().includes('insulator');
      const isChildKatapultInsulator = comp.katapult?.type.toLowerCase().includes('insulator');
      if (isChildSpidaInsulator || isChildKatapultInsulator) return false;
      
      // EXCLUDE communication services - they don't mount on insulators
      const isCommService = 
        comp.spida?.type.toLowerCase().includes('communication') ||
        comp.spida?.type.toLowerCase().includes('service') ||
        comp.katapult?.type.toLowerCase().includes('communication') ||
        comp.katapult?.type.toLowerCase().includes('service');
      if (isCommService) return false;
      
      // EXCLUDE pole tops - they should remain ungrouped
      const isPoleTop = 
        comp.spida?.type.toLowerCase().includes('pole top') ||
        comp.katapult?.type.toLowerCase().includes('pole top');
      if (isPoleTop) return false;
      
      // Check for parent-child relationship
      const childHeight = comp.spida?.height || comp.katapult?.height || 0;
      const childPole = comp.spida?.poleScid || comp.katapult?.poleScid || '';
      
      return (
        // PRIORITY 1: Explicit parent link (SPIDA side) - most reliable
        comp.spida?.parentInsulatorId === parentId ||
        // PRIORITY 2: Height-based fallback with strict conditions
        // Only for actual wires/cables that would realistically be on insulators
        // AND only if this is the unique insulator at this height
        (
          !comp.spida?.parentInsulatorId &&
          childPole === parentPole &&
          Math.abs(childHeight - parentHeight) < EPS &&
          // Only group actual wires/cables, not equipment or services
          (
            comp.spida?.type.toLowerCase().includes('wire') ||
            comp.spida?.type.toLowerCase().includes('cable') ||
            comp.spida?.type.toLowerCase().includes('neutral') ||
            comp.spida?.type.toLowerCase().includes('primary') ||
            comp.katapult?.type.toLowerCase().includes('wire') ||
            comp.katapult?.type.toLowerCase().includes('cable') ||
            comp.katapult?.type.toLowerCase().includes('neutral') ||
            comp.katapult?.type.toLowerCase().includes('primary')
          ) &&
          // Ensure this insulator is the ONLY one at this height on this pole
          comparisons.filter(otherComp => 
            (otherComp.spida?.type.toLowerCase().includes('insulator') || otherComp.katapult?.type.toLowerCase().includes('insulator')) &&
            (otherComp.spida?.poleScid === parentPole || otherComp.katapult?.poleScid === parentPole) &&
            Math.abs((otherComp.spida?.height || otherComp.katapult?.height || 0) - parentHeight) < EPS
          ).length === 1
        )
      );
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
    if (!r.spida?.type || r.spida.type.toLowerCase().includes('insulator')) return true;
    
    // Check if this wire will be shown as a child under an insulator
    const linked = r.spida.parentInsulatorId
      ? // PRIORITY 1: Explicit parent relationship exists
        rows.some(p =>
          p.spida?.id === r.spida!.parentInsulatorId)
      : // PRIORITY 2: Height-based fallback with strict conditions - only if unique insulator at height
        rows.some(p =>
          p.spida?.type.toLowerCase().includes('insulator') &&
          p.spida.poleScid === r.spida!.poleScid &&
          Math.abs(p.spida.height - r.spida!.height) < EPS &&
          // Only link if this is the ONLY insulator at this height on this pole
          rows.filter(otherRow => 
            otherRow.spida?.type.toLowerCase().includes('insulator') &&
            otherRow.spida.poleScid === r.spida!.poleScid &&
            Math.abs(otherRow.spida.height - r.spida!.height) < EPS
          ).length === 1
        );
    
    return !linked; // drop if it will be shown as child
  });
};

// Enhanced version: Remove duplicate wires that will be shown as children
export const removeEnhancedDuplicateWires = (comparisons: EnhancedComparison[]): EnhancedComparison[] => {
  return comparisons.filter(comp => {
    // Always keep insulators and pole tops
    const isSpidaInsulator = comp.spida?.type.toLowerCase().includes('insulator');
    const isKatapultInsulator = comp.katapult?.type.toLowerCase().includes('insulator');
    const isPoleTop = comp.spida?.type.toLowerCase().includes('pole top') || 
                     comp.katapult?.type.toLowerCase().includes('pole top');
    
    if (isSpidaInsulator || isKatapultInsulator || isPoleTop) return true;
    
    // Always keep communication services - they should never be grouped under insulators
    const isCommService = 
      comp.spida?.type.toLowerCase().includes('communication') ||
      comp.spida?.type.toLowerCase().includes('service') ||
      comp.katapult?.type.toLowerCase().includes('communication') ||
      comp.katapult?.type.toLowerCase().includes('service');
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
    const parentId = comp.spida?.parentInsulatorId;
    
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
    
    const linked = parentId
      ? // PRIORITY 1: Explicit parent relationship exists
        comparisons.some(p =>
          (p.spida?.id === parentId || p.katapult?.id === parentId))
      : // PRIORITY 2: Height-based fallback with strict conditions - only if unique insulator at height
        comparisons.some(p =>
          (p.spida?.type.toLowerCase().includes('insulator') || p.katapult?.type.toLowerCase().includes('insulator')) &&
          (p.spida?.poleScid === parentPole || p.katapult?.poleScid === parentPole) &&
          Math.abs((p.spida?.height || p.katapult?.height || 0) - parentHeight) < EPS &&
          // Only link if this is the ONLY insulator at this height
          comparisons.filter(otherComp => 
            (otherComp.spida?.type.toLowerCase().includes('insulator') || otherComp.katapult?.type.toLowerCase().includes('insulator')) &&
            (otherComp.spida?.poleScid === parentPole || otherComp.katapult?.poleScid === parentPole) &&
            Math.abs((otherComp.spida?.height || otherComp.katapult?.height || 0) - parentHeight) < EPS
          ).length === 1
        );
    
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