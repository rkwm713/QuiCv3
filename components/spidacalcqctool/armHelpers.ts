// Cross-arm relationship helpers for efficient SPIDA parsing
// Centralizes the logic for determining which attachments sit on cross-arms

export interface ArmMaps {
  armGroundHeight: Map<string, number>;
  insulatorToArm: Map<string, string>;
  wireToInsulatorId: Map<string, string>;
}

// Unit conversion helper type
type Unit = 'METRE' | 'FEET' | 'INCH';

// Simple conversion function (should match the one in SpidaQcTool)
const toMetres = (val: number, unit: Unit): number => {
  if (unit === 'METRE') return val;
  if (unit === 'FEET') return val * 0.3048;
  return val * 0.0254; // INCH
};

/**
 * Build all cross-arm relationship maps once per pole structure
 * This eliminates O(n²) searches and centralizes the arm logic
 */
export const buildArmMaps = (structure: any): ArmMaps => {
  const armGroundHeight = new Map<string, number>();
  const insulatorToArm = new Map<string, string>();
  const wireToInsulatorId = new Map<string, string>();

  // 1. Build arm height map and insulator→arm relationships
  structure.crossArms?.forEach((arm: any) => {
    // Handle both attachmentHeight and offset for cross-arms (Fix C from previous analysis)
    const rawHeight = arm.attachmentHeight?.value ?? arm.offset?.value ?? 0;
    const unit = (arm.attachmentHeight?.unit ?? arm.offset?.unit ?? 'METRE') as Unit;
    
    armGroundHeight.set(arm.id, toMetres(rawHeight, unit));
    
    // Map each insulator to this arm
    arm.insulators?.forEach((insId: string) => {
      insulatorToArm.set(insId, arm.id);
    });
  });

  // 2. Build wire→insulator relationships  
  structure.insulators?.forEach((ins: any) => {
    ins.wires?.forEach((wId: string) => {
      wireToInsulatorId.set(wId, ins.id);
    });
  });

  return { armGroundHeight, insulatorToArm, wireToInsulatorId };
};

/**
 * Check if an insulator sits on a cross-arm
 * O(1) lookup using pre-built maps
 */
export const isInsulatorOnArm = (insId: string, maps: ArmMaps): boolean => {
  return maps.insulatorToArm.has(insId);
};

/**
 * Check if a wire sits on a cross-arm (via its parent insulator)
 * O(1) lookup using pre-built maps
 */
export const isWireOnArm = (wireId: string, maps: ArmMaps): boolean => {
  const insId = maps.wireToInsulatorId.get(wireId);
  return insId ? maps.insulatorToArm.has(insId) : false;
};

/**
 * Get the cross-arm ID for an insulator (if it's on one)
 */
export const getInsulatorArmId = (insId: string, maps: ArmMaps): string | undefined => {
  return maps.insulatorToArm.get(insId);
};

/**
 * Get the cross-arm ID for a wire (if it's on one, via its parent insulator)
 */
export const getWireArmId = (wireId: string, maps: ArmMaps): string | undefined => {
  const insId = maps.wireToInsulatorId.get(wireId);
  return insId ? maps.insulatorToArm.get(insId) : undefined;
};

/**
 * Get the ground height for an arm
 */
export const getArmGroundHeight = (armId: string, maps: ArmMaps): number | undefined => {
  return maps.armGroundHeight.get(armId);
};

/**
 * Sanity check function to verify cross-arm logic is working correctly
 * Tests the decision tree with sample attachments
 */
export const verifyCrossArmLogic = (
  structure: any, 
  maps: ArmMaps, 
  poleLabel: string
): void => {
  console.log(`🔧 Cross-arm logic verification for pole ${poleLabel}:`);
  
  // Test insulators
  structure.insulators?.forEach((ins: any) => {
    const isOnArm = isInsulatorOnArm(ins.id, maps);
    const armId = getInsulatorArmId(ins.id, maps);
    console.log(`  📍 Insulator ${ins.id}: ${isOnArm ? `ON ARM ${armId}` : 'NOT on arm'}`);
  });
  
  // Test wires
  structure.wires?.forEach((wire: any) => {
    const isOnArm = isWireOnArm(wire.id, maps);
    const armId = getWireArmId(wire.id, maps);
    const parentInsId = maps.wireToInsulatorId.get(wire.id);
    console.log(`  🔌 Wire ${wire.id}: ${isOnArm ? `ON ARM ${armId} (via insulator ${parentInsId})` : 'NOT on arm'}`);
  });
  
  // Test guys (should be false)
  structure.guys?.forEach((guy: any) => {
    const isOnArm = isWireOnArm(guy.id, maps); // Guys aren't wires but let's test anyway
    console.log(`  ⚓ Guy ${guy.id}: ${isOnArm ? 'ON ARM (unexpected!)' : 'NOT on arm (expected)'}`);
  });
  
  console.log(`🔧 Cross-arm verification complete for pole ${poleLabel}`);
}; 