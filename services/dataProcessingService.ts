import {
  SpidaPoleTypeDefinition,
  IntermediateSpidaPole,
  RawKatapultPole, 
  NormalizedPole, 
  Coordinate, 
  ProcessedPole, 
  MatchTier, 
  ComparisonStats,
  SpidaDesignPoleStructure,
  SpidaDesign,
  KatapultBirthmarkData,
  KatapultJsonFormat,
  KatapultJsonNode, // Added for full JSON access + _nodeKey
  SpidaProjectStructure // Added missing import
} from '../types';
import { 
  COORDINATE_MATCH_THRESHOLD_METERS, 
  INITIAL_STATS,
  POLE_SPEC_HEIGHT_TOLERANCE_FEET
} from '../constants';

// --- Normalization Helpers ---
function normalizeString(value: any): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return value.toString();
  return null;
}

export function normalizeScid(value: any): string | null {
  if (value === null || value === undefined) return null;
  const strVal = String(value).trim();
  if (/^\d+$/.test(strVal)) { 
    return strVal;
  }
  return null; 
}

export function normalizePoleNum(value: any): string | null {
  if (value === null || value === undefined) return null;
  let strVal = String(value).trim();
  
  strVal = strVal.replace(/\D/g, ''); 

  if (strVal.length === 0) return null;
  
  const num = parseInt(strVal, 10);
  if (isNaN(num)) return null; 
  return num.toString(); 
}

// Define commonNormalizePoleNum immediately after normalizePoleNum
const commonNormalizePoleNum = normalizePoleNum;

function normalizeNumber(value: any): number | null {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const cleanedValue = value.replace('%', '').trim();
    const num = parseFloat(cleanedValue);
    if (!isNaN(num)) return num;
  }
  return null;
}



export function _to_feet_ts(raw: { unit: string; value: number } | number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'object' && 'unit' in raw && 'value' in raw) {
    const unit = String(raw.unit).toLowerCase();
    const val = raw.value;
    try {
      const val_f = parseFloat(String(val));
      if (isNaN(val_f)) return null;
      if (unit.startsWith("met") || unit.startsWith("m")) { 
        return Math.round(val_f / 0.3048);
      }
      return Math.round(val_f); 
    } catch { return null; }
  }
  if (typeof raw === 'number') { 
    if(raw > 5 && raw < 30 && Number.isInteger(raw)) return Math.round(raw / 0.3048); 
    if(raw < 5 || raw >=30 || !Number.isInteger(raw)) return Math.round(raw / 0.3048); 
    return Math.round(raw); 
  }
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s.endsWith("m")) {
        const num_s = parseFloat(s.replace("m", ""));
        if (!isNaN(num_s)) return Math.round(num_s / 0.3048);
    }
    if (s.includes("'") || s.endsWith("ft")) {
      const num_s = parseFloat(s.replace(/'|ft/g, ""));
      if(!isNaN(num_s)) return Math.round(num_s);
    }
    const num_s = parseFloat(s);
    if (!isNaN(num_s)) {
        if (s.includes('.') || (num_s > 5 && num_s < 30 && !s.match(/\d+-/))) { 
             return Math.round(num_s / 0.3048);
        }
        return Math.round(num_s); 
    }
    return null;
  }
  return null;
}

function _buildPoleSpecStringFromParts(heightFt: number | null, poleClass: string | null, species: string | null): string | null {
    const s = species ? String(species).toUpperCase().trim() : null;
    let specParts: string[] = [];
    let heightClassSegment = "";

    if (heightFt !== null) {
        heightClassSegment = String(heightFt);
        if (poleClass !== null && String(poleClass).trim() !== "") {
            heightClassSegment += `-${normalizeString(poleClass)}`;
        }
    } else if (poleClass !== null && String(poleClass).trim() !== "") {
        heightClassSegment = `-${normalizeString(poleClass)}`;
    }

    if (heightClassSegment) {
        specParts.push(heightClassSegment);
    }

    if (s) {
        specParts.push(s);
    }
    
    const builtSpec = specParts.join(' ').trim();
    return builtSpec || null;
}

export function buildSpidaAliasTable(poleDefinitions: SpidaPoleTypeDefinition[]): Record<string, string> {
    const aliasTable: Record<string, string> = {};
    if (!poleDefinitions) return aliasTable;

    poleDefinitions.forEach(poleDef => {
        const heightFt = _to_feet_ts(poleDef.height || poleDef.length || null);
        const poleClassValue = normalizeString(poleDef.classOfPole || poleDef.class);
        const speciesValue = normalizeString(poleDef.species);
        const fullSpec = _buildPoleSpecStringFromParts(heightFt, poleClassValue, speciesValue);

        if (fullSpec && poleDef.aliases) {
            poleDef.aliases.forEach(alias => {
                if (alias.id) {
                    aliasTable[alias.id] = fullSpec;
                }
            });
        } else if (fullSpec && poleDef.id) { 
             aliasTable[poleDef.id] = fullSpec;
        }
    });
    return aliasTable;
}

