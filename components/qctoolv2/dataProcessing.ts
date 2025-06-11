import { 
  PoleComparison, 
  ComparisonResults,
  PreprocessedRow,
  AttachmentRow,
  HeightBucket
} from './types';

/**
 * QC Tool v2 Data Processing - Four-Layer Implementation
 * 
 * Implements the QC-Match specification with four-layer comparison:
 * - Measured-SPIDA (designs[0] or layerType="MEASURED")
 * - Recommended-SPIDA (designs[1] or layerType="RECOMMENDED") 
 * - Measured-Katapult (base heights from attributes.height)
 * - Recommended-Katapult (base heights + mr_move deltas)
 * 
 * Key Features:
 * - Height bucketing (0.1 ft precision)
 * - Synthetic insulator injection for Katapult wires
 * - Average-based delta calculations with color coding
 * - mr_move integration from alternate designs
 */

// Conversion constants
const METERS_TO_FEET = 3.28084;
export const HEIGHT_BUCKET_SIZE = 0.1; // default bucket size (ft)

// Helper function to convert meters to feet
export const metersToFeet = (meters: number): number => {
  return meters * METERS_TO_FEET;
};

// Helper function to convert feet + inches to total feet
export const feetInchesToFeet = (feet: number, inches: number): number => {
  return feet + (inches / 12);
};

// Helper function to safely get nested object values
const safeGet = (obj: any, path: string, defaultValue: any = null): any => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
};

// Helper function to extract value from Katapult attribute objects
const extractKatapultValue = (attributeObj: any): string => {
  if (typeof attributeObj === 'string') return attributeObj;
  if (typeof attributeObj === 'object' && attributeObj !== null) {
    const keys = Object.keys(attributeObj);
    if (keys.length > 0) {
      const firstKey = keys[0];
      return attributeObj[firstKey] || '';
    }
  }
  return '';
};

// Helper function to infer attachment type from tagId
const inferAttachmentType = (tagId: string): string => {
  const tag = tagId.toLowerCase();
  if (tag.includes('primary') || tag.includes('phase')) return 'Wire';
  if (tag.includes('neutral')) return 'Wire';
  if (tag.includes('communication') || tag.includes('com')) return 'Wire';
  if (tag.includes('guy')) return 'Guy';
  if (tag.includes('transformer')) return 'Equipment';
  if (tag.includes('street') && tag.includes('light')) return 'Equipment';
  if (tag.includes('insulator')) return 'Insulator';
  return 'Wire'; // Default assumption for unclassified tags
};

// Extract mr_move recommendations from Katapult alternate designs
const extractMrMoveData = (katapultJson: any): Record<string, Record<string, number>> => {
  const moveData: Record<string, Record<string, number>> = {};
  
  try {
    const alternateDesigns = safeGet(katapultJson, 'alternate_designs.designs', {});
    
    for (const [designId, design] of Object.entries(alternateDesigns)) {
      const designData = design as any;
      const photoData = safeGet(designData, 'data.photo.photofirst_data', {});
      
      // Extract wire moves
      const wireData = safeGet(photoData, 'wire', {});
      const equipmentData = safeGet(photoData, 'equipment', {});
      
      const designMoves: Record<string, number> = {};
      
      // Process wire mr_move values
      for (const [tagId, wireInfo] of Object.entries(wireData)) {
        const mrMove = safeGet(wireInfo, 'mr_move', 0);
        if (mrMove && typeof mrMove === 'number') {
          designMoves[tagId] = mrMove; // Store in inches
        }
      }
      
      // Process equipment mr_move values
      for (const [tagId, equipmentInfo] of Object.entries(equipmentData)) {
        const mrMove = safeGet(equipmentInfo, 'mr_move', 0);
        if (mrMove && typeof mrMove === 'number') {
          designMoves[tagId] = mrMove; // Store in inches
        }
      }
      
      if (Object.keys(designMoves).length > 0) {
        moveData[designId] = designMoves;
      }
    }
  } catch (error) {
    console.warn('Error extracting mr_move data:', error);
  }
  
  return moveData;
};

/**
 * Preprocess SPIDA data into standardized rows
 */
