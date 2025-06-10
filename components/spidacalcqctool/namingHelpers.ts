// Centralized naming helpers for robust SPIDA and Katapult attachment naming
// Addresses structural mismatches, logic gaps, and edge cases

export interface SpidaAttachment {
  id?: string;
  clientItem?: any;
  clientItemAlias?: string;
  owner?: { id?: string };
  usageGroup?: string;
  tensionGroup?: string;
  type?: string;
}

export interface KatapultTrace {
  label?: string;
  cable_type?: string;
  _trace_type?: string;
  company?: string;
}

export interface NamingResult {
  displayName: string;
  compositeKey: string;
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════
// CENTRALIZED SAFE NAME EXTRACTION
// ═══════════════════════════════════════════════════════════

/**
 * Universal name extractor that handles all three SPIDA data patterns:
 * - Object pattern: item.clientItem.size
 * - String pattern: item.clientItem (direct string)
 * - Catalog pattern: item.size (top-level)
 */
const safeGetName = (item: any): string => {
  // Object pattern (most instances)
  if (item?.clientItem?.size) {
    return item.clientItem.size;
  }
  
  // String pattern (some instances store name directly)
  if (typeof item?.clientItem === 'string') {
    return item.clientItem;
  }
  
  // Catalog pattern (definitions at top level)
  if (item?.size) {
    return item.size;
  }
  
  // Mark failures visibly for QC
  return '‼ Unknown Name';
};

/**
 * Extract engineering alias if available (especially important for guys)
 */
const safeGetAlias = (item: any): string | null => {
  if (typeof item?.clientItemAlias === 'string' && item.clientItemAlias.trim()) {
    return item.clientItemAlias.trim();
  }
  return null;
};

/**
 * Extract owner with fallback handling
 */
const safeGetOwner = (item: any): string => {
  const owner = item?.owner?.id || item?.owner || 'Unknown Owner';
  return owner.toString().trim();
};

// ═══════════════════════════════════════════════════════════
// IMPROVED CROSS-ARM DETECTION
// ═══════════════════════════════════════════════════════════

/**
 * Positive ID-based cross-arm detection instead of fuzzy string matching
 * This prevents legitimate insulator names from being filtered out
 */
export const isCrossArmById = (id: string, crossArmIds: Set<string>): boolean => {
  return crossArmIds.has(id);
};

/**
 * Build cross-arm ID set from structure data for positive matching
 */
export const buildCrossArmIdSet = (structure: any): Set<string> => {
  const crossArmIds = new Set<string>();
  
  if (structure?.crossArms) {
    structure.crossArms.forEach((arm: any) => {
      if (arm.id) {
        crossArmIds.add(arm.id);
      }
    });
  }
  
  return crossArmIds;
};

// ═══════════════════════════════════════════════════════════
// SPIDA NAMING FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Build wire description with full context for unique identification
 */
export const buildWireDescription = (wire: SpidaAttachment): NamingResult => {
  const warnings: string[] = [];
  const baseName = safeGetName(wire);
  const owner = safeGetOwner(wire);
  const usageGroup = wire.usageGroup || 'Unknown Usage';
  const tensionGroup = wire.tensionGroup;
  
  // Check for missing tension group (critical for clearance calculations)
  if (!tensionGroup) {
    warnings.push(`Wire ${wire.id} missing tension group - may affect clearance calculations`);
  }
  
  // Build composite description with all identifying information
  let description = baseName;
  
  // Add tension group if available
  if (tensionGroup) {
    description += ` - ${tensionGroup}`;
  } else {
    description += ' - ‼ No Tension';
  }
  
  // Build composite key for unique identification (owner + usage + size + tension)
  const compositeKey = `${owner}|${usageGroup}|${baseName}|${tensionGroup || 'NO_TENSION'}`;
  
  return {
    displayName: description,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

/**
 * Build insulator description with alias preference and cross-arm safety
 */
export const buildInsulatorDescription = (insulator: SpidaAttachment, crossArmIds: Set<string>): NamingResult => {
  const warnings: string[] = [];
  const baseName = safeGetName(insulator);
  const alias = safeGetAlias(insulator);
  
  // Prefer engineering alias if available (more specific than size)
  let description = alias || baseName;
  
  // Safety check: prevent cross-arm descriptions if this is actually a cross-arm
  if (insulator.id && isCrossArmById(insulator.id, crossArmIds)) {
    warnings.push(`Insulator ${insulator.id} appears to be a cross-arm - check data integrity`);
    description = '‼ Cross-arm in Insulator';
  }
  
  const owner = safeGetOwner(insulator);
  const compositeKey = `${owner}|INSULATOR|${description}`;
  
  return {
    displayName: description,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

/**
 * Build cross-arm description with proper size extraction
 */
export const buildCrossArmDescription = (crossArm: SpidaAttachment): NamingResult => {
  const warnings: string[] = [];
  const baseName = safeGetName(crossArm);
  
  // For cross-arms, the size field often contains the full specification
  let description = baseName;
  
  // Check for double cross-arm indicator
  if (crossArm.type === 'DOUBLE' || baseName.toLowerCase().includes('double')) {
    description = `Double ${description}`;
  }
  
  const owner = safeGetOwner(crossArm);
  const compositeKey = `${owner}|CROSSARM|${description}`;
  
  return {
    displayName: description,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

/**
 * Build guy description with alias preference and spec fallbacks
 */
export const buildGuyDescription = (guy: SpidaAttachment): NamingResult => {
  const warnings: string[] = [];
  const baseName = safeGetName(guy);
  const alias = safeGetAlias(guy);
  
  // Prefer engineering alias for guys (e.g., "E1.1L.3/8" vs "3/8\" EHS")
  let description = alias || baseName;
  
  // Add type information if available (deadend vs tangent)
  if (guy.type && guy.type !== 'GUY') {
    description += ` (${guy.type})`;
  }
  
  const owner = safeGetOwner(guy);
  const compositeKey = `${owner}|GUY|${description}`;
  
  return {
    displayName: description,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

/**
 * Build equipment description with measurement context
 */
export const buildEquipmentDescription = (equipment: SpidaAttachment): NamingResult => {
  const warnings: string[] = [];
  const baseName = safeGetName(equipment);
  const owner = safeGetOwner(equipment);
  const equipmentType = equipment.clientItem?.type || equipment.type || 'Equipment';
  
  let description = baseName;
  
  // Add type context if not already included in name
  if (!description.toLowerCase().includes(equipmentType.toLowerCase())) {
    description = `${equipmentType} - ${description}`;
  }
  
  const compositeKey = `${owner}|${equipmentType}|${description}`;
  
  return {
    displayName: description,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

// ═══════════════════════════════════════════════════════════
// KATAPULT NAMING FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Build Katapult trace name with proper fallback cascade
 */
export const buildKatapultTraceName = (trace: KatapultTrace): NamingResult => {
  const warnings: string[] = [];
  
  // Fallback cascade: label → cable_type → _trace_type → company
  let name = trace.label?.trim();
  
  if (!name && trace.cable_type?.trim()) {
    name = trace.cable_type.trim();
  }
  
  if (!name && trace._trace_type?.trim()) {
    name = trace._trace_type.trim();
  }
  
  if (!name && trace.company?.trim()) {
    name = `${trace.company.trim()} Attachment`;
    warnings.push('Trace name derived from company only - may be ambiguous');
  }
  
  if (!name) {
    name = '‼ No Trace Name';
    warnings.push('No identifying information found in trace data');
  }
  
  const compositeKey = `${trace.company || 'Unknown'}|${trace.cable_type || 'Unknown'}|${name}`;
  
  return {
    displayName: name,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

/**
 * Build Katapult equipment name with generic measurement handling
 */
export const buildKatapultEquipmentName = (
  equipmentType: string,
  company: string,
  measurementOf?: string
): NamingResult => {
  const warnings: string[] = [];
  
  let description = equipmentType || 'Equipment';
  
  // Generic measurement-of handling for all equipment types
  if (measurementOf?.trim()) {
    description += ` (${measurementOf.trim()})`;
  }
  
  // Build full attachment type
  const attachmentType = `${company || 'Unknown'} ${description}`.trim();
  const compositeKey = `${company || 'Unknown'}|${equipmentType || 'Equipment'}|${measurementOf || 'None'}`;
  
  return {
    displayName: attachmentType,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

/**
 * Build Katapult guy name with spec fallback handling
 */
export const buildKatapultGuyName = (
  guyData: any,
  trace: KatapultTrace
): NamingResult => {
  const warnings: string[] = [];
  
  // Extract guy type with proper fallback for empty strings
  let guyType = guyData.guy_type?.trim() || 
                guyData.guying_type?.trim() || 
                trace._trace_type?.trim() || 
                trace.cable_type?.trim();
  
  if (!guyType || guyType === '') {
    guyType = 'guy';
    warnings.push('Guy type information missing - using generic type');
  }
  
  // Canonical type determination
  const attachmentType = guyType.toLowerCase().includes('down') ? 'DOWN_GUY' : 'GUY';
  const description = `${guyType} [Katapult]`;
  
  const compositeKey = `${trace.company || 'Unknown'}|${attachmentType}|${guyType}`;
  
  return {
    displayName: description,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

// ═══════════════════════════════════════════════════════════
// BUNDLE & MESSENGER HANDLING
// ═══════════════════════════════════════════════════════════

/**
 * Handle communication bundles and messengers separately
 */
export const buildCommunicationDescription = (wire: SpidaAttachment): NamingResult => {
  const warnings: string[] = [];
  const baseName = safeGetName(wire);
  const usageGroup = wire.usageGroup || '';
  
  let description = baseName;
  
  // Distinguish between bundle components
  if (usageGroup.includes('BUNDLE')) {
    description += ' (Bundle Messenger)';
  } else if (usageGroup.includes('SERVICE')) {
    description += ' (Service Drop)';
  }
  
  const owner = safeGetOwner(wire);
  const compositeKey = `${owner}|${usageGroup}|${baseName}`;
  
  return {
    displayName: description,
    compositeKey: compositeKey,
    warnings: warnings
  };
};

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Normalize text for comparison (lowercase, trim, remove special chars)
 */
export const normalizeForComparison = (text: string): string => {
  return text.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
};

/**
 * Collect and log all naming warnings for QC review
 */
export const logNamingWarnings = (warnings: string[], poleLabel: string): void => {
  if (warnings.length > 0) {
    console.warn(`🏷️ Naming warnings for pole ${poleLabel}:`, warnings);
  }
}; 