function getActualSpidaSpecForInstance(
    poleStructForSpec: SpidaDesignPoleStructure | null, 
    aliasTable: Record<string, string>
): string | null {
    if (!poleStructForSpec) return null;

    const directHeightFt = _to_feet_ts(poleStructForSpec.length || poleStructForSpec.height || null);
    const directPoleClass = normalizeString(poleStructForSpec.class || poleStructForSpec.classOfPole);
    const directSpecies = normalizeString(poleStructForSpec.species);

    if (directHeightFt !== null || directPoleClass || directSpecies) {
      const specFromDirect = _buildPoleSpecStringFromParts(directHeightFt, directPoleClass, directSpecies);
      if (specFromDirect) return specFromDirect;
    }
    
    if (poleStructForSpec.clientItemAlias && aliasTable[poleStructForSpec.clientItemAlias]) {
        return aliasTable[poleStructForSpec.clientItemAlias];
    }

    if (poleStructForSpec.clientItem) {
        const heightFt = _to_feet_ts(poleStructForSpec.clientItem.height || null);
        const poleClass = normalizeString(poleStructForSpec.clientItem.classOfPole);
        const species = normalizeString(poleStructForSpec.clientItem.species);
        return _buildPoleSpecStringFromParts(heightFt, poleClass, species);
    }
    return null;
}

export function getAnalysisLoadPercent(design: SpidaDesign | undefined): string | null {
    if (!design || !design.analysis || design.analysis.length === 0) {
        return null;
    }
    try {
        const relevantAnalysis = design.analysis.find(a => a.results && a.results.length > 0);
        if (!relevantAnalysis) return null;

        const poleResult = relevantAnalysis.results.find(r => r.component === "Pole" && typeof r.actual === 'number');
        if (poleResult) {
            return poleResult.actual.toFixed(2); 
        }
    } catch (error) {
        console.error("Error parsing SPIDA analysis load percent:", error);
    }
    return null;
}

export function getSpidaCommDrop(designOrProjectStructure: SpidaDesign | SpidaProjectStructure | undefined ): boolean | null {
  if (!designOrProjectStructure) {
    return null;
  }

  let attachmentsArray: any[] = [];
  
  // If it's a SpidaDesign (likely from location.designs)
  if ('layerType' in designOrProjectStructure && designOrProjectStructure.structure) {
      const design = designOrProjectStructure as SpidaDesign;
      if (design.structure && Array.isArray((design.structure as any).attachments)) {
        attachmentsArray = (design.structure as any).attachments;
      } else if (design.structure && Array.isArray((design.structure as any).items)) {
        attachmentsArray = (design.structure as any).items;
      } else if (Array.isArray((design as any).attachments)) {
        attachmentsArray = (design as any).attachments;
      } else if (Array.isArray((design as any).items)) {
        attachmentsArray = (design as any).items;
      }
  } 
  // If it's a SpidaProjectStructure with recommendedDesign (likely from project.structures)
  else if ('recommendedDesign' in designOrProjectStructure && (designOrProjectStructure as SpidaProjectStructure).recommendedDesign) {
      const structure = designOrProjectStructure as SpidaProjectStructure;
      const recDesign = structure.recommendedDesign;
      if (recDesign && Array.isArray(recDesign.attachments)) {
        attachmentsArray = recDesign.attachments;
      } else if (recDesign && Array.isArray(recDesign.items)) {
        attachmentsArray = recDesign.items;
      }
  }
  // Fallback for SpidaProjectStructure that might have attachments directly (less common for recommendedDesign)
  else if (Array.isArray((designOrProjectStructure as any).attachments)) {
    attachmentsArray = (designOrProjectStructure as any).attachments;
  } else if (Array.isArray((designOrProjectStructure as any).items)) {
    attachmentsArray = (designOrProjectStructure as any).items;
  }


  if (attachmentsArray.length === 0) {
    return false; // No attachments found, so no Charter drops.
  }

  for (const att of attachmentsArray) {
    const ownerIndustry = att.owner?.industry?.toLowerCase();
    const ownerId = att.owner?.id?.toLowerCase();
    const itemType = att.clientItem?.type?.toLowerCase();

    if (
      ownerIndustry === "communication" &&
      ownerId === "charter" && 
      itemType && itemType.endsWith("drop")
    ) {
      return true; 
    }
  }

  return false; 
}

export function getFirstValueFromKatapultAttribute(attributeValue: any): string | number | null | object {
  if (typeof attributeValue === 'string' || typeof attributeValue === 'number') {
    return attributeValue; 
  }
  if (typeof attributeValue === 'object' && attributeValue !== null) {
    if (attributeValue["-Imported"] !== undefined) return attributeValue["-Imported"];
    if (attributeValue.auto_button !== undefined) return attributeValue.auto_button;
    if (attributeValue.button_added !== undefined && Object.keys(attributeValue).length === 1) return attributeValue.button_added;
    if (attributeValue.tagtext !== undefined) return attributeValue.tagtext;
    
    const keys = Object.keys(attributeValue);
    if (keys.length > 0) {
      const firstInnerValue = attributeValue[keys[0]];
       if (typeof firstInnerValue === 'string' || typeof firstInnerValue === 'number' || typeof firstInnerValue === 'object') {
        return firstInnerValue;
      }
    }
  }
  return null;
}


