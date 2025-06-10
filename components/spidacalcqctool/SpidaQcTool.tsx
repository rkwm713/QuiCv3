// /components/SpidaQcTool/SpidaQcTool.tsx

import React, { useState, useEffect } from 'react';
import { SpidaCalcData, PoleLocationData, Attachment, KatapultData, ComparisonResult, KatapultNode, EnhancedComparison, MatchResult, AttachmentPoint, AttachmentPointComparison } from './types';
import PoleLocation from './PoleLocation';
import ComparisonPole from './ComparisonPole';
import { downloadExcelReport } from './excelExport';
import { buildKatapultAttachmentPoints, compareAttachmentPoints } from './attachmentPointHelpers';
import { 
  extractSpidaCrossArmWiring, 
  extractKatapultCrossArmWiring, 
  groupWiringByCrossArm, 
  matchCrossArms 
} from './crossArmMapper';
import { 
  buildWireDescription, 
  buildInsulatorDescription, 
  buildCrossArmDescription, 
  buildGuyDescription, 
  buildEquipmentDescription,
  buildCommunicationDescription,
  buildKatapultTraceName,
  buildKatapultEquipmentName,
  buildKatapultGuyName,
  buildCrossArmIdSet,
  logNamingWarnings,
  normalizeForComparison,
  type NamingResult
} from './namingHelpers';

// Conversion factor from inches (Katapult heights) to metres
const INCHES_TO_METRES = 0.0254;

interface SpidaQcToolProps {
  // Optional props from Data Management page
  spidaJson?: any;
  katapultJson?: any;
  spidaFileName?: string | null;
  katapultFileName?: string | null;
}

interface KatapultGuy {
  id: string;
  height_inches: number;
  owner: string;
  raw_height: number;
  source: 'guying' | 'elements';
}

interface SpidaGuy {
  id: string;
  height_inches: number;
  owner: string;
  raw_height_meters: number;
}

