// /components/SpidaQcTool/SpidaQcTool.tsx

import React, { useState, useEffect } from 'react';
import { SpidaCalcData, PoleLocationData, Attachment, KatapultData, ComparisonResult, KatapultNode, EnhancedComparison, MatchResult } from './types';
import PoleLocation from './PoleLocation';
import ComparisonPole from './ComparisonPole';
import { buildArmMaps, isInsulatorOnArm, isWireOnArm, getInsulatorArmId, getWireArmId, getArmGroundHeight, verifyCrossArmLogic, type ArmMaps } from './armHelpers';

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

  // Helper function to get proper insulator display name from SPIDA data
  const getInsulatorDisplayName = (insulatorId: string, spidaData: SpidaCalcData): string => {
    const match = insulatorId.match(/Insulator#(\d+)/);
    if (!match) return 'Unknown Insulator';
    
    const idx = parseInt(match[1], 10) - 1; // Fix off-by-one: SPIDA IDs are 1-based, arrays are 0-based
    const definition = spidaData.clientData?.insulators?.[idx];
    
    if (definition?.size) {
      return definition.size;
    }
    
    // Fallback to any available alias
    if (definition?.aliases?.[0]?.size) {
      return definition.aliases[0].size;
    }
    
    return 'Unknown Insulator';
  };

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
    // Enhanced communication service detection (Fix 3)
    if (lowerType.includes('communication') || 
        lowerType.includes('comm') || 
        lowerType.includes('service') || 
        lowerType.includes('drop') ||
        lowerType.includes('svc') ||
        lowerType === 'comm svc' ||
        lowerType === 'drop-wire') return 'communication_service';
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
    
    const sameType = aType.includes(bType) || bType.includes(aType) ||
                    aMappedType === bMappedType ||
                    (aType.includes('insulator') && (bType.includes('wire') || bType.includes('cable'))) ||
                    (bType.includes('insulator') && (aType.includes('wire') || aType.includes('cable')));
    
    return sameOwner && sameType;
  };

  // Helper to check if two attachments have the same height (within tolerance)
  const sameHeight = (a: Attachment, b: Attachment): boolean => {
    // Fix 4: Dynamic height tolerance for communication services (convert feet to metres)
    const aType = mapEquipmentType(a.type);
    const bType = mapEquipmentType(b.type);
    const ftToM = (ft: number) => ft * 0.3048;
    const HEIGHT_TOLERANCE_M =
      (aType === 'communication_service' || bType === 'communication_service')
        ? ftToM(1.0)
        : ftToM(0.5);
    return Math.abs(a.height - b.height) < HEIGHT_TOLERANCE_M;
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
            // PRESERVE the original parentInsulatorId - don't override with height-based matching
            // The SPIDA extraction already set this correctly based on actual wire-to-insulator connections
            parentInsulatorId: recAttachment.parentInsulatorId || (
              // Only use height-based fallback if there's no explicit relationship AND it's not an insulator itself
              recAttachment.type.toLowerCase().includes('insulator') ? undefined :
              spidaRecommended.find(ins => 
                ins.type.toLowerCase().includes('insulator') && 
                ins.id !== recAttachment.id && // Don't link to self
                Math.abs(ins.height - recAttachment.height) < 0.01
              )?.id
            )
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
          guyMatchResults: guyMatchResults // Add guy matching results
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
          
          // Build all cross-arm relationship maps once (much cleaner!)
          const armMaps = buildArmMaps(structure);
          
          // Verify cross-arm logic is working correctly (debug only)
          // verifyCrossArmLogic(structure, armMaps, location.label);
          
          // Add cross-arms themselves to attachments array
          if (structure.crossArms) {
            structure.crossArms.forEach((arm: any) => {
              const heightInMetres = getArmGroundHeight(arm.id, armMaps);
              
              // Collect warning if no height data available
              if (heightInMetres === 0) {
                addWarning(`Cross-arm ${arm.id} on pole ${location.label} has no height data`);
              }
              
              attachments.push({
                id: arm.id,
                type: 'Cross-arm',
                owner: structure.pole?.owner?.id ?? 'CPS',
                description: arm.clientItem?.size ?? 'Cross-arm',
                height: heightInMetres || 0,
                poleScid: location.label
              });
            });
          }

          // Calculate actual ground heights for insulators and their wires
          const insulatorGroundHeight = new Map<string, number>();
          const wireToInsulatorHeight = new Map<string, number>();
          
          if (structure.insulators) {
            structure.insulators.forEach((ins: any) => {
              const armId = getInsulatorArmId(ins.id, armMaps);
              let groundHeight: number;
              
              if (armId) {
                // Cross-arm mounted - include insulator's vertical offset
                const armHt = getArmGroundHeight(armId, armMaps)!;
                const extra = toMetres(ins.offset?.value ?? 0, (ins.offset?.unit ?? 'METRE') as Unit);
                groundHeight = armHt + extra; // use the real vertical drop
              } else {
                // Pole-top or other mounting: use insulator's absolute height
                const rawHeight = ins.offset?.value ?? ins.attachmentHeight?.value ?? 0;
                groundHeight = toMetres(rawHeight, (ins.attachmentHeight?.unit ?? ins.offset?.unit ?? 'METRE') as Unit);
              }
              
              insulatorGroundHeight.set(ins.id, groundHeight);
              
              // Map wires to this insulator's ground height
              if (Array.isArray(ins.wires)) {
                ins.wires.forEach((wireId: string) => {
                  wireToInsulatorHeight.set(wireId, groundHeight);
                });
              }
            });
          }

          if (structure.wires) {
            structure.wires.forEach((w: any) => {
              // Use insulator ground height if wire is connected to an insulator, otherwise use wire height
              const rawHeight = wireToInsulatorHeight.get(w.id) ?? w.attachmentHeight.value;
              const displayHeight = toMetres(rawHeight, (w.attachmentHeight.unit ?? 'METRE') as Unit);
              const isConnectedToInsulator = wireToInsulatorHeight.has(w.id);
              
              // Use clean helper functions to determine cross-arm relationships
              const parentId = armMaps.wireToInsulatorId.get(w.id);
              const isOnCrossArm = isWireOnArm(w.id, armMaps);
              
              // Enhanced communication service detection
              const isCommService = w.usageGroup?.toLowerCase().includes('comm') || 
                                  w.usageGroup?.toLowerCase().includes('service') ||
                                  w.usageGroup?.toLowerCase().includes('drop');
              
              attachments.push({ 
                id: w.id || `wire-${attachments.length}`,
                type: w.usageGroup, 
                owner: w.owner.id, 
                description: `${w.clientItem.size}${isConnectedToInsulator ? ' (at insulator height)' : ''}${isOnCrossArm ? ' 🔧' : ''}`, 
                height: displayHeight,
                parentInsulatorId: parentId,
                poleScid: location.label
              });
            });
          }
          if (structure.guys) {
            structure.guys.forEach((g: any) => attachments.push({ 
              id: g.id || `guy-${attachments.length}`,
              type: 'Guy', 
              owner: g.owner.id, 
              description: g.clientItem.size, 
              height: toMetres(g.attachmentHeight.value, (g.attachmentHeight.unit ?? 'METRE') as Unit),
              poleScid: location.label
            }));
          }
          if (structure.equipments) {
            structure.equipments.forEach((equip: any) => attachments.push({ 
              id: equip.id || `equipment-${attachments.length}`,
              type: equip.clientItem.type, 
              owner: equip.owner.id, 
              description: equip.clientItem.size, 
              height: toMetres(equip.attachmentHeight.value, (equip.attachmentHeight.unit ?? 'METRE') as Unit),
              poleScid: location.label
            }));
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

              // Extract insulator name and size from SPIDACalc structure using helper
              const insulatorName = ins.clientItem || 'Unknown Insulator';
              const insulatorSize = getInsulatorDisplayName(ins.id, data);

              // Check if this insulator is cross-arm mounted
              const isOnCrossArm = isInsulatorOnArm(ins.id, armMaps);
              const rawHeight = insulatorGroundHeight.get(ins.id) ?? (ins.offset?.value ?? ins.attachmentHeight?.value ?? 0);
              const finalHeight = toMetres(rawHeight, (ins.attachmentHeight?.unit ?? ins.offset?.unit ?? 'METRE') as Unit);
              
              attachments.push({
                id: ins.id || `insulator-${attachments.length}`,
                type: `Insulator (${insulatorName})`,
                owner: ownerId,
                description: `${insulatorSize !== 'Unknown Insulator' ? insulatorSize : insulatorName}${isOnCrossArm ? ' 🔧' : ''}`,
                height: finalHeight,
                poleScid: location.label
              });
            });
          }
          return { label: design.label, pole: { ...structure.pole.clientItem }, attachments };
        }),
      }))
    );
  };

  const parseKatapultData = (data: KatapultData): Map<string, { existing: Attachment[]; proposed: Attachment[] }> => {
    const katapultMap = new Map<string, { existing: Attachment[]; proposed: Attachment[] }>();
    if (!data.nodes || !data.photos || !data.traces?.trace_data) return katapultMap;

    Object.values(data.nodes).forEach((node: KatapultNode) => {
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
              owner: traceInfo.company || 'Unknown',
              description: traceInfo.label || wire._trace,
              height: wire._measured_height * INCHES_TO_METRES,
            };

            // For wires that are not guys, create a synthetic wire-based attachment
            // Use "Wire" type instead of "Insulator" to avoid confusion with real insulators
            const shouldCreateSyntheticWireGroup = 
              attachmentType !== 'Guy' &&
              traceInfo._trace_type !== 'down_guy';

            if (shouldCreateSyntheticWireGroup) {
              const syntheticWireId = `syn-wire-${wire._trace}`;
              const syntheticWireGroup: Attachment = {
                id: syntheticWireId,
                type: `Wire (${attachmentType || 'Unknown'})`, // Changed from "Insulator" to "Wire"
                owner: traceInfo.company || 'Unknown',
                description: `Wire group - ${traceInfo.label || wire._trace}`,
                height: wire._measured_height * INCHES_TO_METRES,
                synthetic: true,
              };

              // Link the wire back to its synthetic wire group
              wireAttachment.parentInsulatorId = syntheticWireId;

              if (traceInfo.proposed === true) {
                proposedAttachments.push(syntheticWireGroup);
              } else {
                existingAttachments.push(syntheticWireGroup);
              }
            }

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

              const equipmentAttachment: Attachment = {
                type: equipment.equipment_type ? 
                  equipment.equipment_type.charAt(0).toUpperCase() + equipment.equipment_type.slice(1).replace(/_/g, ' ') : 
                  'Equipment',
                owner: owner,
                description: equipment.measurement_of ? 
                  `${equipment.equipment_type || 'Equipment'} (${equipment.measurement_of})` : 
                  equipment.equipment_type || 'Equipment',
                height: equipment._measured_height * INCHES_TO_METRES,
              };

              // Equipment is generally existing, not proposed
              existingAttachments.push(equipmentAttachment);
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

            const company = traceInfo.company || '';
            const guyType = guyData.guy_type || traceInfo._trace_type || traceInfo.cable_type || 'guy';
            
            // Use standard 'Guy' type for main comparison table (not canonical types)
            const guyAttachment: Attachment = {
              type: 'Guy',
              owner: normalizeOwner(company) || 'cps',
              description: `${guyType} [Katapult guying]`,
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
                
                const guyAttachment: Attachment = {
                  type: attachmentType,
                  owner: normalizeOwner(company) || 'cps',
                  description: `${guyType} [Katapult wire-categorized guy]`,
                  height: wireItem._measured_height * INCHES_TO_METRES,
                };

                const isProposed = traceInfo?.proposed === true;
                (isProposed ? proposedAttachments : existingAttachments).push(guyAttachment);

                console.log(`🔍 Processed guy (from wire section) on pole ${poleTag}:`, {
                  tagId,
                  type: attachmentType,
                  company,
                  guyType,
                  height: wireItem._measured_height,
                  proposed: traceInfo.proposed
                });
                return; // Skip normal wire processing
              }

              // Filter: Skip Primary cables
              if (cableType.toLowerCase() === 'primary') {
                console.log(`Skipping Primary cable ${tagId} on pole ${poleTag}`);
                return;
              }

              // Name Construction: "{Company} {Cable Type}"
              const attachmentType = `${company} ${cableType}`.trim();
              const description = `${traceInfo.label || wireItem._trace} [Katapult wire]`;

              const wireAttachment: Attachment = {
                type: attachmentType,
                owner: normalizeOwner(company) || 'unknown',
                description: description,
                height: wireItem._measured_height * INCHES_TO_METRES,
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
                proposed: traceInfo.proposed
              });
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

              // Name Construction with Special Rules
              let attachmentType: string;
              let description: string;

              if (equipmentType === 'street_light') {
                attachmentType = `${company} Street Light`;
                // Check for measurement_of field
                if (equipItem.measurement_of) {
                  attachmentType += ` (${equipItem.measurement_of})`;
                }
                description = `Street Light${equipItem.measurement_of ? ` - ${equipItem.measurement_of}` : ''} [Katapult equipment]`;
              } else if (equipmentType === 'riser') {
                attachmentType = `${company} Riser`;
                description = `Riser [Katapult equipment]`;
              } else {
                // For all other equipment types
                attachmentType = `${company} ${equipmentType}`;
                if (equipmentType && !attachmentType.toLowerCase().includes(equipmentType.toLowerCase())) {
                  attachmentType += ` (${equipmentType})`;
                }
                description = `${equipmentType || 'Equipment'} [Katapult equipment]`;
              }

              const equipmentAttachment: Attachment = {
                type: attachmentType.trim(),
                owner: normalizeOwner(company) || ownerFromEquipmentType(equipmentType),
                description: description,
                height: equipItem._measured_height * INCHES_TO_METRES,
              };

              // Fix 1: Use isProposed guard and default to existing
              const isProposed = traceInfo?.proposed === true;
              (isProposed ? proposedAttachments : existingAttachments).push(equipmentAttachment);

              console.log(`🔍 Processed equipment on pole ${poleTag}:`, {
                tagId,
                type: attachmentType,
                company,
                equipmentType,
                height: equipItem._measured_height,
                measurementOf: equipItem.measurement_of,
                proposed: traceInfo.proposed
              });
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

              const description = `${guyType} [Katapult guying]`;

              const guyAttachment: Attachment = {
                type: attachmentType.trim(),
                owner: normalizeOwner(company) || 'cps', // Default to utility
                description: description,
                height: guyItem._measured_height * INCHES_TO_METRES,
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
                proposed: traceInfo.proposed
              });
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
          <h3>Project Overview</h3>
          <p><strong>SPIDA Project:</strong> {spidaData.label}</p>
          <p><strong>Katapult Project:</strong> {katapultData?.name || 'N/A'}</p>
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