function getKatapultSpecFromNodeAndBirthmarks(
  pole: RawKatapultPole, // Type is RawKatapultPole as KatapultJsonNode includes _nodeKey which isn't needed here
  birthmarksMap: Record<string, KatapultBirthmarkData> 
): string | null {
  let poleSpecValRaw = getFirstValueFromKatapultAttribute(pole.attributes?.pole_spec);
  let poleSpecValStr: string | null = null;
  if (typeof poleSpecValRaw === 'string' || typeof poleSpecValRaw === 'number') {
    poleSpecValStr = String(poleSpecValRaw); 
  }

  if (poleSpecValStr) {
    return normalizePoleSpec(poleSpecValStr);
  }
  if (pole["Pole Specs"]) { 
    return normalizePoleSpec(String(pole["Pole Specs"]));
  }

  const directBirthmarkBrandContainer = pole.attributes?.birthmark_brand;
  if (directBirthmarkBrandContainer && typeof directBirthmarkBrandContainer === 'object' && !Array.isArray(directBirthmarkBrandContainer)) {
      const directBirthmarkBrand = getFirstValueFromKatapultAttribute(directBirthmarkBrandContainer) as any; 
      if (directBirthmarkBrand && typeof directBirthmarkBrand === 'object') {
          const heightFt = _to_feet_ts(directBirthmarkBrand.pole_height || directBirthmarkBrand.height || null);
          const rawPoleClass = directBirthmarkBrand.pole_class || directBirthmarkBrand.class || null;
          const poleClass = commonNormalizePoleNum(rawPoleClass !== null ? String(rawPoleClass) : null);
          const rawSpecies = directBirthmarkBrand["pole_species*"] || directBirthmarkBrand.pole_species || directBirthmarkBrand.species || null;
          const species = typeof rawSpecies === 'string' ? rawSpecies.replace('*', '').trim() : null;
          
          const specFromDirectBrand = _buildPoleSpecStringFromParts(heightFt, poleClass, species);
          if (specFromDirectBrand) return normalizePoleSpec(specFromDirectBrand);
      }
  }

  const birthmarkRefIdRaw = getFirstValueFromKatapultAttribute(pole.attributes?.birthmark_reference_id);
  const birthmarkRefId = birthmarkRefIdRaw ? String(birthmarkRefIdRaw) : null;

  if (birthmarkRefId && birthmarksMap[birthmarkRefId]) {
    const birthmark = birthmarksMap[birthmarkRefId];
    const specFromRef = _buildPoleSpecStringFromParts(birthmark.heightFt, birthmark.poleClass, birthmark.species);
    if (specFromRef) return normalizePoleSpec(specFromRef);
  }
  
  let heightFtFallback: number | null = null;
  const poleHeightAttrRaw = getFirstValueFromKatapultAttribute(pole.attributes?.pole_height) || getFirstValueFromKatapultAttribute(pole.attributes?.poleLength) || (pole as any).Height;
  if (poleHeightAttrRaw) heightFtFallback = _to_feet_ts(poleHeightAttrRaw as any);

  let poleClassValFallback: string | null = null;
  const poleClassAttrRaw = getFirstValueFromKatapultAttribute(pole.attributes?.pole_class) || (pole as any).Class;
  if (poleClassAttrRaw) poleClassValFallback = commonNormalizePoleNum(String(poleClassAttrRaw)); 
  
  let speciesValFallback: string | null = null;
  const speciesAttrRaw = getFirstValueFromKatapultAttribute(pole.attributes?.pole_species) || (pole as any).Species;
  if (speciesAttrRaw) speciesValFallback = normalizeString(speciesAttrRaw as any); 
  
  const constructedSpec = _buildPoleSpecStringFromParts(heightFtFallback, poleClassValFallback, speciesValFallback);
  return normalizePoleSpec(constructedSpec);
}

// --- Normalization Functions ---
export function normalizeSpidaData(
    intermediatePoles: IntermediateSpidaPole[],
    aliasTable: Record<string, string>,
): NormalizedPole[] {
  return intermediatePoles.map((p) => {
    const actualSpec = getActualSpidaSpecForInstance(p.poleStructureForSpec, aliasTable);

    return {
      originalIndex: p.originalIndexInFeed,
      originalDataSource: 'spida',
      scid: normalizeScid(p.idSpidaDisplay), 
      poleNum: normalizePoleNum(p.poleNumDisplay),
      coords: p.coords,
      spec: normalizePoleSpec(actualSpec),
      existingPct: normalizeNumber(p.existingPctStr),
      finalPct: normalizeNumber(p.finalPctStr),
      commDrop: p.commDropFlag,
      rawData: p.rawSpidaData, 
    };
  });
}