const SpidaQcTool: React.FC<SpidaQcToolProps> = ({ 
  spidaJson: externalSpidaJson, 
  katapultJson: externalKatapultJson,
  spidaFileName: externalSpidaFileName,
  katapultFileName: externalKatapultFileName
}) => {
  const [spidaData, setSpidaData] = useState<SpidaCalcData | null>(null);
  const [poleLocations, setPoleLocations] = useState<PoleLocationData[]>([]);
  const [katapultData, setKatapultData] = useState<KatapultData | null>(null);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [localSpidaFileName, setLocalSpidaFileName] = useState<string | null>(null);
  const [localKatapultFileName, setLocalKatapultFileName] = useState<string | null>(null);

  // Determine if we're using external data or local uploads
  const usingExternalData = !!(externalSpidaJson || externalKatapultJson);
  const currentSpidaFileName = externalSpidaFileName || localSpidaFileName;
  const currentKatapultFileName = externalKatapultFileName || localKatapultFileName;

  // Helper to collect warnings for UI display
  const addWarning = (message: string) => {
    setWarnings(prev => [...prev, message]);
  };

  // Note: Insulator naming is now handled by centralized naming helpers in namingHelpers.ts

  // ════════════════════════════════════════════════════════════
  // UNIT CONVERSION HELPER - NORMALIZE ALL HEIGHTS TO METRES
  // ════════════════════════════════════════════════════════════
  type Unit = 'METRE' | 'FEET' | 'INCH';
  
  // Memoized conversion cache for performance
  const conversionCache = new Map<string, number>();
  
  const toMetres = (val: number, unit: Unit): number => {
    const cacheKey = `${val}|${unit}`;
    if (conversionCache.has(cacheKey)) {
      return conversionCache.get(cacheKey)!;
    }
    
    let result: number;
    if (unit === 'METRE') result = val;
    else if (unit === 'FEET') result = val * 0.3048;
    else result = val * 0.0254; // INCH
    
    conversionCache.set(cacheKey, result);
    return result;
  };

  // ════════════════════════════════════════════════════════════
  // PRODUCTION GUY MATCHING FUNCTIONS
  // ════════════════════════════════════════════════════════════

  // Convert height to whole inches per production spec
  const convertToWholeInches = (value: number, unit: 'METRE' | 'INCH'): number => {
    return Math.round(unit === 'METRE' ? value / 0.0254 : value);
  };

    // Normalize company names for matching
  const normalizeCompanyName = (company: string): string => {
      const normalized = company.toLowerCase().replace(/[^a-z]/g, '');
      const companyMap: Record<string, string> = {
        'cpsenergy': 'CPS',
        'cpsenerg': 'CPS',
        'cps': 'CPS',
        'attcom': 'AT&T',
        'att': 'AT&T',
        'at&t': 'AT&T',
        'charter': 'CHARTER',
        'chartercomm': 'CHARTER',
        'spectrum': 'CHARTER',
        'suddenlink': 'SUDDENLINK',
        'city': 'CITY',
        'municipal': 'CITY'
      };
      return companyMap[normalized] || company.toUpperCase();
    };

    // Extract Katapult guys per production spec - following the Golden Path
    const extractKatapultGuys = (data: KatapultData, poleTag: string): KatapultGuy[] => {
      const guys: KatapultGuy[] = [];
      
      if (!data.nodes || !data.photos || !data.traces?.trace_data) return guys;

      Object.values(data.nodes).forEach((node: KatapultNode) => {
        const rawPoleTag = node.attributes.electric_pole_tag?.assessment ??
                          Object.values(node.attributes.pole_tag ?? {})[0]?.tagtext ??
                          node.attributes.scid?.auto_button ?? '';
        
        if (extractPoleTag(rawPoleTag) !== poleTag || !node.photos) return;

        // Step 2: Find ALL main measurement photos (Golden Path - MULTI-PHOTO FIX)
        const mainPhotoIds = Object.keys(node.photos).filter((photoId) => {
          const photo = node.photos?.[photoId];
          const assoc = photo?.association as any;
          return assoc === 'main' || assoc === true ||
                 !!data.photos?.[photoId]?.photofirst_data; // catch-all
        });

        if (mainPhotoIds.length === 0) {
          console.warn(`No main photos found for pole ${poleTag}`);
          return;
        }

        console.log(`🔍 Pole ${poleTag} has ${mainPhotoIds.length} main photos to scan for guys`);

        // Step 3-5: Process ALL main photos (guys could be in any of them)
        mainPhotoIds.forEach(photoId => {
          const photofirstData = data.photos[photoId]?.photofirst_data;
          if (!photofirstData) return; // Skip photos without measurement data

          console.log(`🔍 Checking pole ${poleTag} photo ${photoId} for guys:`, {
            hasGuyingData: !!photofirstData.guying,
            guyingKeys: photofirstData.guying ? Object.keys(photofirstData.guying) : [],
            hasWireData: !!photofirstData.wire,
            wireKeys: photofirstData.wire ? Object.keys(photofirstData.wire) : []
          });

          // Step 4 & 5: Target the guying category and extract _measured_height (Golden Path)
          if (photofirstData.guying) {
            Object.entries(photofirstData.guying).forEach(([guyId, guyData]: [string, any]) => {
              if (!guyData._measured_height || !guyData._trace) {
                console.warn(`Guy ${guyId} missing _measured_height or _trace`);
                return;
              }
              
              const traceInfo = data.traces.trace_data[guyData._trace];
              if (!traceInfo) {
                console.warn(`No trace info for guy ${guyId} trace ${guyData._trace}`);
                return;
              }
              if (traceInfo.proposed === true) return; // Skip proposed

              const company = normalizeCompanyName(traceInfo.company || 'UNKNOWN');
              const heightInches = convertToWholeInches(guyData._measured_height, 'INCH');

              guys.push({
                id: guyId,
                height_inches: heightInches,
                owner: company,
                raw_height: guyData._measured_height,
                source: 'guying'
              });

              console.log(`✅ Found guy in guying section: ${guyId} @ ${guyData._measured_height}" (${heightInches}") in photo ${photoId}`);
            });
          }

          // Also check wire section for down_guy elements (backup)
          if (photofirstData.wire) {
            Object.entries(photofirstData.wire).forEach(([elemId, elemData]: [string, any]) => {
              if (!elemData._measured_height || !elemData._trace) return;
              
              const traceInfo = data.traces.trace_data[elemData._trace];
              if (!traceInfo || traceInfo.proposed === true) return; // Skip proposed
              if (traceInfo._trace_type !== 'down_guy') return; // Only down_guy elements

              const company = normalizeCompanyName(traceInfo.company || 'UNKNOWN');
              const heightInches = convertToWholeInches(elemData._measured_height, 'INCH');

              guys.push({
                id: elemId,
                height_inches: heightInches,
                owner: company,
                raw_height: elemData._measured_height,
                source: 'elements'
              });

              console.log(`✅ Found guy in wire section: ${elemId} @ ${elemData._measured_height}" (${heightInches}") in photo ${photoId}`);
            });
          }
        });
      });

      console.log(`🎯 Extracted ${guys.length} guys for pole ${poleTag}:`, guys);
      return guys;
    };

    // Extract SPIDA guys per production spec
    const extractSpidaGuys = (spidaPole: PoleLocationData): SpidaGuy[] => {
      const guys: SpidaGuy[] = [];
      
      // Only extract from measured design (current state, not proposed)
      const measuredDesign = spidaPole.designs.find(d => /measured|field/.test(d.label.toLowerCase()));
      if (!measuredDesign) return guys;

      measuredDesign.attachments.forEach(attachment => {
        if (attachment.type.toLowerCase() === 'guy') {
          const heightInches = convertToWholeInches(attachment.height, 'METRE');
          const owner = normalizeCompanyName(attachment.owner);

          guys.push({
            id: `${attachment.owner}-${attachment.description}`, // Create unique ID
            height_inches: heightInches,
            owner: owner,
            raw_height_meters: attachment.height
          });
        }
      });

      return guys;
    };

    // Main guy matching function per production spec
    const matchGuysForPole = (spidaPole: PoleLocationData, katapultData: KatapultData): MatchResult[] => {
      const poleTag = extractPoleTag(spidaPole.label);
      const katapultGuys = extractKatapultGuys(katapultData, poleTag);
      const spidaGuys = extractSpidaGuys(spidaPole);
      
      const results: MatchResult[] = [];
      
      // Build SPIDA index keyed by "<owner>|<whole_inches>"
      const spidaIndex = new Map<string, SpidaGuy>();
      spidaGuys.forEach(guy => {
        const key = `${guy.owner}|${guy.height_inches}`;
        spidaIndex.set(key, guy);
      });
      
      // Track which SPIDA guys have been matched
      const matchedSpidaKeys = new Set<string>();
      
      // Process each Katapult guy
      katapultGuys.forEach(katGuy => {
        const key = `${katGuy.owner}|${katGuy.height_inches}`;
        const spidaMatch = spidaIndex.get(key);
        
        if (spidaMatch) {
          // Found exact match
          results.push({
            status: "matched",
            height_in: katGuy.height_inches,
            owner: katGuy.owner,
            katapult_id: katGuy.id,
            spida_id: spidaMatch.id
          });
          matchedSpidaKeys.add(key);
          
          console.log(`✅ Guy match: ${katGuy.owner} @ ${katGuy.height_inches}" (K:${katGuy.raw_height}" ↔ S:${spidaMatch.raw_height_meters}m)`);
        } else {
          // No match found for Katapult guy
          results.push({
            status: "unmatched_katapult",
            height_in: katGuy.height_inches,
            owner: katGuy.owner,
            katapult_id: katGuy.id
          });
          
          console.log(`❌ Unmatched Katapult guy: ${katGuy.owner} @ ${katGuy.height_inches}" (raw: ${katGuy.raw_height}")`);
          
          // Debug: Check for near misses (1-3" difference)
          spidaGuys.forEach(spidaGuy => {
            if (spidaGuy.owner === katGuy.owner) {
              const heightDiff = Math.abs(spidaGuy.height_inches - katGuy.height_inches);
              if (heightDiff >= 1 && heightDiff <= 3) {
                console.debug(`📏 Near miss: ${katGuy.owner} Katapult ${katGuy.height_inches}" vs SPIDA ${spidaGuy.height_inches}" (diff: ${heightDiff}")`);
              }
            }
          });
        }
      });
      
      // Process unmatched SPIDA guys
      spidaGuys.forEach(spidaGuy => {
        const key = `${spidaGuy.owner}|${spidaGuy.height_inches}`;
        if (!matchedSpidaKeys.has(key)) {
          results.push({
            status: "unmatched_spida",
            height_in: spidaGuy.height_inches,
            owner: spidaGuy.owner,
            spida_id: spidaGuy.id
          });
          
          console.log(`❌ Unmatched SPIDA guy: ${spidaGuy.owner} @ ${spidaGuy.height_inches}" (raw: ${spidaGuy.raw_height_meters}m)`);
        }
      });
      
      return results;
    };

  // Extract pole tag from SPIDA pole label (e.g., "8-PL239434" → "PL239434")
  const extractPoleTag = (poleLabel: string): string => {
    // Remove any prefix numbers and hyphens to get the pure pole tag
    const match = poleLabel.match(/([A-Z]+\d+)/);
    return match ? match[1] : poleLabel;
  };

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

  // Fallback owner heuristics for equipment types
  const ownerFromEquipmentType = (equipmentType: string): string => {
    const lowerType = equipmentType.toLowerCase();
    if (lowerType.includes('drip') || lowerType.includes('loop')) return 'cps';
    if (lowerType.includes('communication') || lowerType.includes('service') || lowerType.includes('comm')) return 'charter';
    if (lowerType.includes('street') || lowerType.includes('light')) return 'city';
    if (lowerType.includes('guy') || lowerType.includes('guying')) return 'cps'; // Utilities typically own guys
    return 'unknown';
  };

  // Helper to map equipment types for better matching
  const mapEquipmentType = (type: string): string => {
    const lowerType = type.toLowerCase();
    
    // Distinguish between different communication infrastructure types
    if (lowerType.includes('bundle') || lowerType.includes('messenger')) {
      return 'communication_bundle'; // Backbone infrastructure
    }
    if (lowerType.includes('drop') || lowerType.includes('service') || 
        lowerType.includes('svc') || lowerType === 'comm svc' || 
        lowerType === 'drop-wire') {
      return 'communication_drop'; // Customer connections
    }
    if (lowerType.includes('communication') || lowerType.includes('comm')) {
      // Generic communication - check for more specific indicators
      if (lowerType.includes('cable') && !lowerType.includes('drop')) {
        return 'communication_bundle'; // Likely backbone cable
      }
      return 'communication_generic'; // Unknown communication type
    }
    
    // Other equipment types
    if (lowerType.includes('drip') || lowerType.includes('loop')) return 'drip_loop';
    // Handle canonical guy types from Katapult and normalize SPIDA guy types
    if (lowerType.includes('guy') || lowerType === 'guy' || lowerType === 'down_guy') return 'guy'; 
    if (lowerType.includes('street') && lowerType.includes('light')) return 'street_light';
    if (lowerType.includes('transformer')) return 'transformer';
    return lowerType;
  };

  // Helper to check if two attachments are the same (ignoring height)
  const sameAttachment = (a: Attachment, b: Attachment): boolean => {
    const normalizedAOwner = normalizeOwner(a.owner);
    const normalizedBOwner = normalizeOwner(b.owner);
    const sameOwner = normalizedAOwner === normalizedBOwner || 
                     normalizedAOwner === 'unknown' || normalizedBOwner === 'unknown';
    
    const aType = a.type.toLowerCase();
    const bType = b.type.toLowerCase();
    
    // Enhanced type matching for equipment
    const aMappedType = mapEquipmentType(aType);
    const bMappedType = mapEquipmentType(bType);
    
    // Log communication attachment comparisons for debugging
    if (aMappedType.includes('communication') || bMappedType.includes('communication')) {
      console.log(`📡 Communication attachment comparison:`, {
        spida: { type: aType, mappedType: aMappedType, owner: normalizedAOwner, description: a.description },
        katapult: { type: bType, mappedType: bMappedType, owner: normalizedBOwner, description: b.description },
        sameOwner,
        sameType: aMappedType === bMappedType,
        wouldMatch: sameOwner && aMappedType === bMappedType
      });
    }
    
    const sameType = aType.includes(bType) || bType.includes(aType) ||
                    aMappedType === bMappedType ||
                    (aType.includes('insulator') && (bType.includes('wire') || bType.includes('cable'))) ||
                    (bType.includes('insulator') && (aType.includes('wire') || aType.includes('cable')));
    
    return sameOwner && sameType;
  };

  // Helper to check if two attachments have the same height (within tolerance)
  const sameHeight = (a: Attachment, b: Attachment): boolean => {
    // Dynamic height tolerance based on attachment type
    const aType = mapEquipmentType(a.type);
    const bType = mapEquipmentType(b.type);
    const ftToM = (ft: number) => ft * 0.3048;
    
    // Higher tolerance for communication drops (customer connections can vary more)
    // Lower tolerance for communication bundles (backbone infrastructure is more precisely placed)
    const HEIGHT_TOLERANCE_M =
      (aType === 'communication_drop' || bType === 'communication_drop')
        ? ftToM(1.0) // 1 foot tolerance for drops
        : (aType === 'communication_bundle' || bType === 'communication_bundle')
        ? ftToM(0.5) // 6 inch tolerance for bundles
        : (aType === 'communication_generic' || bType === 'communication_generic')
        ? ftToM(1.0) // 1 foot tolerance for unknown communication types
        : ftToM(0.5); // 6 inch tolerance for other equipment
        
    return Math.abs(a.height - b.height) < HEIGHT_TOLERANCE_M;
  };

  // ════════════════════════════════════════════════════════════
  // MOVEMENT/RELOCATION PROCESSING FUNCTIONS
  // ════════════════════════════════════════════════════════════

  // Process mr_move field and generate movement description
  const processMrMove = (mrMoveRaw: any): {
    mrMove: number | undefined;
    moveDirection: 'up' | 'down' | 'none';
    moveDescription: string;
  } => {
    // Handle missing or invalid mr_move data
    if (mrMoveRaw === undefined || mrMoveRaw === null) {
      return {
        mrMove: undefined,
        moveDirection: 'none',
        moveDescription: 'No relocation data'
      };
    }

    // Convert to number and validate
    const mrMoveInches = typeof mrMoveRaw === 'number' ? mrMoveRaw : parseFloat(mrMoveRaw);
    
    if (isNaN(mrMoveInches)) {
      console.warn(`Invalid mr_move value: ${mrMoveRaw}`);
      return {
        mrMove: undefined,
        moveDirection: 'none',
        moveDescription: 'Invalid relocation data'
      };
    }

    // Handle zero movement
    if (Math.abs(mrMoveInches) < 0.1) {
      return {
        mrMove: 0,
        moveDirection: 'none',
        moveDescription: 'No vertical relocation'
      };
    }

    // Determine direction
    const direction: 'up' | 'down' = mrMoveInches > 0 ? 'up' : 'down';
    const absInches = Math.abs(mrMoveInches);
    
    // Convert to feet/inches and meters
    const feet = Math.floor(absInches / 12);
    const inches = Math.round(absInches % 12);
    const meters = absInches * 0.0254;
    
    // Build description
    let description = direction === 'up' ? 'Raised ' : 'Lowered ';
    
    if (feet > 0) {
      description += `${feet}' ${inches}"`;
    } else {
      description += `${inches}"`;
    }
    
    description += ` (${absInches}" ≈ ${meters.toFixed(2)}m)`;
    
    return {
      mrMove: mrMoveInches,
      moveDirection: direction,
      moveDescription: description
    };
  };

  useEffect(() => {
    if (!spidaData || !katapultData) {
      setComparisonResults([]); // Clear results if files are missing
      setWarnings([]); // Clear warnings
      return;
    }

    try {
      setWarnings([]); // Clear previous warnings
      const katapultMap = parseKatapultData(katapultData);
      
      console.log('Katapult parsing complete:', {
        polesFound: katapultMap.size,
        poleIds: Array.from(katapultMap.keys())
      });
      
      const results = poleLocations.map(spidaPole => {
        // Normalise the pole tag using the shared helper
        const poleTag = extractPoleTag(spidaPole.label);
        const katapultPoleData = katapultMap.get(poleTag) || { existing: [], proposed: [] };

        console.log(`Matching pole ${spidaPole.label} (tag: ${poleTag}):`, {
          found: katapultMap.has(poleTag),
          existingCount: katapultPoleData.existing.length,
          proposedCount: katapultPoleData.proposed.length
        });

        const measuredDesign = spidaPole.designs.find(d => /measured|field/.test(d.label.toLowerCase()));
        const recommendedDesign = spidaPole.designs.find(d => d.label.toLowerCase().includes('recommended'));

        // Bucket the data sets for fallback logic
        const spidaMeasured = measuredDesign?.attachments || [];
        const spidaRecommended = recommendedDesign?.attachments || [];
        const katapultProposed = katapultPoleData.proposed;

        // Filter Recommended to show only NEW or MODIFIED attachments
        const recommendedChanges = spidaRecommended.filter(rec => {
          const twin = spidaMeasured.find(mea => sameAttachment(rec, mea));
          
          // ① brand-new attachment
          if (!twin) return true;
          
          // ② modified height
          return !sameHeight(rec, twin);
        });

        // Debug logging to verify cross-arm indicators in recommended changes
        console.log(`🔍 Pole ${spidaPole.label} recommended changes:`, {
          total: recommendedChanges.length,
          withCrossArmIndicators: recommendedChanges.filter(rec => rec.description.includes('🔧')).length,
          crossArmItems: recommendedChanges.filter(rec => rec.description.includes('🔧')).map(rec => ({
            type: rec.type,
            description: rec.description
          }))
        });

        // Build enhanced comparison rows focusing on changes/new items
        const enhancedProposedComparison: EnhancedComparison[] = [];

        // 1. Process SPIDA recommended changes (modifications and new SPIDA items)
        recommendedChanges.forEach(recAttachment => {
          // First try to find matching Katapult EXISTING item (most common case)
          let katMatch = katapultPoleData.existing.find(kat => 
            sameAttachment(recAttachment, kat)
          );
          
          // Only fall back to PROPOSED if no existing match found (truly new items)
          if (!katMatch) {
            katMatch = katapultProposed.find(kat => 
              sameAttachment(recAttachment, kat)
            );
          }

          // Determine change type
          const measuredTwin = spidaMeasured.find(mea => sameAttachment(recAttachment, mea));
          const changeType = measuredTwin ? 'height-change' : 'brand-new';
          const measuredHeight = measuredTwin?.height;

          // Add parentInsulatorId and poleScid for nesting logic, preserving all original data
          const enhancedSpida = {
            ...recAttachment, // This preserves the cross-arm indicators and all other original data
            id: recAttachment.id || `spida-rec-${enhancedProposedComparison.length}`,
            poleScid: spidaPole.label,
            parentInsulatorId: recAttachment.parentInsulatorId, // Preserve parent insulator ID for hierarchical display
          };

          // Debug logging to verify cross-arm indicators are preserved
          if (recAttachment.description.includes('🔧')) {
            console.log(`🔧 Cross-arm indicator preserved in enhanced comparison for ${recAttachment.type}: ${recAttachment.description}`);
          }

          enhancedProposedComparison.push({
            katapult: katMatch || null,
            spida: enhancedSpida,
            sourceLabel: changeType === 'brand-new' ? 'NEW' : 
                        changeType === 'height-change' ? `Δ (was ${measuredHeight?.toFixed(1)}ft)` : 
                        'RECOMMENDED',
            changeType: changeType,
            measuredHeight: measuredHeight
          });
        });

        // 2. Process Katapult proposed attachments that don't have SPIDA counterparts (NEW Katapult proposals)
        katapultProposed.forEach(katProposed => {
          // Check if this Katapult proposed attachment already has a SPIDA match
          const hasSpidaMatch = enhancedProposedComparison.some(comp => comp.katapult === katProposed);
          
          if (!hasSpidaMatch) {
            // This is a NEW Katapult proposal with no SPIDA counterpart
            const enhancedKatapult = {
              ...katProposed, // This preserves any cross-arm indicators and all other original data
              id: katProposed.id || `kat-prop-${enhancedProposedComparison.length}`,
              poleScid: spidaPole.label
            };

            enhancedProposedComparison.push({
              katapult: enhancedKatapult,
              spida: null, // No SPIDA counterpart
              sourceLabel: 'KATAPULT NEW',
              changeType: 'brand-new',
              measuredHeight: undefined
            });
          }
        });

        // ═══ NORMALIZED ATTACHMENT POINT COMPARISON ═══
        let attachmentPointComparisons: AttachmentPointComparison[] = [];
        
        try {
          // Build SPIDA attachment points from measured design
          const measuredStructure = measuredDesign ? 
            spidaPole.designs.find(d => d.label === measuredDesign.label) : null;
          
          let spidaAttachmentPoints: AttachmentPoint[] = [];
          if (measuredStructure) {
            // We need to access the original structure data, which requires parsing again
            // For now, let's skip the attachment point comparison until we refactor the parsing
            console.log('📍 SPIDA attachment point building temporarily disabled - needs structure access');
          }
          
          // Build Katapult attachment points
          const katapultAttachmentPoints = buildKatapultAttachmentPoints(
            katapultPoleData.existing, 
            poleTag,
            [] // No existing insulators from Katapult for now
          );
          
          // Demo: Create mock SPIDA attachment points to show the concept
          // In a full implementation, these would come from buildSpidaAttachmentPoints()
          if (spidaMeasured.length > 0) {
            const mockSpidaPoints: AttachmentPoint[] = spidaMeasured
              .filter(att => att.type.toLowerCase().includes('insulator'))
              .map(att => ({
                id: att.id || `spida-${att.type}`,
                source: 'spida' as const,
                owner: att.owner.toLowerCase().replace(/[^a-z]/g, ''),
                description: att.description,
                height: att.height,
                wires: [], // Would be populated from structure data
                synthetic: false,
                poleScid: poleTag,
                originalData: att
              }));
            
            spidaAttachmentPoints = mockSpidaPoints;
            
            console.log(`📍 Created ${mockSpidaPoints.length} mock SPIDA attachment points for demo`);
          }
          
          console.log(`📍 Pole ${spidaPole.label} attachment points:`, {
            spidaPoints: spidaAttachmentPoints.length,
            katapultPoints: katapultAttachmentPoints.length,
            katapultSynthetic: katapultAttachmentPoints.filter(p => p.synthetic).length
          });
          
          // Compare attachment points only if we have data from both systems
          if (spidaAttachmentPoints.length > 0 && katapultAttachmentPoints.length > 0) {
            attachmentPointComparisons = compareAttachmentPoints(
              spidaAttachmentPoints, 
              katapultAttachmentPoints
            );
            
            console.log(`📍 Pole ${spidaPole.label} attachment point matches:`, {
              total: attachmentPointComparisons.length,
              exact: attachmentPointComparisons.filter(c => c.matchType === 'exact').length,
              heightOnly: attachmentPointComparisons.filter(c => c.matchType === 'height-only').length,
              spidaOnly: attachmentPointComparisons.filter(c => c.matchType === 'spida-only').length,
              katapultOnly: attachmentPointComparisons.filter(c => c.matchType === 'katapult-only').length
            });
          }
        } catch (error) {
          console.error(`Error building attachment points for pole ${spidaPole.label}:`, error);
          addWarning(`Failed to build attachment points for pole ${spidaPole.label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // ═══ PRODUCTION GUY MATCHING ═══
        const guyMatchResults = matchGuysForPole(spidaPole, katapultData);
        const allGuysMatch = guyMatchResults.every(result => result.status === 'matched');
        
        console.log(`🎯 Pole ${spidaPole.label} guy matching:`, {
          totalGuys: guyMatchResults.length,
          matched: guyMatchResults.filter(r => r.status === 'matched').length,
          unmatchedKatapult: guyMatchResults.filter(r => r.status === 'unmatched_katapult').length,
          unmatchedSpida: guyMatchResults.filter(r => r.status === 'unmatched_spida').length,
          allMatch: allGuysMatch
        });

        // ═══ COMMUNICATION ATTACHMENT SUMMARY ═══
        const allAttachments = [...spidaMeasured, ...spidaRecommended, ...katapultPoleData.existing, ...katapultPoleData.proposed];
        const commAttachments = allAttachments.filter(att => {
          const mappedType = mapEquipmentType(att.type);
          return mappedType.includes('communication');
        });
        
        const commSummary = {
          total: commAttachments.length,
          bundles: commAttachments.filter(att => mapEquipmentType(att.type) === 'communication_bundle').length,
          drops: commAttachments.filter(att => mapEquipmentType(att.type) === 'communication_drop').length,
          generic: commAttachments.filter(att => mapEquipmentType(att.type) === 'communication_generic').length,
          bySource: {
            spidaMeasured: spidaMeasured.filter(att => mapEquipmentType(att.type).includes('communication')).length,
            spidaRecommended: spidaRecommended.filter(att => mapEquipmentType(att.type).includes('communication')).length,
            katapultExisting: katapultPoleData.existing.filter(att => mapEquipmentType(att.type).includes('communication')).length,
            katapultProposed: katapultPoleData.proposed.filter(att => mapEquipmentType(att.type).includes('communication')).length
          }
        };
        
        if (commSummary.total > 0) {
          console.log(`📡 Pole ${spidaPole.label} communication attachment summary:`, commSummary);
          
          // Add user-friendly warning about communication attachment separation
          if (commSummary.bundles > 0 && commSummary.drops > 0) {
            addWarning(`Pole ${spidaPole.label}: Found ${commSummary.bundles} communication bundle(s) and ${commSummary.drops} communication drop(s). These are treated as different types and will not be matched together.`);
          } else if (commSummary.bundles > 0) {
            console.log(`📡 Pole ${spidaPole.label}: Found ${commSummary.bundles} communication bundle(s) (backbone infrastructure)`);
          } else if (commSummary.drops > 0) {
            console.log(`📡 Pole ${spidaPole.label}: Found ${commSummary.drops} communication drop(s) (customer connections)`);
          }
          
          if (commSummary.generic > 0) {
            addWarning(`Pole ${spidaPole.label}: Found ${commSummary.generic} communication attachment(s) that could not be categorized as bundles or drops. Check the descriptions for accuracy.`);
          }
        }

        // ═══ CROSS-ARM MAPPING ═══
        let crossArmMatches: Array<{
          spidaGroup: import('./crossArmMapper').CrossArmGroup | null;
          katapultGroup: import('./crossArmMapper').CrossArmGroup | null;
          heightDifferenceFt?: number;
          matchType: 'exact' | 'close' | 'spida-only' | 'katapult-only';
        }> = [];
        
        try {
          // Extract SPIDA cross-arm wiring from measured design structure
          let spidaCrossArmWiring: any[] = [];
          if (measuredDesign?.originalStructure) {
            // Now we have access to the original structure data for cross-arm extraction
            const structure = measuredDesign.originalStructure;
            
            console.log(`🔧 Attempting cross-arm extraction for pole ${spidaPole.label}:`, {
              hasStructure: !!structure,
              hasCrossArms: !!structure.crossArms,
              hasInsulators: !!structure.insulators,
              hasWires: !!structure.wires,
              crossArmsCount: structure.crossArms?.length || 0,
              insulatorsCount: structure.insulators?.length || 0,
              wiresCount: structure.wires?.length || 0,
              crossArmIds: structure.crossArms?.map((arm: any) => arm.id) || [],
              insulatorIds: structure.insulators?.map((ins: any) => ins.id) || []
            });
            
            spidaCrossArmWiring = extractSpidaCrossArmWiring(structure);
            
            console.log(`🔧 Cross-arm extraction result for pole ${spidaPole.label}:`, {
              extractedWiring: spidaCrossArmWiring.length,
              wiringDetails: spidaCrossArmWiring.map(w => ({
                crossArmId: w.crossArmId,
                insulatorId: w.insulatorId,
                wireId: w.wireId,
                height: w.crossArmHt
              }))
            });
          } else {
            console.log(`🔧 No original structure data available for pole ${spidaPole.label}:`, {
              hasMeasuredDesign: !!measuredDesign,
              hasOriginalStructure: !!measuredDesign?.originalStructure
            });
          }
          
          // Extract Katapult cross-arm wiring with pseudo cross-arms
          const katapultCrossArmWiring = extractKatapultCrossArmWiring(
            katapultData, 
            poleTag,
            katapultData.traces?.trace_data || {}
          );
          
          // Process cross-arm mapping if we have data from either system
          if (spidaCrossArmWiring.length > 0 || katapultCrossArmWiring.length > 0) {
            console.log(`🔧 Pole ${spidaPole.label} cross-arm mapping:`, {
              spidaWiring: spidaCrossArmWiring.length,
              katapultWiring: katapultCrossArmWiring.length,
              spidaArms: new Set(spidaCrossArmWiring.map(w => w.crossArmId)).size,
              katapultPseudoArms: new Set(katapultCrossArmWiring.map(w => w.crossArmId)).size
            });
            
            // Group wiring by cross-arms for each system separately
            const allGroups = groupWiringByCrossArm(spidaCrossArmWiring, katapultCrossArmWiring);
            const spidaGroups = allGroups.filter(g => g.system === 'SPIDA');
            const katapultGroups = allGroups.filter(g => g.system === 'Katapult');
            
            // Match cross-arms between systems
            crossArmMatches = matchCrossArms(spidaGroups, katapultGroups, 1.0);
            
            console.log(`🔧 Pole ${spidaPole.label} cross-arm matches:`, {
              totalMatches: crossArmMatches.length,
              exact: crossArmMatches.filter(m => m.matchType === 'exact').length,
              close: crossArmMatches.filter(m => m.matchType === 'close').length,
              spidaOnly: crossArmMatches.filter(m => m.matchType === 'spida-only').length,
              katapultOnly: crossArmMatches.filter(m => m.matchType === 'katapult-only').length
            });
          }
        } catch (error) {
          console.error(`Error processing cross-arms for pole ${spidaPole.label}:`, error);
          addWarning(`Failed to process cross-arms for pole ${spidaPole.label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // ═══ HEIGHT VALIDATION ═══
        // Check for physically impossible heights (higher than pole + reasonable buffer)
        const poleHeight = measuredDesign?.pole.height.value || 0;
        const poleHeightFt = poleHeight * 3.28084; // Convert to feet
        const maxReasonableHeight = poleHeightFt + 5; // 5-foot buffer above pole top
        
        const suspiciousAttachments = [
          ...spidaMeasured,
          ...spidaRecommended
        ].filter(att => {
          const attHeightFt = att.height * 3.28084;
          return attHeightFt > maxReasonableHeight;
        });
        
        if (suspiciousAttachments.length > 0) {
          console.warn(`🚨 Pole ${spidaPole.label} has ${suspiciousAttachments.length} attachments higher than pole (${poleHeightFt.toFixed(1)}ft):`, 
            suspiciousAttachments.map(att => ({
              type: att.type,
              description: att.description,
              heightFt: (att.height * 3.28084).toFixed(1),
              id: att.id
            }))
          );
          
          // Add warning for UI
          addWarning(`Pole ${spidaPole.label}: Found ${suspiciousAttachments.length} attachments higher than the pole height (${poleHeightFt.toFixed(1)}ft). This may indicate a parsing error.`);
        }

        return {
          poleLabel: spidaPole.label,
          poleInfo: {
            species: measuredDesign?.pole.species,
            classOfPole: measuredDesign?.pole.classOfPole,
            height: measuredDesign?.pole.height.value
          },
          spidaMeasured: spidaMeasured,
          katapultExisting: katapultPoleData.existing,
          spidaRecommended: spidaRecommended,
          katapultProposed: katapultPoleData.proposed,
          enhancedProposedComparison: enhancedProposedComparison,
          guyMatchResults: guyMatchResults, // Add guy matching results
          attachmentPointComparisons: attachmentPointComparisons, // Add attachment point comparisons
          crossArmMatches: crossArmMatches // Add cross-arm mapping results
        };
      });
      setComparisonResults(results);

      // ═══ PRODUCTION GUY MATCHING SUMMARY ═══
      const allGuyResults = results.flatMap(r => r.guyMatchResults || []);
      const totalGuys = allGuyResults.length;
      const matchedGuys = allGuyResults.filter(r => r.status === 'matched').length;
      const unmatchedKatapult = allGuyResults.filter(r => r.status === 'unmatched_katapult').length;
      const unmatchedSpida = allGuyResults.filter(r => r.status === 'unmatched_spida').length;
      const allGuysMatch = totalGuys > 0 && matchedGuys === totalGuys;

      console.log('🎯 PRODUCTION GUY MATCHING SUMMARY:', {
        totalGuys,
        matched: matchedGuys,
        unmatchedKatapult,
        unmatchedSpida,
        allMatch: allGuysMatch,
        exitCode: allGuysMatch ? 0 : 1
      });

      if (totalGuys > 0) {
        console.log(`📋 Guy matching result: ${allGuysMatch ? 'PASS ✅' : 'FAIL ❌'} (${matchedGuys}/${totalGuys} matched)`);
      }

      // ═══ COMMUNICATION ATTACHMENT GLOBAL SUMMARY ═══
      const allCommAttachments = results.flatMap(r => [
        ...r.spidaMeasured,
        ...r.spidaRecommended,
        ...r.katapultExisting,
        ...r.katapultProposed
      ]).filter(att => {
        const mappedType = mapEquipmentType(att.type);
        return mappedType.includes('communication');
      });
      
      if (allCommAttachments.length > 0) {
        const globalCommSummary = {
          total: allCommAttachments.length,
          bundles: allCommAttachments.filter(att => mapEquipmentType(att.type) === 'communication_bundle').length,
          drops: allCommAttachments.filter(att => mapEquipmentType(att.type) === 'communication_drop').length,
          generic: allCommAttachments.filter(att => mapEquipmentType(att.type) === 'communication_generic').length
        };
        
        console.log('📡 COMMUNICATION ATTACHMENT GLOBAL SUMMARY:', globalCommSummary);
        console.log('📡 Communication bundles and drops are now properly separated and will not be incorrectly matched together.');
      }

      // ═══ PROPOSED MOVES GLOBAL SUMMARY ═══
      const allAttachmentsWithMovement = results.flatMap(r => [
        ...r.katapultExisting,
        ...r.katapultProposed
      ]).filter(att => att.mrMove !== undefined && att.moveDirection !== 'none');
      
      if (allAttachmentsWithMovement.length > 0) {
        const movementSummary = {
          totalMovements: allAttachmentsWithMovement.length,
          raised: allAttachmentsWithMovement.filter(att => att.moveDirection === 'up').length,
          lowered: allAttachmentsWithMovement.filter(att => att.moveDirection === 'down').length,
          byType: {} as Record<string, number>,
          byOwner: {} as Record<string, number>,
          averageMovement: 0,
          maxMovement: 0,
          minMovement: 0
        };
        
        // Calculate movement statistics
        const movements = allAttachmentsWithMovement.map(att => Math.abs(att.mrMove!));
        movementSummary.averageMovement = movements.reduce((a, b) => a + b, 0) / movements.length;
        movementSummary.maxMovement = Math.max(...movements);
        movementSummary.minMovement = Math.min(...movements);
        
        // Group by type and owner
        allAttachmentsWithMovement.forEach(att => {
          movementSummary.byType[att.type] = (movementSummary.byType[att.type] || 0) + 1;
          movementSummary.byOwner[att.owner] = (movementSummary.byOwner[att.owner] || 0) + 1;
        });
        
        console.log('🔄 PROPOSED MOVES GLOBAL SUMMARY:', movementSummary);
        console.log('🔄 Movement details by attachment:');
        allAttachmentsWithMovement.forEach(att => {
          console.log(`  • ${att.type} (${att.owner}) on pole ${att.poleScid}: ${att.moveDescription}`);
        });
        
        // Add user-friendly summary to warnings
        if (movementSummary.totalMovements > 0) {
          addWarning(`Found ${movementSummary.totalMovements} proposed movements: ${movementSummary.raised} raised, ${movementSummary.lowered} lowered. Average movement: ${movementSummary.averageMovement.toFixed(1)}"`);
        }
      } else {
        console.log('🔄 No proposed movements found in Make-Ready data');
      }

    } catch (err) {
      setError('An error occurred during data comparison.');
      console.error('Comparison error:', err);
    }
  }, [spidaData, katapultData, poleLocations]);

  // Effect to handle external data from Data Management page
  useEffect(() => {
    if (externalSpidaJson) {
      try {
        setSpidaData(externalSpidaJson);
        const parsedLocations = parseSpidaData(externalSpidaJson);
        setPoleLocations(parsedLocations);
        setError(null);
      } catch (err) {
        setError('Failed to process external SPIDA data.');
        console.error('External SPIDA data processing error:', err);
      }
    }
  }, [externalSpidaJson]);

  useEffect(() => {
    if (externalKatapultJson) {
      try {
        setKatapultData(externalKatapultJson);
        setError(null);
      } catch (err) {
        setError('Failed to process external Katapult data.');
        console.error('External Katapult data processing error:', err);
      }
    }
  }, [externalKatapultJson]);

  const parseSpidaData = (data: SpidaCalcData): PoleLocationData[] => {
    if (!data.leads || !Array.isArray(data.leads)) return [];
    return data.leads.flatMap((lead: any) =>
      lead.locations.map((location: any) => ({
        label: location.label,
        designs: location.designs.map((design: any) => {
          const { structure } = design;
          const attachments: Attachment[] = [];
          const namingWarnings: string[] = [];
          
          // Build cross-arm ID set for safe cross-arm detection
          const crossArmIds = buildCrossArmIdSet(structure);
          
          // Build cross-arm to insulator mapping and cross-arm heights FIRST
          const crossArmHeights = new Map<string, number>();
          const insulatorToCrossArmId = new Map<string, string>();
          if (structure.crossArms) {
            structure.crossArms.forEach((arm: any) => {
              // Calculate cross-arm height
              const rawHeight = arm.attachmentHeight?.value ?? arm.offset?.value ?? 0;
              const unit = (arm.attachmentHeight?.unit ?? arm.offset?.unit ?? 'METRE') as Unit;
              const armHeightInMetres = toMetres(rawHeight, unit);
              crossArmHeights.set(arm.id, armHeightInMetres);
              
              // Map insulators to this cross-arm
              if (Array.isArray(arm.insulators)) {
                arm.insulators.forEach((insulatorId: string) => {
                  insulatorToCrossArmId.set(insulatorId, arm.id);
                });
              }
            });
          }
          
          // Add cross-arms as standalone attachments
          if (structure.crossArms) {
            structure.crossArms.forEach((arm: any) => {
              // Use the already calculated cross-arm height for consistency
              const heightInMetres = crossArmHeights.get(arm.id) || 0;
              
              // Collect warning if no height data available
              if (heightInMetres === 0) {
                addWarning(`Cross-arm ${arm.id} on pole ${location.label} has no height data`);
              }
              
              // Use robust naming helper
              const namingResult = buildCrossArmDescription(arm);
              namingWarnings.push(...namingResult.warnings);
              
              console.log(`🔧 Cross-arm ${arm.id} final height: ${heightInMetres.toFixed(3)}m`);
              
              // Add cross-arms as standalone elements
              attachments.push({
                id: arm.id,
                type: 'Cross-arm',
                owner: arm.owner?.id || structure.pole?.owner?.id || 'CPS',
                description: namingResult.displayName,
                height: heightInMetres,
                poleScid: location.label
              });
            });
          }

          // Calculate heights for insulators and wires with parent-child relationships
          const wireToInsulatorHeight = new Map<string, number>();
          const wireToInsulatorId = new Map<string, string>();
          
          if (structure.insulators) {
            structure.insulators.forEach((ins: any) => {
              // Check if this insulator is on a cross-arm
              const parentCrossArmId = insulatorToCrossArmId.get(ins.id);
              let heightInMetres: number;
              
              if (parentCrossArmId && crossArmHeights.has(parentCrossArmId)) {
                // Use cross-arm height for insulators mounted on cross-arms
                heightInMetres = crossArmHeights.get(parentCrossArmId)!;
                console.log(`🔧 Insulator ${ins.id} using cross-arm ${parentCrossArmId} height: ${heightInMetres.toFixed(3)}m`);
              } else {
                // Use insulator's direct height for pole-mounted insulators
                const rawHeight = ins.offset?.value ?? ins.attachmentHeight?.value ?? 0;
                const unit = (ins.attachmentHeight?.unit ?? ins.offset?.unit ?? 'METRE') as Unit;
                heightInMetres = toMetres(rawHeight, unit);
                console.log(`🔧 Insulator ${ins.id} using direct height: ${heightInMetres.toFixed(3)}m`);
              }
              
              // Map wires to this insulator's height and ID for parent-child relationships
              if (Array.isArray(ins.wires)) {
                ins.wires.forEach((wireId: string) => {
                  wireToInsulatorHeight.set(wireId, heightInMetres);
                  wireToInsulatorId.set(wireId, ins.id);
                });
              }
            });
          }

          if (structure.wires) {
            structure.wires.forEach((w: any) => {
              // Check if wire is connected to an insulator (height already in metres)
              const insulatorHeight = wireToInsulatorHeight.get(w.id);
              const parentInsulatorId = wireToInsulatorId.get(w.id);
              let displayHeight: number;
              
              if (insulatorHeight !== undefined) {
                // Use insulator height (which may be cross-arm height if insulator is on cross-arm)
                displayHeight = insulatorHeight;
                console.log(`🔧 Wire ${w.id} using insulator ${parentInsulatorId} height: ${displayHeight.toFixed(3)}m`);
              } else {
                // Use wire's own height and convert to metres
                displayHeight = toMetres(w.attachmentHeight.value, (w.attachmentHeight.unit ?? 'METRE') as Unit);
                console.log(`🔧 Wire ${w.id} using direct height: ${displayHeight.toFixed(3)}m`);
              }
              
              // Enhanced communication service detection
              const isCommService = w.usageGroup?.toLowerCase().includes('comm') || 
                                  w.usageGroup?.toLowerCase().includes('service') ||
                                  w.usageGroup?.toLowerCase().includes('drop');
              
              // Use appropriate naming helper based on wire type
              let namingResult: NamingResult;
              if (isCommService) {
                namingResult = buildCommunicationDescription(w);
              } else {
                namingResult = buildWireDescription(w);
              }
              
              namingWarnings.push(...namingResult.warnings);
              
              attachments.push({ 
                id: w.id || `wire-${attachments.length}`,
                type: w.usageGroup, 
                owner: w.owner.id, 
                description: namingResult.displayName,
                height: displayHeight,
                parentInsulatorId: parentInsulatorId, // Assign parent insulator ID
                poleScid: location.label
              });
            });
          }
          if (structure.guys) {
            structure.guys.forEach((g: any) => {
              const namingResult = buildGuyDescription(g);
              namingWarnings.push(...namingResult.warnings);
              
              attachments.push({ 
                id: g.id || `guy-${attachments.length}`,
                type: 'Guy', 
                owner: g.owner.id, 
                description: namingResult.displayName, 
                height: toMetres(g.attachmentHeight.value, (g.attachmentHeight.unit ?? 'METRE') as Unit),
                poleScid: location.label
              });
            });
          }
          if (structure.equipments) {
            structure.equipments.forEach((equip: any) => {
              const namingResult = buildEquipmentDescription(equip);
              namingWarnings.push(...namingResult.warnings);
              
              attachments.push({ 
                id: equip.id || `equipment-${attachments.length}`,
                type: equip.clientItem.type, 
                owner: equip.owner.id, 
                description: namingResult.displayName, 
                height: toMetres(equip.attachmentHeight.value, (equip.attachmentHeight.unit ?? 'METRE') as Unit),
                poleScid: location.label
              });
            });
          }
          
          // Add pole top measurement from SPIDA structure.pole.agl
          if (structure.pole?.agl?.value) {
            const poleTopHeight = toMetres(structure.pole.agl.value, (structure.pole.agl.unit ?? 'METRE') as Unit);
            attachments.push({
              id: `pole-top-spida-${location.label}`,
              type: 'Pole Top',
              owner: 'N/A',
              description: 'Measured Pole Top (SPIDA)',
              height: poleTopHeight,
              poleScid: location.label
            });
          }
          
          if (structure.insulators) {
            structure.insulators.forEach((ins: any) => {
              let ownerId: string = ins.owner?.id || 'Unknown';

              if (Array.isArray(ins.wires) && structure.wires) {
                const matchedWire = structure.wires.find((w: any) => ins.wires.includes(w.id));
                if (matchedWire?.owner?.id) {
                  ownerId = matchedWire.owner.id;
                }
              }

              // Use robust naming helper with cross-arm safety
              const namingResult = buildInsulatorDescription(ins, crossArmIds);
              namingWarnings.push(...namingResult.warnings);

              // Check if this insulator is on a cross-arm and use appropriate height
              const parentCrossArmId = insulatorToCrossArmId.get(ins.id);
              let finalHeight: number;
              
              if (parentCrossArmId && crossArmHeights.has(parentCrossArmId)) {
                // Use cross-arm height for insulators mounted on cross-arms
                finalHeight = crossArmHeights.get(parentCrossArmId)!;
                console.log(`🔧 Insulator ${ins.id} final height from cross-arm ${parentCrossArmId}: ${finalHeight.toFixed(3)}m`);
              } else {
                // Use direct insulator height for pole-mounted insulators
                const rawHeight = ins.offset?.value ?? ins.attachmentHeight?.value ?? 0;
                const unit = (ins.attachmentHeight?.unit ?? ins.offset?.unit ?? 'METRE') as Unit;
                finalHeight = toMetres(rawHeight, unit);
                console.log(`🔧 Insulator ${ins.id} final height from direct measurement: ${finalHeight.toFixed(3)}m`);
              }
              
              attachments.push({
                id: ins.id || `insulator-${attachments.length}`,
                type: `Insulator`,
                owner: ownerId,
                description: namingResult.displayName,
                height: finalHeight,
                parentCrossArmId: parentCrossArmId, // Link to parent cross-arm
                poleScid: location.label
              });
            });
          }
          
          // Log all naming warnings for this pole
          logNamingWarnings(namingWarnings, location.label);
          
          return { 
            label: design.label, 
            pole: { ...structure.pole.clientItem }, 
            attachments,
            originalStructure: structure // NEW: Preserve original structure for cross-arm extraction
          };
        }),
      }))
    );
  };

  const parseKatapultData = (data: KatapultData): Map<string, { existing: Attachment[]; proposed: Attachment[] }> => {
    const katapultMap = new Map<string, { existing: Attachment[]; proposed: Attachment[] }>();
    if (!data.nodes || !data.photos || !data.traces?.trace_data) return katapultMap;

    Object.values(data.nodes).forEach((node: KatapultNode) => {
      const namingWarnings: string[] = [];
      
      // ────────────────────────────────────────────────────────────
      // Derive pole tag
      // ────────────────────────────────────────────────────────────
      const rawPoleTag =
        node.attributes.electric_pole_tag?.assessment ??
        Object.values(node.attributes.pole_tag ?? {})[0]?.tagtext ??
        node.attributes.scid?.auto_button ??
        '';

      const poleTag = extractPoleTag(rawPoleTag);
      if (!poleTag || !node.photos) return;

      // A node can have multiple photos with association "main" or true (e.g., front & back)
      const mainPhotoIds = Object.keys(node.photos).filter((p) => {
        const photo = node.photos?.[p];
        const assoc = photo?.association as any; // Handle mixed types from JSON
        return assoc === 'main' || assoc === true ||
               !!data.photos?.[p]?.photofirst_data; // last-chance catch-all
      });

      if (mainPhotoIds.length === 0) return;

      const existingAttachments: Attachment[] = [];
      const proposedAttachments: Attachment[] = [];
      const seenEquipment = new Set<string>(); // Track equipment to avoid duplicates across photos

      mainPhotoIds.forEach((photoId) => {
        const photoData = data.photos[photoId]?.photofirst_data;
        if (!photoData) return;

        // Pole top height
        if (photoData.pole_top) {
          const top = Object.values(photoData.pole_top)[0];
          if (top?._measured_height) {
            existingAttachments.push({
              id: `pole-top-katapult-${poleTag}`,
              type: 'Pole Top',
              owner: 'N/A',
              description: 'Measured Pole Top (Katapult)',
              height: top._measured_height * INCHES_TO_METRES,
              poleScid: poleTag
            });
          }
        }

        // Wire / cable / guy heights
        if (photoData.wire) {
          Object.values(photoData.wire).forEach((wire) => {
            const traceInfo = data.traces.trace_data[wire._trace];
            if (!traceInfo) return;

            // Use robust trace naming
            const traceNamingResult = buildKatapultTraceName(traceInfo);
            namingWarnings.push(...traceNamingResult.warnings);

            // Determine a readable attachment type
            let attachmentType = traceInfo.cable_type;
            if (!attachmentType) {
              switch (traceInfo._trace_type) {
                case 'down_guy':
                  attachmentType = 'Guy';
                  break;
                default:
                  attachmentType = traceInfo._trace_type || 'Unknown';
              }
            }

            const wireAttachment: Attachment = {
              type: attachmentType || 'Unknown',
              owner: normalizeForComparison(traceInfo.company || 'Unknown'),
              description: traceNamingResult.displayName,
              height: wire._measured_height * INCHES_TO_METRES,
            };

            if (traceInfo.proposed === true) {
              proposedAttachments.push(wireAttachment);
            } else {
              existingAttachments.push(wireAttachment);
            }
          });
        }

        // Extract equipment data from photoData.equipment
        if (photoData.equipment) {
          Object.values(photoData.equipment).forEach((equipment: any) => {
            if (equipment._measured_height && equipment._trace) {
              const traceInfo = data.traces.trace_data[equipment._trace];
              const owner = traceInfo?.company?.trim() || 'Unknown';
              
              // Use robust equipment naming
              const equipmentNamingResult = buildKatapultEquipmentName(
                equipment.equipment_type,
                owner,
                equipment.measurement_of
              );
              namingWarnings.push(...equipmentNamingResult.warnings);

              // Process movement/relocation data
              const moveData = processMrMove(equipment.mr_move);

              const equipmentAttachment: Attachment = {
                type: equipment.equipment_type ? 
                  equipment.equipment_type.charAt(0).toUpperCase() + equipment.equipment_type.slice(1).replace(/_/g, ' ') : 
                  'Equipment',
                owner: normalizeForComparison(owner),
                description: equipmentNamingResult.displayName,
                height: equipment._measured_height * INCHES_TO_METRES,
                mrMove: moveData.mrMove,
                moveDirection: moveData.moveDirection,
                moveDescription: moveData.moveDescription,
              };

              // Equipment is generally existing, not proposed
              existingAttachments.push(equipmentAttachment);
              
              // Log movement data if present
              if (moveData.mrMove !== undefined && moveData.moveDirection !== 'none') {
                console.log(`🔄 Equipment movement found: ${equipment.equipment_type} on ${poleTag} - ${moveData.moveDescription}`);
              }
            }
          });
        }

        // GOLDEN PATH GUY EXTRACTION - Add guys from direct photofirst_data.guying
        if (photoData.guying) {
          Object.entries(photoData.guying).forEach(([guyId, guyData]: [string, any]) => {
            if (!guyData._measured_height || !guyData._trace) return;
            
            const traceInfo = data.traces.trace_data[guyData._trace];
            if (!traceInfo) return;
            if (traceInfo.proposed === true) return; // Skip proposed

            // Use robust guy naming
            const guyNamingResult = buildKatapultGuyName(guyData, traceInfo);
            namingWarnings.push(...guyNamingResult.warnings);
            
            // Use standard 'Guy' type for main comparison table (not canonical types)
            const guyAttachment: Attachment = {
              type: 'Guy',
              owner: normalizeForComparison(traceInfo.company || 'cps'),
              description: guyNamingResult.displayName,
              height: guyData._measured_height * INCHES_TO_METRES,
            };

            existingAttachments.push(guyAttachment);

            console.log(`🔧 Added guy to main comparison: ${guyId} @ ${guyAttachment.height.toFixed(2)}m (${guyData._measured_height}")`);
          });
        }
      });

      // Extract photo-level attachments following Katapult workflow
      if (node.photos) {
        Object.keys(node.photos).forEach(photoId => {
          const photo = data.photos[photoId];
          if (!photo) return;

          // Navigate to the photofirst_data: photo.alternate_designs.designs.<designId>.data.photo.photofirst_data
          const activeDesign = photo.active_design;
          if (!activeDesign) return;
          
          const photofirstData = photo.alternate_designs?.designs?.[activeDesign]?.data?.photo?.photofirst_data;
          if (!photofirstData) return;

          // A. Process WIRE Category
          if (photofirstData.wire) {
            Object.entries(photofirstData.wire).forEach(([tagId, wireItem]: [string, any]) => {
              if (seenEquipment.has(tagId)) return;
              seenEquipment.add(tagId);

              if (!wireItem._measured_height || !wireItem._trace) return;

              const traceInfo = data.traces.trace_data[wireItem._trace];
              if (!traceInfo) return;

              const company = traceInfo.company || '';
              const cableType = traceInfo.cable_type || '';

              // C. Wire bucket fallback - Check if this is actually a guy
              const looksLikeGuy =
                wireItem.wire_type === 'guy_wire' ||
                traceInfo._trace_type === 'down_guy' ||
                traceInfo.cable_type?.toLowerCase().includes('guy');

              if (looksLikeGuy) {
                // Build canonical guy attachment
                const guyType = traceInfo._trace_type || traceInfo.cable_type || 'guy';
                const attachmentType = guyType.toLowerCase().includes('down') ? 'DOWN_GUY' : 'GUY';
                
                // Process movement/relocation data for guys
                const guyMoveData = processMrMove(wireItem.mr_move);
                
                const guyAttachment: Attachment = {
                  type: attachmentType,
                  owner: normalizeForComparison(company) || 'cps',
                  description: `${guyType} [Katapult wire-categorized guy]`,
                  height: wireItem._measured_height * INCHES_TO_METRES,
                  mrMove: guyMoveData.mrMove,
                  moveDirection: guyMoveData.moveDirection,
                  moveDescription: guyMoveData.moveDescription,
                };

                const isProposed = traceInfo?.proposed === true;
                (isProposed ? proposedAttachments : existingAttachments).push(guyAttachment);

                console.log(`🔍 Processed guy (from wire section) on pole ${poleTag}:`, {
                  tagId,
                  type: attachmentType,
                  company,
                  guyType,
                  height: wireItem._measured_height,
                  proposed: traceInfo.proposed,
                  moveData: guyMoveData.moveDirection !== 'none' ? guyMoveData.moveDescription : 'No movement'
                });

                // Log movement data if present
                if (guyMoveData.mrMove !== undefined && guyMoveData.moveDirection !== 'none') {
                  console.log(`🔄 Wire-categorized guy movement: ${guyType} (${tagId}) on ${poleTag} - ${guyMoveData.moveDescription}`);
                }
                return; // Skip normal wire processing
              }

              // Filter: Skip Primary cables
              if (cableType.toLowerCase() === 'primary') {
                console.log(`Skipping Primary cable ${tagId} on pole ${poleTag}`);
                return;
              }

              // Use robust trace naming
              const wireTraceNamingResult = buildKatapultTraceName(traceInfo);
              namingWarnings.push(...wireTraceNamingResult.warnings);

              // Process movement/relocation data
              const moveData = processMrMove(wireItem.mr_move);

              // Name Construction: "{Company} {Cable Type}"
              const attachmentType = `${company} ${cableType}`.trim();

              const wireAttachment: Attachment = {
                type: attachmentType,
                owner: normalizeForComparison(company) || 'unknown',
                description: `${wireTraceNamingResult.displayName} [Katapult wire]`,
                height: wireItem._measured_height * INCHES_TO_METRES,
                mrMove: moveData.mrMove,
                moveDirection: moveData.moveDirection,
                moveDescription: moveData.moveDescription,
              };

              // Fix 1: Use isProposed guard and default to existing
              const isProposed = traceInfo?.proposed === true;
              (isProposed ? proposedAttachments : existingAttachments).push(wireAttachment);

              console.log(`🔍 Processed wire on pole ${poleTag}:`, {
                tagId,
                type: attachmentType,
                company,
                cableType,
                height: wireItem._measured_height,
                proposed: traceInfo.proposed,
                moveData: moveData.moveDirection !== 'none' ? moveData.moveDescription : 'No movement'
              });

              // Log movement data if present
              if (moveData.mrMove !== undefined && moveData.moveDirection !== 'none') {
                console.log(`🔄 Wire-categorized equipment movement: ${attachmentType} (${tagId}) on ${poleTag} - ${moveData.moveDescription}`);
              }
            });
          }

          // B. Process EQUIPMENT Category
          if (photofirstData.equipment) {
            Object.entries(photofirstData.equipment).forEach(([tagId, equipItem]: [string, any]) => {
              if (seenEquipment.has(tagId)) return;
              seenEquipment.add(tagId);

              if (!equipItem._measured_height || !equipItem._trace) return;

              const traceInfo = data.traces.trace_data[equipItem._trace];
              if (!traceInfo) return;

              const company = traceInfo.company || '';
              const equipmentType = equipItem.equipment_type || '';

              // Use robust equipment naming
              const photoEquipNamingResult = buildKatapultEquipmentName(
                equipmentType,
                company,
                equipItem.measurement_of
              );
              namingWarnings.push(...photoEquipNamingResult.warnings);

              // Process movement/relocation data
              const moveData = processMrMove(equipItem.mr_move);

              const equipmentAttachment: Attachment = {
                type: photoEquipNamingResult.displayName,
                owner: normalizeForComparison(company) || ownerFromEquipmentType(equipmentType),
                description: `${photoEquipNamingResult.displayName} [Katapult equipment]`,
                height: equipItem._measured_height * INCHES_TO_METRES,
                mrMove: moveData.mrMove,
                moveDirection: moveData.moveDirection,
                moveDescription: moveData.moveDescription,
              };

              // Fix 1: Use isProposed guard and default to existing
              const isProposed = traceInfo?.proposed === true;
              (isProposed ? proposedAttachments : existingAttachments).push(equipmentAttachment);

              console.log(`🔍 Processed equipment on pole ${poleTag}:`, {
                tagId,
                type: photoEquipNamingResult.displayName,
                company,
                equipmentType,
                height: equipItem._measured_height,
                measurementOf: equipItem.measurement_of,
                proposed: traceInfo.proposed,
                moveData: moveData.moveDirection !== 'none' ? moveData.moveDescription : 'No movement'
              });

              // Log movement data if present
              if (moveData.mrMove !== undefined && moveData.moveDirection !== 'none') {
                console.log(`🔄 Photo-level equipment movement: ${equipmentType} (${tagId}) on ${poleTag} - ${moveData.moveDescription}`);
              }
            });
          }

          // C. Process GUYING Category
          if (photofirstData.guying) {
            Object.entries(photofirstData.guying).forEach(([tagId, guyItem]: [string, any]) => {
              if (seenEquipment.has(tagId)) return;
              seenEquipment.add(tagId);

              if (!guyItem._measured_height || !guyItem._trace) return;

              const traceInfo = data.traces.trace_data[guyItem._trace];
              if (!traceInfo) return;

              const company = traceInfo.company || '';
              
              // A. Fix field names - use guy_type instead of guying_type
              const guyType = guyItem.guy_type      // <-- was guying_type
                           || traceInfo._trace_type // "down_guy"
                           || traceInfo.cable_type  // sometimes "guy"
                           || 'guy';

              // B. Canonical type, never composite
              const attachmentType = guyType.toLowerCase().includes('down')
                ? 'DOWN_GUY'
                : 'GUY';

              // Process movement/relocation data
              const moveData = processMrMove(guyItem.mr_move);

              const description = `${guyType} [Katapult guying]`;

              const guyAttachment: Attachment = {
                type: attachmentType.trim(),
                owner: normalizeForComparison(company) || 'cps', // Default to utility
                description: description,
                height: guyItem._measured_height * INCHES_TO_METRES,
                mrMove: moveData.mrMove,
                moveDirection: moveData.moveDirection,
                moveDescription: moveData.moveDescription,
              };

              // Fix 1: Use isProposed guard and default to existing
              const isProposed = traceInfo?.proposed === true;
              (isProposed ? proposedAttachments : existingAttachments).push(guyAttachment);

              console.log(`🔍 Processed guying on pole ${poleTag}:`, {
                tagId,
                type: attachmentType,
                company,
                guyType,
                height: guyItem._measured_height,
                proposed: traceInfo.proposed,
                moveData: moveData.moveDirection !== 'none' ? moveData.moveDescription : 'No movement'
              });

              // Log movement data if present
              if (moveData.mrMove !== undefined && moveData.moveDirection !== 'none') {
                console.log(`🔄 Guy movement found: ${guyType} (${tagId}) on ${poleTag} - ${moveData.moveDescription}`);
              }
            });
          }
        });
      }

      // Count specific attachment types
      const commDrops = [...existingAttachments, ...proposedAttachments]
        .filter(a => a.type.toLowerCase().includes('communication') || a.type.toLowerCase().includes('service'));
      
      const guys = [...existingAttachments, ...proposedAttachments]
        .filter(a => a.type.toLowerCase().includes('guy'));

      // Quick verification - show guys found with canonical types
      console.log('Guys pushed:', existingAttachments.filter(a => a.type.includes('GUY')));

      console.log(`Pole ${poleTag} equipment extraction:`, {
        photoLevelItems: seenEquipment.size,
        existingCount: existingAttachments.length,
        proposedCount: proposedAttachments.length,
        commDropsFound: commDrops.length,
        commDropDetails: commDrops.map(cd => `${cd.type} (${cd.owner})`).join(', '),
        guysFound: guys.length,
        guyDetails: guys.map(g => `${g.description} (${g.owner})`).join(', '),
        existingTypes: existingAttachments.map(a => a.type).join(', '),
        proposedTypes: proposedAttachments.map(a => a.type).join(', ')
      });

      // Log all naming warnings for this pole
      logNamingWarnings(namingWarnings, poleTag);
      
      katapultMap.set(poleTag, { existing: existingAttachments, proposed: proposedAttachments });
    });

    return katapultMap;
  };

  const handleSpidaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const jsonData = JSON.parse(text);

        setSpidaData(jsonData);
        const parsedLocations = parseSpidaData(jsonData);
        setPoleLocations(parsedLocations);
        setLocalSpidaFileName(file.name);
        setError(null);
      } catch (err) {
        setError('Failed to parse SPIDAcalc JSON file. Please ensure it is a valid SPIDAcalc JSON.');
        setSpidaData(null);
        setPoleLocations([]);
        setLocalSpidaFileName(null);
      }
    };
    reader.readAsText(file);
  };

  const handleKatapultUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const jsonData = JSON.parse(text);

        // Basic validation of Katapult JSON structure
        if (typeof jsonData !== 'object' || jsonData === null) {
          throw new Error('Invalid JSON structure');
        }

        // Log structure for debugging
        console.log('Katapult JSON loaded successfully');
        console.log('Data structure check:', {
          hasNodes: !!jsonData.nodes,
          hasPhotos: !!jsonData.photos,
          hasTraces: !!jsonData.traces?.trace_data,
          nodeCount: jsonData.nodes ? Object.keys(jsonData.nodes).length : 0,
          photoCount: jsonData.photos ? Object.keys(jsonData.photos).length : 0,
          traceCount: jsonData.traces?.trace_data ? Object.keys(jsonData.traces.trace_data).length : 0
        });

        setKatapultData(jsonData);
        setLocalKatapultFileName(file.name);
        setError(null);
      } catch (err) {
        console.error('Katapult JSON parsing error:', err);
        setError(`Failed to parse Katapult JSON file: ${err instanceof Error ? err.message : 'Unknown error'}. Please ensure it is a valid JSON file.`);
        setKatapultData(null);
        setLocalKatapultFileName(null);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h2>SPIDAcalc vs. Katapult QC Tool</h2>
      
      {usingExternalData ? (
        <div>
          <p>Using JSON files from Data Management page to compare pole attachments.</p>
          
          {/* Show data status */}
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 8px 0', color: spidaData ? '#28a745' : '#6c757d' }}>
                SPIDAcalc Data {spidaData ? '✓' : '○'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.9em', color: '#6c757d' }}>
                {currentSpidaFileName || 'No SPIDA file loaded'}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 8px 0', color: katapultData ? '#28a745' : '#6c757d' }}>
                Katapult Data {katapultData ? '✓' : '○'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.9em', color: '#6c757d' }}>
                {currentKatapultFileName || 'No Katapult file loaded'}
              </p>
            </div>
          </div>
          
          {(!spidaData && !katapultData) && (
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, color: '#856404' }}>
                Please upload JSON files in the <strong>Data Management</strong> tab first.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p>Upload both your SPIDAcalc and Katapult JSON files to compare pole attachments.</p>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label htmlFor="spida-upload" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                SPIDAcalc JSON File:
              </label>
              <input id="spida-upload" type="file" accept=".json" onChange={handleSpidaUpload} />
            </div>
            
            <div>
              <label htmlFor="katapult-upload" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Katapult JSON File:
              </label>
              <input id="katapult-upload" type="file" accept=".json" onChange={handleKatapultUpload} />
            </div>
          </div>
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {warnings.length > 0 && (
        <div style={{ 
          margin: '16px 0', 
          padding: '12px', 
          backgroundColor: '#fef3c7', 
          border: '1px solid #f59e0b',
          borderRadius: '8px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#d97706' }}>⚠️ Parsing Warnings</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {warnings.map((warning, idx) => (
              <li key={idx} style={{ color: '#92400e', fontSize: '0.9em' }}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {spidaData && (
        <div style={{ marginTop: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Project Overview</h3>
            {comparisonResults.length > 0 && (
              <button
                onClick={() => downloadExcelReport(comparisonResults)}
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                title={`Export comparison data for ${comparisonResults.length} pole(s) to Excel`}
              >
                📊 Export to Excel
              </button>
            )}
          </div>
          <p><strong>SPIDA Project:</strong> {spidaData.label}</p>
          <p><strong>Katapult Project:</strong> {katapultData?.name || 'N/A'}</p>
          {comparisonResults.length > 0 && (
            <p><strong>Poles Analyzed:</strong> {comparisonResults.length}</p>
          )}
        </div>
      )}

      {comparisonResults.length > 0 ? (
        <div>
          {comparisonResults.map((result, index) => (
            <ComparisonPole key={index} result={result} />
          ))}
        </div>
      ) : (
        poleLocations.length > 0 && (
          <div>
            <h3 style={{ marginTop: '30px' }}>SPIDAcalc Data Loaded</h3>
            <p style={{ color: '#666' }}>
              {usingExternalData && !katapultData 
                ? 'Upload a Katapult JSON file in the Data Management tab to enable comparison.'
                : 'Upload a Katapult JSON file to enable comparison.'
              }
            </p>
            {poleLocations.map((pole, index) => (
              <PoleLocation key={index} pole={pole} />
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default SpidaQcTool;