export const preprocessSpidaData = (spidaJson: any): PreprocessedRow[] => {
  const rows: PreprocessedRow[] = [];
  
  try {
    const leads = safeGet(spidaJson, 'leads', []);
    
    for (const lead of leads) {
      const locations = safeGet(lead, 'locations', []);
      
      for (const location of locations) {
        const poleId = safeGet(location, 'label', '') || safeGet(location, 'structureId', '');
        const scid = safeGet(location, 'scid', '');
        if (!poleId) continue;
        
        const designs = safeGet(location, 'designs', []);
        
        for (let designIndex = 0; designIndex < designs.length; designIndex++) {
          const design = designs[designIndex];
          let layerType = safeGet(design, 'layerType', '');
          
          // Normalize layer type and apply fallback logic
          if (layerType.toUpperCase() === 'MEASURED' || layerType === 'Measured' || designIndex === 0) {
            layerType = 'SpidaMeasured';
          } else if (layerType.toUpperCase() === 'RECOMMENDED' || layerType === 'Recommended' || designIndex === 1) {
            layerType = 'SpidaRecommended';
          } else {
            continue; // Skip unknown layer types
          }
          
          const structure = safeGet(design, 'structure', {});
          const poleAgl = safeGet(structure, 'pole.agl.value', 0);
          
          // Process insulators (parent objects for wires)
          const insulators = safeGet(structure, 'insulators', []);
          const wires = safeGet(structure, 'wires', []);
          
          for (const insulator of insulators) {
            const heightMeters = safeGet(insulator, 'offset.value', 0);
            const heightFt = metersToFeet(heightMeters);
            const insulatorId = safeGet(insulator, 'id', '');
            const attachedWires = safeGet(insulator, 'wires', []);
            
            // Add insulator row
            rows.push({
              poleId,
              scid,
              layer: layerType as 'SpidaMeasured' | 'SpidaRecommended',
              type: 'Insulator',
              desc: `Insulator ${insulatorId}`,
              height_ft: heightFt,
              ref: insulatorId,
              subType: 'Insulator'
            });
            
            // Add wire children
            for (const wireId of attachedWires) {
              const wire = wires.find((w: any) => safeGet(w, 'id', '') === wireId);
              if (wire) {
                const usageGroup = safeGet(wire, 'usageGroup', '');
                const size = safeGet(wire, 'clientItem.size', '');
                
                rows.push({
                  poleId,
                  scid,
                  layer: layerType as 'SpidaMeasured' | 'SpidaRecommended',
                  type: 'Wire',
                  desc: `${usageGroup}${size ? ` (${size})` : ''}`,
                  height_ft: heightFt, // Use insulator height for wires
                  ref: wireId,
                  parentIns: insulatorId,
                  subType: usageGroup
                });
              }
            }
          }
          
          // Process standalone wires (not attached to insulators)
          for (const wire of wires) {
            const wireId = safeGet(wire, 'id', '');
            const isAttachedToInsulator = insulators.some((ins: any) => 
              safeGet(ins, 'wires', []).includes(wireId)
            );
            
            if (!isAttachedToInsulator) {
              const heightMeters = safeGet(wire, 'attachmentHeight.value', 0);
              const heightFt = metersToFeet(heightMeters);
              const usageGroup = safeGet(wire, 'usageGroup', '');
              const size = safeGet(wire, 'clientItem.size', '');
              
              rows.push({
                poleId,
                scid,
                layer: layerType as 'SpidaMeasured' | 'SpidaRecommended',
                type: 'Wire',
                desc: `${usageGroup}${size ? ` (${size})` : ''}`,
                height_ft: heightFt,
                ref: wireId,
                subType: usageGroup
              });
            }
          }
          
          // Process crossarms
          const crossArms = safeGet(structure, 'crossArms', []);
          for (const crossArm of crossArms) {
            const heightMeters = safeGet(crossArm, 'attachmentHeight.value', 0);
            const heightFt = metersToFeet(heightMeters);
            
            rows.push({
              poleId,
              scid,
              layer: layerType as 'SpidaMeasured' | 'SpidaRecommended',
              type: 'CrossArm',
              desc: 'Cross Arm',
              height_ft: heightFt,
              ref: `crossarm-${heightFt}`,
              subType: 'CrossArm'
            });
          }
          
          // Process equipment
          const equipments = safeGet(structure, 'equipments', []);
          for (const equipment of equipments) {
                const attachHeight = safeGet(equipment, 'attachmentHeight.value', null);
                const distToBottom = safeGet(equipment, 'distanceToBottom.value', null);
            let heightMeters = 0;
            if (attachHeight !== null) {
              heightMeters = attachHeight;
            } else if (distToBottom !== null && poleAgl > 0) {
              heightMeters = poleAgl - distToBottom;
            }
            
            const heightFt = metersToFeet(heightMeters);
            const equipmentType = safeGet(equipment, 'clientItem.type', '');
            
            rows.push({
              poleId,
              scid,
              layer: layerType as 'SpidaMeasured' | 'SpidaRecommended',
              type: 'Equipment',
              desc: `Equipment: ${equipmentType}`,
              height_ft: heightFt,
              ref: `equipment-${equipmentType}`,
              subType: equipmentType
            });
          }
          
          // Process guys (both guys[] and guyAttachPoints[])
          const guys = safeGet(structure, 'guys', []);
          const guyAttachPoints = safeGet(structure, 'guyAttachPoints', []);
          
          for (const guy of guys) {
            const heightMeters = safeGet(guy, 'attachmentHeight.value', 0);
            const heightFt = metersToFeet(heightMeters);
            
            rows.push({
              poleId,
              scid,
              layer: layerType as 'SpidaMeasured' | 'SpidaRecommended',
              type: 'Guy',
              desc: 'Guy Wire',
              height_ft: heightFt,
              ref: `guy-${heightFt}`,
              subType: 'Guy'
            });
          }
          
          for (const guyPoint of guyAttachPoints) {
            const heightMeters = safeGet(guyPoint, 'attachHeight.value', 0);
            const heightFt = metersToFeet(heightMeters);
            
            rows.push({
              poleId,
              scid,
              layer: layerType as 'SpidaMeasured' | 'SpidaRecommended',
              type: 'Guy',
              desc: 'Guy Wire',
              height_ft: heightFt,
              ref: `guypoint-${heightFt}`,
              subType: 'Guy'
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error preprocessing SPIDA data:', error);
  }
  
  return rows;
};

/**
 * Preprocess Katapult data into standardized rows (both measured and recommended)
 */
export const preprocessKatapultData = (katapultJson: any): PreprocessedRow[] => {
  const rows: PreprocessedRow[] = [];
  
  try {
    const nodes = safeGet(katapultJson, 'nodes', {});
    const moveData = extractMrMoveData(katapultJson);
    
    // Use first design's move data if available
    const firstDesignMoves = Object.values(moveData)[0] || {};
    
    for (const [_nodeId, nodeData] of Object.entries(nodes)) {
      const node = nodeData as any;
      const attributes = safeGet(node, 'attributes', {});
      
      // Extract pole identifiers
      const scidObj = safeGet(attributes, 'scid.auto_button', '');
      const scid = extractKatapultValue(scidObj);
      
      const poleTagObj = safeGet(attributes, 'electric_pole_tag.assessment', '');
      const poleTag = extractKatapultValue(poleTagObj);
      
      const poleId = poleTag || scid;
      if (!poleId) continue;
      
      // Extract attachment heights
      const heightsObj = safeGet(node, 'heights', {});
      
      for (const [tagId, heightData] of Object.entries(heightsObj)) {
        const height = heightData as any;
        
        const height_ft = safeGet(height, 'height_ft', 0);
        const height_in = safeGet(height, 'height_in', 0);
        const type = safeGet(height, 'type', '');
        const company = safeGet(height, 'company', '');
        
        const feetNum = typeof height_ft === 'number' ? height_ft : parseFloat(height_ft) || 0;
        const inchesNum = typeof height_in === 'number' ? height_in : parseFloat(height_in) || 0;
        const totalHeightFeet = feetNum + (inchesNum / 12);
        
        const attachmentType = inferAttachmentType(type || tagId);
        const desc = type || attachmentType;
        const needsPseudoInsulator = attachmentType === 'Wire';
        
        // Measured Katapult row
        rows.push({
          poleId,
          scid,
          layer: 'KatMeasured',
          type: attachmentType,
          desc: `${desc}${company ? ` (${company})` : ''}`,
          height_ft: totalHeightFeet,
          ref: tagId,
          needsPseudoInsulator,
          subType: attachmentType
        });
        
        // Recommended Katapult row (base + mr_move)
        const mrMoveInches = firstDesignMoves[tagId] || 0;
        const recommendedHeightFeet = totalHeightFeet + (mrMoveInches / 12);
        
        rows.push({
          poleId,
          scid,
          layer: 'KatRecommended',
          type: attachmentType,
          desc: `${desc}${company ? ` (${company})` : ''}${mrMoveInches ? ` (+${mrMoveInches}")` : ''}`,
          height_ft: recommendedHeightFeet,
          ref: `${tagId}-rec`,
          needsPseudoInsulator,
          subType: attachmentType
        });
      }
    }
  } catch (error) {
    console.error('Error preprocessing Katapult data:', error);
  }
  
  return rows;
};

/**
 * Bucket rows by height and inject synthetic insulators
 */
export const bucketAndJoin = (rows: PreprocessedRow[]): Record<string, Record<number, Record<string, AttachmentRow[]>>> => {
  const buckets: Record<string, Record<number, Record<string, AttachmentRow[]>>> = {};
  
  // Group rows by pole and bucket
  for (const row of rows) {
    const bucketKey = Math.round(row.height_ft / HEIGHT_BUCKET_SIZE) * HEIGHT_BUCKET_SIZE;
    
    if (!buckets[row.poleId]) buckets[row.poleId] = {};
    if (!buckets[row.poleId][bucketKey]) buckets[row.poleId][bucketKey] = {
      KatMeasured: [],
      SpidaMeasured: [],
      KatRecommended: [],
      SpidaRecommended: [],
      // deprecated
      Measured: [],
      Recommended: []
    };
    
    const attachmentRow: AttachmentRow = {
      type: row.type,
      desc: row.desc,
      height_ft: row.height_ft,
      ref: row.ref,
      synthetic: row.synthetic
    };
    
    // Map legacy layer keys to new ones
    let targetKey: string = row.layer;
    if (row.layer === 'Measured' || row.layer === 'SpidaMeasured') targetKey = 'SpidaMeasured';
    else if (row.layer === 'Recommended' || row.layer === 'SpidaRecommended') targetKey = 'SpidaRecommended';
    buckets[row.poleId][bucketKey][targetKey].push(attachmentRow);
    
    // maintain deprecated aliases for compatibility
    if (targetKey === 'SpidaMeasured') {
      buckets[row.poleId][bucketKey]['Measured'].push(attachmentRow);
    } else if (targetKey === 'SpidaRecommended') {
      buckets[row.poleId][bucketKey]['Recommended'].push(attachmentRow);
    }
  }
  
  // Inject synthetic insulators for Katapult wires
  for (const poleId in buckets) {
    for (const bucketKey in buckets[poleId]) {
      const bucket = buckets[poleId][bucketKey];
      
      // Check KatMeasured layer
      const katMeasuredWires = bucket.KatMeasured.filter(r => r.type === 'Wire');
      const hasKatMeasuredInsulator = bucket.KatMeasured.some(r => r.type === 'Insulator' && !r.synthetic);
      
      if (katMeasuredWires.length > 0 && !hasKatMeasuredInsulator) {
        bucket.KatMeasured.unshift({
          type: 'Insulator',
          desc: '(implicit)',
          height_ft: parseFloat(bucketKey),
          ref: `synthetic-insulator-katmeasured-${bucketKey}`,
          synthetic: true
        });
      }
      
      // Check KatRecommended layer
      const katRecommendedWires = bucket.KatRecommended.filter(r => r.type === 'Wire');
      const hasKatRecommendedInsulator = bucket.KatRecommended.some(r => r.type === 'Insulator' && !r.synthetic);
      
      if (katRecommendedWires.length > 0 && !hasKatRecommendedInsulator) {
        bucket.KatRecommended.unshift({
          type: 'Insulator',
          desc: '(implicit)',
          height_ft: parseFloat(bucketKey),
          ref: `synthetic-insulator-katrecommended-${bucketKey}`,
          synthetic: true
        });
      }
    }
  }
  
  return buckets;
};

/**
 * Calculate delta and determine bucket color
 */
export const calculateBucketColor = (bucket: Record<string, AttachmentRow[]>): 'green' | 'amber' | 'red' | 'grey' => {
  const getRealHeights = (items: AttachmentRow[]): number[] => {
    return items.filter(item => !item.synthetic).map(item => item.height_ft);
  };
  
  const getAverage = (heights: number[]): number => {
    return heights.length > 0 ? heights.reduce((a, b) => a + b, 0) / heights.length : 0;
  };
  
  const measuredSpidaHeights = getRealHeights(bucket.SpidaMeasured || []);
  const katMeasuredHeights = getRealHeights(bucket.KatMeasured || []);
  const recommendedSpidaHeights = getRealHeights(bucket.SpidaRecommended || []);
  const katRecommendedHeights = getRealHeights(bucket.KatRecommended || []);
  
  let measΔ = 0;
  let recΔ = 0;
  
  if (measuredSpidaHeights.length > 0 && katMeasuredHeights.length > 0) {
    measΔ = Math.abs(getAverage(measuredSpidaHeights) - getAverage(katMeasuredHeights));
  }
  
  if (recommendedSpidaHeights.length > 0 && katRecommendedHeights.length > 0) {
    recΔ = Math.abs(getAverage(recommendedSpidaHeights) - getAverage(katRecommendedHeights));
  }
  
  const maxΔ = Math.max(measΔ, recΔ);
  
  // Check if there's data in any layer
  const hasAnyData = [
    ...measuredSpidaHeights,
    ...katMeasuredHeights,
    ...recommendedSpidaHeights,
    ...katRecommendedHeights
  ].length > 0;
  
  if (!hasAnyData) return 'grey';
  
  if (maxΔ <= 0.5) return 'green';
  if (maxΔ <= 1.0) return 'amber';
  return 'red';
};

/**
 * Main QC comparison function implementing four-layer logic
 */
export const performQCComparison = (spidaJson: any, katapultJson: any): ComparisonResults => {
  console.log('🚀 Starting QC Tool v2 Four-Layer Analysis');
  
  // Step 1: Preprocess both data sources
  const spidaRows = preprocessSpidaData(spidaJson);
  const katapultRows = preprocessKatapultData(katapultJson);
  
  console.log(`📊 Preprocessed: ${spidaRows.length} SPIDA rows, ${katapultRows.length} Katapult rows`);
  
  // Step 2: Combine all rows
  const allRows = [...spidaRows, ...katapultRows];
  
  // Step 3: Bucket and join
  const bucketsByPole = bucketAndJoin(allRows);
  
  // Step 4: Generate final comparison results
  const poleComparisons: PoleComparison[] = [];
  let totalGreen = 0, totalAmber = 0, totalRed = 0;
  
  for (const poleId in bucketsByPole) {
    const poleBuckets = bucketsByPole[poleId];
    const heightBuckets: HeightBucket[] = [];
    
    // Convert to sorted height buckets
    const sortedHeights = Object.keys(poleBuckets)
      .map(h => parseFloat(h))
      .sort((a, b) => b - a); // Descending order (top of pole first)
    
    for (const height of sortedHeights) {
      const bucketData = poleBuckets[height];
      const colour = calculateBucketColor(bucketData);
      
      // Count bucket colors
      if (colour === 'green') totalGreen++;
      else if (colour === 'amber') totalAmber++;
      else if (colour === 'red') totalRed++;
      
      heightBuckets.push({
        height_ft: height,
        colour,
        KatMeasured: bucketData.KatMeasured || [],
        SpidaMeasured: bucketData.SpidaMeasured || [],
        KatRecommended: bucketData.KatRecommended || [],
        SpidaRecommended: bucketData.SpidaRecommended || [],

        // deprecated aliases for transition
        Measured: bucketData.Measured || [],
        Recommended: bucketData.Recommended || []
      });
    }
    
    // Extract SCID from first row
    const firstRow = allRows.find(r => r.poleId === poleId);
    
      poleComparisons.push({
      poleId,
      scid: firstRow?.scid,
      buckets: heightBuckets
    });
  }
  
  console.log(`✅ QC Analysis Complete: ${poleComparisons.length} poles processed`);
  console.log(`📊 Bucket Summary: ${totalGreen} green, ${totalAmber} amber, ${totalRed} red`);
  
  return {
    totalPoles: poleComparisons.length,
    matchedPoles: poleComparisons.length, // All poles are "matched" in bucket approach
    poleComparisons,
    summary: {
      greenBuckets: totalGreen,
      amberBuckets: totalAmber,
      redBuckets: totalRed
    }
  };
};

// Debug utility
export const debugParsedData = (spidaJson: any, katapultJson: any) => {
  console.group('🔍 QC Tool v2 Debug Information (Four-Layer)');

  if (spidaJson) {
    const spidaRows = preprocessSpidaData(spidaJson);
    console.log(`📊 SPIDA: ${spidaRows.length} rows from ${new Set(spidaRows.map(r => r.poleId)).size} poles`);
  }

  if (katapultJson) {
    const katRows = preprocessKatapultData(katapultJson);
    console.log(`📊 Katapult: ${katRows.length} rows from ${new Set(katRows.map(r => r.poleId)).size} poles`);
  }

  console.groupEnd();
};