function getKatapultCommDrop(
  poleNodeKey: string | undefined, // Changed from poleStructureRID to the node's key
  fullKatapultJson: KatapultJsonFormat | null
): boolean | null {
  if (!fullKatapultJson || !fullKatapultJson.nodes || !fullKatapultJson.connections || poleNodeKey === undefined) {
    return null; 
  }

  const currentPoleIdStr = String(poleNodeKey);
  let foundProposedCharterDrop = false;

  for (const serviceLocationNodeId in fullKatapultJson.nodes) { // Iterate with actual node keys
    const node = fullKatapultJson.nodes[serviceLocationNodeId];
    if (!node || !node.attributes) continue;

    const attrs = node.attributes;
    let nodeTypeVal: string | number | null = null;

    if (node.node_type && (typeof node.node_type === 'string' || typeof node.node_type === 'number')) {
      nodeTypeVal = String(node.node_type);
    } else if (attrs.node_type) {
      const nt = getFirstValueFromKatapultAttribute(attrs.node_type);
      if (typeof nt === 'string' || typeof nt === 'number') {
        nodeTypeVal = String(nt);
      }
    }

    if (nodeTypeVal && String(nodeTypeVal).toLowerCase().trim() === "service location") {
      let owner: string | null = null;
      const subTypeAttrRaw = getFirstValueFromKatapultAttribute(attrs.node_sub_type);
      const subTypeAttr = (typeof subTypeAttrRaw === 'string' || typeof subTypeAttrRaw === 'number') ? String(subTypeAttrRaw) : null;

      if (subTypeAttr) {
         owner = subTypeAttr.toLowerCase().trim();
      }


      if (owner === "charter") {
        const measuredAttachments = attrs.measured_attachments;
        if (measuredAttachments && typeof measuredAttachments === 'object') {
          for (const sectionIdKeyFromMA in measuredAttachments) { // This key is the one from measured_attachments
            const isMeasured = (measuredAttachments as Record<string, any>)[sectionIdKeyFromMA];
            if (isMeasured === false) { 
              // Now, find the connection that has this sectionIdKeyFromMA as one of *its own section keys*
              for (const connId in fullKatapultJson.connections) {
                const conn = fullKatapultJson.connections[connId];
                // Check if the connection's sections map contains the sectionIdKeyFromMA
                if (conn.sections && typeof conn.sections === 'object' && conn.sections[sectionIdKeyFromMA]) {
                  const node1IsService = String(conn.node_id_1) === serviceLocationNodeId && String(conn.node_id_2) === currentPoleIdStr;
                  const node2IsService = String(conn.node_id_2) === serviceLocationNodeId && String(conn.node_id_1) === currentPoleIdStr;
                  
                  if (node1IsService || node2IsService) {
                    foundProposedCharterDrop = true;
                    break; 
                  }
                }
              }
            }
            if (foundProposedCharterDrop) break;
          }
        }
      }
    }
    if (foundProposedCharterDrop) break;
  }
  return foundProposedCharterDrop;
}


export function normalizeKatapultData(
  rawData: KatapultJsonNode[], // Changed from RawKatapultPole[] to KatapultJsonNode[]
  _fileName: string,
  birthmarks: Record<string, KatapultBirthmarkData>,
  fullKatapultJson: KatapultJsonFormat | null 
): NormalizedPole[] {
  return rawData.map((p, index) => {
    let coords: Coordinate | null = null;
    if (typeof p.latitude === 'number' && typeof p.longitude === 'number') { 
      coords = { lat: p.latitude, lon: p.longitude };
    } else if (p.geometry?.type === 'Point' && Array.isArray(p.geometry.coordinates) && p.geometry.coordinates.length === 2) {
      coords = { lon: p.geometry.coordinates[0], lat: p.geometry.coordinates[1] };
    } else if (typeof p.Latitude === 'number' && typeof p.Longitude === 'number') { 
      coords = { lat: p.Latitude, lon: p.Longitude };
    }

    let scidForProcessing: string | number | null = null;
    const scidAttr = p.attributes?.scid;
    const getPrimitiveAttr = (attrValue: any): string | number | null => {
        const tempVal = getFirstValueFromKatapultAttribute(attrValue);
        if (typeof tempVal === 'string' || typeof tempVal === 'number') {
            return tempVal;
        }
        return null;
    };

    if (scidAttr) {
        scidForProcessing = getPrimitiveAttr(scidAttr);
    }
    if (scidForProcessing === null && p.StructureRID !== undefined) { // StructureRID can still be a fallback if present
      scidForProcessing = p.StructureRID;
    }
    
    const scidStr = scidForProcessing !== null && scidForProcessing !== undefined ? String(scidForProcessing).trim() : null;
    const katScid = scidStr && /^\d+$/.test(scidStr) ? scidStr : null;
    
    let poleNumForProcessing: string | number | null = null;
    const plNumberAttr = p.attributes?.PL_number;
    if (plNumberAttr) {
        const val = getFirstValueFromKatapultAttribute(plNumberAttr);
        if (typeof val === 'string' || typeof val === 'number') poleNumForProcessing = val;
    }
    if (poleNumForProcessing === null) {
        const poleNumberAttr = p.attributes?.PoleNumber;
        if (poleNumberAttr) {
            const val = getFirstValueFromKatapultAttribute(poleNumberAttr);
            if (typeof val === 'string' || typeof val === 'number') poleNumForProcessing = val;
        }
    }
    if (poleNumForProcessing === null) {
        const poleTagContainer = p.attributes?.pole_tag;
        if (poleTagContainer) {
            const valueFromHelper = getFirstValueFromKatapultAttribute(poleTagContainer);
            if (valueFromHelper && typeof valueFromHelper === 'object' && (valueFromHelper as any).tagtext !== undefined) {
                const tagText = (valueFromHelper as any).tagtext;
                if (typeof tagText === 'string' || typeof tagText === 'number') poleNumForProcessing = tagText;
            } else if (typeof valueFromHelper === 'string' || typeof valueFromHelper === 'number') {
                poleNumForProcessing = valueFromHelper;
            }
        }
    }
    if (poleNumForProcessing === null) {
        const electricPoleTagAttr = p.attributes?.electric_pole_tag;
        if (electricPoleTagAttr && typeof electricPoleTagAttr === 'object' && (electricPoleTagAttr as any).assessment !== undefined) {
            const assessmentVal = (electricPoleTagAttr as any).assessment;
             if (typeof assessmentVal === 'string' || typeof assessmentVal === 'number') poleNumForProcessing = assessmentVal;
        } else if (electricPoleTagAttr) {
            const val = getFirstValueFromKatapultAttribute(electricPoleTagAttr);
            if(val && typeof val === 'object' && (val as any).assessment !== undefined) {
                const assessmentValNested = (val as any).assessment;
                 if (typeof assessmentValNested === 'string' || typeof assessmentValNested === 'number') poleNumForProcessing = assessmentValNested;
            } else if (typeof val === 'string' || typeof val === 'number') {
                poleNumForProcessing = val;
            }
        }
    }
    if (poleNumForProcessing === null) {
        const dlocNumberAttr = p.attributes?.DLOC_number;
        if (dlocNumberAttr) { 
            const val = getFirstValueFromKatapultAttribute(dlocNumberAttr);
             if (typeof val === 'string' || typeof val === 'number') poleNumForProcessing = val;
        }
    }
    if (poleNumForProcessing === null && p.PoleNumber !== undefined) {
        if (typeof p.PoleNumber === 'string' || typeof p.PoleNumber === 'number') poleNumForProcessing = p.PoleNumber;
    }
    const katPoleNum = normalizePoleNum(poleNumForProcessing);

    const spec: string | null = getKatapultSpecFromNodeAndBirthmarks(p, birthmarks);
    
    const existingPctRaw = getFirstValueFromKatapultAttribute(p.attributes?.["existing_capacity_%"]);
    const existingPct = existingPctRaw !== null ? normalizeNumber(existingPctRaw) : normalizeNumber(p["Condition (%)"]); 
    
    const finalPctRaw = getFirstValueFromKatapultAttribute(p.attributes?.["final_passing_capacity_%"]);
    const finalPct = finalPctRaw !== null ? normalizeNumber(finalPctRaw) : null;

    const poleNodeActualId = p._nodeKey; // Use the stored node key
    const commDrop = getKatapultCommDrop(poleNodeActualId, fullKatapultJson);

    return {
      originalIndex: index,
      originalDataSource: 'katapult' as const,
      scid: katScid, 
      poleNum: katPoleNum,
      coords: coords,
      spec: spec,
      existingPct: existingPct,
      finalPct: finalPct, 
      commDrop: commDrop, 
      rawData: p, // p is KatapultJsonNode, which extends RawKatapultPole
    };
  });
}

export function calculateHaversineDistance(coord1: Coordinate, coord2: Coordinate): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371e3; 

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lon - coord1.lon);
  const lat1Rad = toRad(coord1.lat);
  const lat2Rad = toRad(coord2.lat);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


interface SpecComponents {
  heightFt: number | null;
  poleClass: string | null;
  species: string | null;
}

function _extractSpecComponents(originalSpec: string): SpecComponents {
  const emptyResult: SpecComponents = { heightFt: null, poleClass: null, species: null };
  if (!originalSpec) return emptyResult;

  let spec = String(originalSpec).toUpperCase().replace(/\s+/g, ' ').trim();

  let heightFt: number | null = null;
  let poleClass: string | null = null;
  
  const heightClassPattern = /(\d+)\s*-\s*([\w\d.-]+)/; 
  let match = spec.match(heightClassPattern);

  if (match) {
    const hNum = parseInt(match[1], 10);
    if (!isNaN(hNum)) heightFt = hNum;
    poleClass = normalizeString(match[2]); 
    spec = spec.replace(match[0], '').trim(); 
  } else {
    const heightPattern = /(\d+)\s*(?:FT|'|FEET\b)/; 
    match = spec.match(heightPattern);
    if (match) {
      const hNum = parseInt(match[1], 10);
      if (!isNaN(hNum)) heightFt = hNum;
      spec = spec.replace(match[0], '').trim();
    } else {
      const justHeightPattern = /^(\d+)(\s+[A-Z].*)?$/; 
      match = spec.match(justHeightPattern);
      if (match) {
          const hNum = parseInt(match[1], 10);
          if (!isNaN(hNum) && hNum > 10 && hNum < 200) { 
            heightFt = hNum;
            spec = spec.replace(match[1], '').trim();
          }
      }
    }

    const classPattern = /(?:CL|CLASS)\s+([\w\d.-]+)/; 
    match = spec.match(classPattern);
    if (match) {
      poleClass = normalizeString(match[1]); 
      spec = spec.replace(match[0], '').trim();
    }
  }
  
  const species = spec.trim() || null;

  return { heightFt, poleClass, species };
}

export function normalizePoleSpec(spec?: string | null): string | null {
  if (spec === null || spec === undefined || String(spec).trim() === '') return null;
  
  const cleanedSpec = String(spec).toUpperCase().replace(/\s+/g, ' ').trim();
  if (!cleanedSpec) return null;

  const { heightFt, poleClass, species } = _extractSpecComponents(cleanedSpec);
  
  return _buildPoleSpecStringFromParts(heightFt, poleClass, species);
}


function specsMatchSimilar(spec1Str: string | null, spec2Str: string | null): boolean {
  if (!spec1Str && !spec2Str) return true; 
  if (!spec1Str || !spec2Str) return false; 

  const normalizedSpec1 = normalizePoleSpec(spec1Str);
  const normalizedSpec2 = normalizePoleSpec(spec2Str);

  if (!normalizedSpec1 && !normalizedSpec2) return true;
  if (!normalizedSpec1 || !normalizedSpec2) return false;


  const components1 = _extractSpecComponents(normalizedSpec1);
  const components2 = _extractSpecComponents(normalizedSpec2);

  if (components1.heightFt !== null && components2.heightFt !== null) {
    if (Math.abs(components1.heightFt - components2.heightFt) > POLE_SPEC_HEIGHT_TOLERANCE_FEET) {
      return false;
    }
  } else if (components1.heightFt !== null || components2.heightFt !== null) {
    return false; 
  }

  if (components1.poleClass && components2.poleClass) {
    if (components1.poleClass !== components2.poleClass) {
      return false;
    }
  } else if (components1.poleClass || components2.poleClass) {
    return false;
  }
  return true;
}


let poleIdCounter = 0; 

function createProcessedPoleEntry(
    tier: MatchTier, 
    spidaPole?: NormalizedPole, 
    katapultPole?: NormalizedPole,
    distanceMeters?: number | null
): ProcessedPole {
  poleIdCounter++;
  const id = `pole-${poleIdCounter}`;

  const spidaSpec = spidaPole?.spec || null; 
  const katapultSpec = katapultPole?.spec || null;
  const spidaExistingPct = spidaPole?.existingPct;
  const katapultExistingPct = katapultPole?.existingPct;
  const spidaFinalPct = spidaPole?.finalPct;
  const katapultFinalPct = katapultPole?.finalPct; 
  const spidaCommDrop = spidaPole?.commDrop;
  const katapultCommDrop = katapultPole?.commDrop;

  const bothPolesExist = !!(spidaPole && katapultPole);

  const isScidMismatch = bothPolesExist && spidaPole.scid !== katapultPole.scid;
  const isPoleNumMismatch = bothPolesExist && spidaPole.poleNum !== katapultPole.poleNum;
  
  let isCoordsMismatch = false;
  if (spidaPole?.coords && katapultPole?.coords) {
    const dist = calculateHaversineDistance(spidaPole.coords, katapultPole.coords);
    if (tier === MatchTier.SCID_EXACT_MATCH || tier === MatchTier.POLE_NUMBER_MATCH) {
         isCoordsMismatch = dist > COORDINATE_MATCH_THRESHOLD_METERS.VERIFIED_SPEC; 
    }
  } else if (bothPolesExist && (spidaPole?.coords || katapultPole?.coords)) { 
      isCoordsMismatch = true;
  }

  const isSpecMismatch = bothPolesExist && !specsMatchSimilar(spidaSpec, katapultSpec);
  const isExistingPctMismatch = bothPolesExist && spidaExistingPct !== katapultExistingPct;
  
  let isFinalPctMismatch = false;
  if (bothPolesExist) {
    if (spidaFinalPct !== null && katapultFinalPct !== null) {
      isFinalPctMismatch = spidaFinalPct !== katapultFinalPct;
    } else if (spidaFinalPct !== null && katapultFinalPct === null) {
       isFinalPctMismatch = spidaFinalPct !== 0; 
    } else if (spidaFinalPct === null && katapultFinalPct !== null) {
       isFinalPctMismatch = katapultFinalPct !== 0; 
    }
  }
                             
  let isCommDropMismatch = false;
  if (bothPolesExist) {
    if (spidaCommDrop !== null && katapultCommDrop !== null) {
      isCommDropMismatch = spidaCommDrop !== katapultCommDrop;
    } else if (spidaCommDrop !== null || katapultCommDrop !== null) { 
      isCommDropMismatch = true; 
    }
  }

  let mapCoords: Coordinate | undefined = undefined;
  if (tier === MatchTier.UNMATCHED_SPIDA && spidaPole?.coords) mapCoords = spidaPole.coords;
  else if (tier === MatchTier.UNMATCHED_KATAPULT && katapultPole?.coords) mapCoords = katapultPole.coords;
  else if (spidaPole?.coords) mapCoords = spidaPole.coords; 
  else if (katapultPole?.coords) mapCoords = katapultPole.coords;

  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toString()}%`;
  };

  return {
    id,
    matchTier: tier,
    spida: spidaPole,
    katapult: katapultPole,
    displaySpidaScid: spidaPole?.scid ?? 'N/A',
    displayKatapultScid: katapultPole?.scid ?? 'N/A',
    displaySpidaPoleNum: spidaPole?.poleNum ?? 'N/A',
    displayKatapultPoleNum: katapultPole?.poleNum ?? 'N/A',
    displaySpidaPoleSpec: spidaPole?.spec ?? 'N/A',
    displayKatapultPoleSpec: katapultPole?.spec ?? 'N/A',
    displaySpidaExistingPct: formatPercentage(spidaPole?.existingPct),
    displayKatapultExistingPct: formatPercentage(katapultPole?.existingPct),
    displaySpidaFinalPct: formatPercentage(spidaPole?.finalPct),
    displayKatapultFinalPct: formatPercentage(katapultPole?.finalPct),
    displaySpidaCommDrop: spidaPole?.commDrop === null ? 'N/A' : (spidaPole?.commDrop ? 'Yes' : 'No'),
    displayKatapultCommDrop: katapultPole?.commDrop === null ? 'N/A' : (katapultPole?.commDrop ? 'Yes' : 'No'),
    
    editableSpidaSpec: spidaPole?.spec ?? '',
    editableSpidaExistingPct: spidaPole?.existingPct?.toString() ?? '',
    editableSpidaFinalPct: spidaPole?.finalPct?.toString() ?? '',
    editableSpidaCommDrop: spidaPole?.commDrop === null ? '' : (spidaPole?.commDrop ? 'Yes' : 'No'),

    isScidMismatch,
    isPoleNumMismatch,
    isCoordsMismatch,
    isSpecMismatch,
    isExistingPctMismatch,
    isFinalPctMismatch,
    isCommDropMismatch,

    mapCoords,
    spidaMapCoords: spidaPole?.coords || undefined,
    katapultMapCoords: katapultPole?.coords || undefined,
    matchDistanceMeters: distanceMeters,
    isEdited: false,
  };
}


export function performComparison(
  spidaPoles: NormalizedPole[],
  katapultPoles: NormalizedPole[]
): { processedPoles: ProcessedPole[], stats: ComparisonStats } {
  poleIdCounter = 0; 
  const results: ProcessedPole[] = [];
  const stats: ComparisonStats = JSON.parse(JSON.stringify(INITIAL_STATS)); 
  stats.totalSpidaPoles = spidaPoles.length;
  stats.totalKatapultPoles = katapultPoles.length;

  const spidaMatchedIndices = new Set<number>();
  const katapultMatchedIndices = new Set<number>();

  // Tier 1: SCID Exact Match
  spidaPoles.forEach((sPole, sIdx) => {
    if (sPole.scid) { 
      katapultPoles.forEach((kPole, kIdx) => {
        if (!spidaMatchedIndices.has(sIdx) && !katapultMatchedIndices.has(kIdx) && kPole.scid && kPole.scid === sPole.scid) {
          results.push(createProcessedPoleEntry(MatchTier.SCID_EXACT_MATCH, sPole, kPole));
          spidaMatchedIndices.add(sIdx);
          katapultMatchedIndices.add(kIdx);
          stats.matchesByTier[MatchTier.SCID_EXACT_MATCH]++;
          stats.totalMatches++;
        }
      });
    }
  });

  // Tier 2: Pole Number Match
  spidaPoles.forEach((sPole, sIdx) => {
    if (!spidaMatchedIndices.has(sIdx) && sPole.poleNum) { 
      katapultPoles.forEach((kPole, kIdx) => {
        if (!katapultMatchedIndices.has(kIdx) && kPole.poleNum && kPole.poleNum === sPole.poleNum) {
          results.push(createProcessedPoleEntry(MatchTier.POLE_NUMBER_MATCH, sPole, kPole));
          spidaMatchedIndices.add(sIdx);
          katapultMatchedIndices.add(kIdx);
          stats.matchesByTier[MatchTier.POLE_NUMBER_MATCH]++;
          stats.totalMatches++;
        }
      });
    }
  });
  
  spidaPoles.forEach((sPole, sIdx) => {
    if (!spidaMatchedIndices.has(sIdx) && sPole.coords) {
      let bestCoordMatch: {kPole: NormalizedPole, kIdx: number, distance: number} | null = null;
      
      katapultPoles.forEach((kPole, kIdx) => {
        if (!katapultMatchedIndices.has(kIdx) && kPole.coords) {
          const distance = calculateHaversineDistance(sPole.coords!, kPole.coords!);
          if (distance < COORDINATE_MATCH_THRESHOLD_METERS.VERIFIED_SPEC) { 
            if (!bestCoordMatch || distance < bestCoordMatch.distance) {
              bestCoordMatch = { kPole, kIdx, distance };
            }
          }
        }
      });

      if (bestCoordMatch) {
        const {kPole, kIdx, distance} = bestCoordMatch;
        if (distance < COORDINATE_MATCH_THRESHOLD_METERS.DIRECT) { 
          if (specsMatchSimilar(sPole.spec, kPole.spec)) {
             results.push(createProcessedPoleEntry(MatchTier.COORDINATE_SPEC_VERIFIED, sPole, kPole, distance));
             stats.matchesByTier[MatchTier.COORDINATE_SPEC_VERIFIED]++;
          } else {
             results.push(createProcessedPoleEntry(MatchTier.COORDINATE_DIRECT_MATCH, sPole, kPole, distance));
             stats.matchesByTier[MatchTier.COORDINATE_DIRECT_MATCH]++;
          }
          spidaMatchedIndices.add(sIdx);
          katapultMatchedIndices.add(kIdx);
          stats.totalMatches++;
        } else { 
          if (specsMatchSimilar(sPole.spec, kPole.spec)) {
            results.push(createProcessedPoleEntry(MatchTier.COORDINATE_SPEC_VERIFIED, sPole, kPole, distance));
            spidaMatchedIndices.add(sIdx);
            katapultMatchedIndices.add(kIdx);
            stats.matchesByTier[MatchTier.COORDINATE_SPEC_VERIFIED]++;
            stats.totalMatches++;
          }
        }
      }
    }
  });


  katapultPoles.forEach((kPole, kIdx) => {
    if (!katapultMatchedIndices.has(kIdx)) {
      results.push(createProcessedPoleEntry(MatchTier.UNMATCHED_KATAPULT, undefined, kPole));
      stats.matchesByTier[MatchTier.UNMATCHED_KATAPULT]++;
    }
  });

  spidaPoles.forEach((sPole, sIdx) => {
    if (!spidaMatchedIndices.has(sIdx)) {
      results.push(createProcessedPoleEntry(MatchTier.UNMATCHED_SPIDA, sPole, undefined));
      stats.matchesByTier[MatchTier.UNMATCHED_SPIDA]++;
    }
  });
  
  if (stats.totalSpidaPoles > 0) { 
    stats.matchSuccessRate = ((stats.totalMatches / stats.totalSpidaPoles) * 100).toFixed(2) + "%";
  } else if (stats.totalKatapultPoles > 0) { 
     stats.matchSuccessRate = "SPIDA N/A"; 
  } else { 
    stats.matchSuccessRate = "N/A";
  }

  results.sort((a, b) => {
    const tierOrder = Object.values(MatchTier);
    const tierAIndex = tierOrder.indexOf(a.matchTier);
    const tierBIndex = tierOrder.indexOf(b.matchTier);

    if (tierAIndex !== tierBIndex) {
      return tierAIndex - tierBIndex;
    }
    if (a.matchTier === MatchTier.UNMATCHED_SPIDA || a.spida) {
      const scidA = parseInt(a.spida?.scid || '99999', 10);
      const scidB = parseInt(b.spida?.scid || '99999', 10);
      if(scidA !== scidB) return scidA - scidB;
    }
    if (a.matchTier === MatchTier.UNMATCHED_KATAPULT || a.katapult) {
      const scidA = parseInt(a.katapult?.scid || '99999', 10);
      const scidB = parseInt(b.katapult?.scid || '99999', 10);
       if(scidA !== scidB) return scidA - scidB;
    }
    return (a.spida?.originalIndex ?? Infinity) - (b.spida?.originalIndex ?? Infinity);
  });


  return { processedPoles: results, stats };
}

export function recalculateMismatchFlags(pole: ProcessedPole): ProcessedPole {
  const updatedPole = { ...pole };
  const bothPolesExist = !!(updatedPole.spida && updatedPole.katapult);

  const editableSpidaSpecNorm = normalizePoleSpec(updatedPole.editableSpidaSpec);
  const katapultSpecNorm = updatedPole.katapult?.spec; 
  
  updatedPole.isSpecMismatch = bothPolesExist && !specsMatchSimilar(editableSpidaSpecNorm, katapultSpecNorm);
  
  const spidaExistingPct = normalizeNumber(updatedPole.editableSpidaExistingPct);
  const katapultExistingPct = updatedPole.katapult?.existingPct; 
  updatedPole.isExistingPctMismatch = bothPolesExist && spidaExistingPct !== katapultExistingPct;
  
  const spidaFinalPct = normalizeNumber(updatedPole.editableSpidaFinalPct ?? null);
  const katapultFinalPct = updatedPole.katapult?.finalPct;

  if (bothPolesExist) {
    if (spidaFinalPct !== null && katapultFinalPct !== null) {
      updatedPole.isFinalPctMismatch = spidaFinalPct !== katapultFinalPct;
    } else if (spidaFinalPct !== null && katapultFinalPct === null) {
      updatedPole.isFinalPctMismatch = spidaFinalPct !== 0; 
    } else if (spidaFinalPct === null && katapultFinalPct !== null) {
      updatedPole.isFinalPctMismatch = katapultFinalPct !== 0; 
    } else { 
      updatedPole.isFinalPctMismatch = false;
    }

    const spidaCommDropVal = updatedPole.editableSpidaCommDrop === 'Yes' ? true : updatedPole.editableSpidaCommDrop === 'No' ? false : null;
    const katapultCommDropVal = updatedPole.katapult?.commDrop; 

    if (spidaCommDropVal !== null && katapultCommDropVal !== null) {
      updatedPole.isCommDropMismatch = spidaCommDropVal !== katapultCommDropVal;
    } else if (spidaCommDropVal !== null || katapultCommDropVal !== null) { 
      updatedPole.isCommDropMismatch = true; 
    } else { 
      updatedPole.isCommDropMismatch = false;
    }
  } else { 
    updatedPole.isSpecMismatch = false;
    updatedPole.isExistingPctMismatch = false;
    updatedPole.isFinalPctMismatch = false;
    updatedPole.isCommDropMismatch = false;
  }
  
  return updatedPole;
}

// Export commonNormalizePoleNum for use in other files
export { commonNormalizePoleNum };