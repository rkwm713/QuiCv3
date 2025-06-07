import { 
  SpidaJsonFullFormat, 
  SpidaProjectStructure, 
  SpidaLocation, 
  SpidaDesign,
  Attachment, 
  ComparisonRow, 
  QCComparisonData, 
  DesignMap,
  KatapultJsonFormat 
} from '../types';
import { _to_feet_ts } from './dataProcessingService';
import { extractKatapultAttachments } from './katapultExtractService';

/**
 * Extract attachments from a SPIDA design based on SPIDAcalc structure
 */
function extractAttachmentsFromDesign(
  design: SpidaDesign, 
  poleScid: string, 
  layerType: 'Measured' | 'Recommended'
): Attachment[] {
  const attachments: Attachment[] = [];
  
  // Get pole owner
  const poleOwner = design.structure?.pole?.owner ?? 'Unknown';
  
  try {
    // Extract TRUE wire attachments from structure.wires (this is where the real wire data is)
    const wiresList = design.structure?.wires ?? [];
    wiresList.forEach((wire: any, i: number) => {
      try {
        const id = wire.id ?? `wire-${i}`;
        const heightMetres = 
          wire.attachmentHeight?.value ??
          wire.relativeElevation?.value ??
          0;
        const heightFt = _to_feet_ts(heightMetres) || 0;
        
        // Get wire owner and details
        const owner = wire.owner?.id || poleOwner;
        const size = wire.clientItem?.size || 
                    wire.clientItem?.displayName || 
                    wire.clientItemVersion || 
                    wire.usageGroup || 
                    '';
        const type = wire.tensionGroup || 'Wire';
        
        if (heightFt > 0) {
          attachments.push({
            poleScid,
            id: String(id),
            owner: String(owner),
            type: String(type),
            size: String(size),
            height: heightFt,
            direction: wire.direction ?? wire.directionDegrees,
            source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
            rawData: wire
          });
        }
      } catch (error) {
        console.warn(`Failed to extract wire:`, error);
      }
    });
    
    // Extract wireEndPoints as fallback (but these often have relativeElevation.value === 0)
    const wireEnds = design.structure?.wireEndPoints ?? [];
    if (Array.isArray(wireEnds)) {
      wireEnds.forEach((wep: any, i: number) => {
        try {
          const id = wep.id ?? `wireEnd-${i}`;
          const heightMetres = 
            wep.attachmentHeight?.value ??
            wep.attachmentHeight ??
            wep.relativeElevation?.value ??
            0;
          const heightFt = _to_feet_ts(heightMetres) || 0;
          
          // Only include if height > 0 (many wireEndPoints have 0 height)
          if (heightFt > 0) {
            const size = wep.conductorSize || 
                        wep.clientItem?.displayName ||
                        wep.clientItemVersion?.displayName ||
                        wep.catalogItem?.displayName ||
                        '';
            const type = wep.type || 'Wire End';
            
            attachments.push({
              poleScid,
              id: String(id),
              owner: String(poleOwner),
              type: String(type),
              size: String(size),
              height: heightFt,
              direction: typeof wep.directionDegrees === 'number' ? wep.directionDegrees : wep.direction,
              source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
              rawData: wep
            });
          }
        } catch (error) {
          console.warn(`Failed to extract wireEndPoint:`, error);
        }
      });
    }
    
    // Extract insulators - height is in offset.value (not position.z)
    const insList = design.structure?.insulators ?? [];
    insList.forEach((insulator: any, i: number) => {
      try {
        const id = insulator.id ?? `insulator-${i}`;
        // KEY FIX: insulators use offset.value for height
        const heightMetres = insulator.offset?.value ?? insulator.offset ?? 0;
        const heightFt = _to_feet_ts(heightMetres) || 0;
        
        let type = insulator.type ?? 'Insulator';
        let size = insulator.clientItem?.displayName || 
                  insulator.catalogItem?.displayName || 
                  insulator.size || 
                  '';
        
        if (heightFt > 0) {
          attachments.push({
            poleScid,
            id: String(id),
            owner: String(poleOwner),
            type: String(type),
            size: String(size),
            height: heightFt,
            direction: insulator.direction ?? insulator.directionDegrees,
            source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
            rawData: insulator
          });
        }
      } catch (error) {
        console.warn(`Failed to extract insulator:`, error);
      }
    });
    
    // Extract equipments - now looking under design.structure
    const equipList = design.structure?.equipments ?? [];
    equipList.forEach((equipment: any, i: number) => {
      try {
        const id = equipment.id ?? `equipment-${i}`;
        const heightMetres = equipment.position?.z?.value ?? equipment.position?.z ?? 0;
        const heightFt = _to_feet_ts(heightMetres) || 0;
        
        let type = equipment.type ?? 'Equipment';
        let size = '';
        
        // Get size/type from clientItem
        if (equipment.clientItem?.displayName) {
          size = equipment.clientItem.displayName;
        } else if (equipment.catalogItem?.displayName) {
          size = equipment.catalogItem.displayName;
        } else if (equipment.size) {
          size = equipment.size;
        }
        
        if (heightFt > 0) {
          attachments.push({
            poleScid,
            id: String(id),
            owner: String(poleOwner),
            type: String(type),
            size: String(size),
            height: heightFt,
            direction: typeof equipment.directionDegrees === 'number' ? equipment.directionDegrees : undefined,
            source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
            rawData: equipment
          });
        }
      } catch (error) {
        console.warn(`Failed to extract equipment:`, error);
      }
    });
    
    // Extract crossArms - now looking under design.structure
    const crossArmsList = design.structure?.crossArms ?? [];
    crossArmsList.forEach((crossArm: any, i: number) => {
      try {
        const id = crossArm.id ?? `crossarm-${i}`;
        const heightMetres = crossArm.position?.z?.value ?? crossArm.position?.z ?? 0;
        const heightFt = _to_feet_ts(heightMetres) || 0;
        
        let type = 'CrossArm';
        let size = '';
        
        // Get size/type from clientItem
        if (crossArm.clientItem?.displayName) {
          size = crossArm.clientItem.displayName;
        } else if (crossArm.catalogItem?.displayName) {
          size = crossArm.catalogItem.displayName;
        } else if (crossArm.size) {
          size = crossArm.size;
        }
        
        if (heightFt > 0) {
          attachments.push({
            poleScid,
            id: String(id),
            owner: String(poleOwner),
            type: String(type),
            size: String(size),
            height: heightFt,
            direction: typeof crossArm.directionDegrees === 'number' ? crossArm.directionDegrees : undefined,
            source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
            rawData: crossArm
          });
        }
      } catch (error) {
        console.warn(`Failed to extract crossArm:`, error);
      }
    });
    
    // Extract guys - now looking under design.structure
    const guysList = design.structure?.guys ?? [];
    guysList.forEach((guy: any, i: number) => {
      try {
        const id = guy.id ?? `guy-${i}`;
        const heightMetres = 
          guy.attachmentHeight?.value ??
          guy.relativeElevation?.value ??
          guy.position?.z?.value ??
          0;
        const heightFt = _to_feet_ts(heightMetres) || 0;
        
        let type = 'Guy';
        let size = guy.size || guy.conductorSize || '';
        
        if (guy.clientItem?.displayName) {
          size = guy.clientItem.displayName;
        } else if (guy.catalogItem?.displayName) {
          size = guy.catalogItem.displayName;
        }
        
        if (heightFt > 0) {
          attachments.push({
            poleScid,
            id: String(id),
            owner: String(poleOwner),
            type: String(type),
            size: String(size),
            height: heightFt,
            direction: guy.direction ?? guy.directionDegrees,
            source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
            rawData: guy
          });
        }
      } catch (error) {
        console.warn(`Failed to extract guy:`, error);
      }
    });
    
    // Extract spanGuys
    const spanGuysList = design.structure?.spanGuys ?? [];
    spanGuysList.forEach((spanGuy: any, i: number) => {
      try {
        const id = spanGuy.id ?? `spanGuy-${i}`;
        const heightMetres = 
          spanGuy.attachmentHeight?.value ??
          spanGuy.offset?.value ??
          spanGuy.relativeElevation?.value ??
          0;
        const heightFt = _to_feet_ts(heightMetres) || 0;
        
        if (heightFt > 0) {
          const owner = spanGuy.owner?.id || poleOwner;
          const size = spanGuy.clientItem?.displayName || 
                      spanGuy.catalogItem?.displayName || 
                      spanGuy.size || 
                      '';
          const type = 'Span Guy';
          
          attachments.push({
            poleScid,
            id: String(id),
            owner: String(owner),
            type: String(type),
            size: String(size),
            height: heightFt,
            direction: spanGuy.direction ?? spanGuy.directionDegrees,
            source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
            rawData: spanGuy
          });
        }
      } catch (error) {
        console.warn(`Failed to extract spanGuy:`, error);
      }
    });
    
    // Extract wireMountedEquipments
    const wireMountedEquipsList = design.structure?.wireMountedEquipments ?? [];
    wireMountedEquipsList.forEach((wme: any, i: number) => {
      try {
        const id = wme.id ?? `wireMountedEquip-${i}`;
        const heightMetres = 
          wme.attachmentHeight?.value ??
          wme.offset?.value ??
          wme.relativeElevation?.value ??
          0;
        const heightFt = _to_feet_ts(heightMetres) || 0;
        
        if (heightFt > 0) {
          const owner = wme.owner?.id || poleOwner;
          const size = wme.clientItem?.displayName || 
                      wme.catalogItem?.displayName || 
                      wme.size || 
                      '';
          const type = 'Wire Mounted Equipment';
          
          attachments.push({
            poleScid,
            id: String(id),
            owner: String(owner),
            type: String(type),
            size: String(size),
            height: heightFt,
            direction: wme.direction ?? wme.directionDegrees,
            source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
            rawData: wme
          });
        }
      } catch (error) {
        console.warn(`Failed to extract wireMountedEquipment:`, error);
      }
    });
    
    // Extract anchors
    const anchorsList = design.structure?.anchors ?? [];
    anchorsList.forEach((anchor: any, i: number) => {
      try {
        const id = anchor.id ?? `anchor-${i}`;
        // Anchors might not have height but could have ground line info
        const heightMetres = 
          anchor.offset?.value ??
          anchor.attachmentHeight?.value ??
          0;
        const heightFt = _to_feet_ts(heightMetres) || 0;
        
        // Include anchors even if height is 0 (ground level)
        const owner = anchor.owner?.id || poleOwner;
        const size = anchor.clientItem?.displayName || 
                    anchor.catalogItem?.displayName || 
                    anchor.size || 
                    '';
        const type = 'Anchor';
        
        attachments.push({
          poleScid,
          id: String(id),
          owner: String(owner),
          type: String(type),
          size: String(size),
          height: heightFt, // Could be 0 for ground level
          direction: anchor.direction ?? anchor.directionDegrees,
          source: layerType === 'Measured' ? 'spida-measured' : 'spida-recommended',
          rawData: anchor
        });
      } catch (error) {
        console.warn(`Failed to extract anchor:`, error);
      }
    });
    
  } catch (error) {
    console.warn(`Error extracting attachments from design ${layerType}:`, error);
  }
  
  console.log(`Extracted ${attachments.length} attachments from ${layerType} design for pole ${poleScid}`);
  return attachments;
}

/**
 * Extract measured and recommended designs from SPIDA JSON using leads structure
 */
export function extractSpidaDesigns(spidaJson: SpidaJsonFullFormat | null): DesignMap {
  const measured: Attachment[] = [];
  const recommended: Attachment[] = [];
  
  if (!spidaJson) {
    return { measured, recommended };
  }
  
  console.log('Extracting SPIDA designs from JSON...', spidaJson);
  
  // Primary extraction from leads[].locations[].designs[]
  if (spidaJson.leads && Array.isArray(spidaJson.leads)) {
    console.log(`Found ${spidaJson.leads.length} leads`);
    
    spidaJson.leads.forEach((lead, leadIndex) => {
      if (lead.locations && Array.isArray(lead.locations)) {
        console.log(`Lead ${leadIndex} has ${lead.locations.length} locations`);
        
        lead.locations.forEach((location: SpidaLocation, locationIndex) => {
          const poleScid = location.id || location.externalId || location.label || `${leadIndex}-${locationIndex}`;
          console.log(`Processing location ${locationIndex} with SCID: ${poleScid}`);
          
          if (location.designs && Array.isArray(location.designs)) {
            console.log(`Location has ${location.designs.length} designs`);
            
            location.designs.forEach(design => {
              console.log(`Processing design with layerType: ${design.layerType}`);
              
              if (design.layerType === 'Measured') {
                const attachments = extractAttachmentsFromDesign(design, poleScid, 'Measured');
                console.log(`Extracted ${attachments.length} measured attachments`);
                measured.push(...attachments);
              } else if (design.layerType === 'Recommended') {
                const attachments = extractAttachmentsFromDesign(design, poleScid, 'Recommended');
                console.log(`Extracted ${attachments.length} recommended attachments`);
                recommended.push(...attachments);
              }
            });
          } else {
            console.log(`Location ${locationIndex} has no designs array`);
          }
        });
      } else {
        console.log(`Lead ${leadIndex} has no locations array`);
      }
    });
  } else {
    console.log('No leads array found in SPIDA JSON');
  }
  
  // Fallback: try project.structures or spidadevices.structures if no leads data
  if (measured.length === 0 && recommended.length === 0) {
    console.log('No attachments found in leads, trying fallback structures...');
    
    let structuresSource: SpidaProjectStructure[] | null = null;
    if (spidaJson.project?.structures && Array.isArray(spidaJson.project.structures)) {
      structuresSource = spidaJson.project.structures;
      console.log(`Found ${structuresSource.length} structures in project.structures`);
    } else if (spidaJson.spidadevices?.structures && Array.isArray(spidaJson.spidadevices.structures)) {
      structuresSource = spidaJson.spidadevices.structures;
      console.log(`Found ${structuresSource.length} structures in spidadevices.structures`);
    }
    
    if (structuresSource) {
      structuresSource.forEach((structure, index) => {
        const poleScid = structure.id || structure.externalId || String(index + 1).padStart(3, '0');
        
        // Look for designs in structure.designs array
        if (structure.designs && Array.isArray(structure.designs)) {
          structure.designs.forEach(design => {
            if (design.layerType === 'Measured') {
              const attachments = extractAttachmentsFromDesign(design, poleScid, 'Measured');
              measured.push(...attachments);
            } else if (design.layerType === 'Recommended') {
              const attachments = extractAttachmentsFromDesign(design, poleScid, 'Recommended');
              recommended.push(...attachments);
            }
          });
        }
        
        // Also check direct recommendedDesign and measuredDesign
        if (structure.recommendedDesign) {
          const recDesign: SpidaDesign = {
            layerType: 'Recommended',
            structure: structure.recommendedDesign as any,
            ...(structure.recommendedDesign as any)
          };
          const attachments = extractAttachmentsFromDesign(recDesign, poleScid, 'Recommended');
          recommended.push(...attachments);
        }
        
        if (structure.measuredDesign) {
          const measDesign: SpidaDesign = {
            layerType: 'Measured',
            structure: structure.measuredDesign as any,
            ...(structure.measuredDesign as any)
          };
          const attachments = extractAttachmentsFromDesign(measDesign, poleScid, 'Measured');
          measured.push(...attachments);
        }
      });
    }
  }
  
  console.log(`Final extraction results: ${measured.length} measured, ${recommended.length} recommended attachments`);
  
  return { measured, recommended };
}

/**
 * Compare measured, recommended, and katapult attachments
 */
export function compareDesigns(measured: Attachment[], recommended: Attachment[], katapult: Attachment[] = []): ComparisonRow[] {
  console.log('=== COMPARISON DEBUG ===');
  console.log('Measured attachments:', measured.length);
  console.log('Recommended attachments:', recommended.length);
  console.log('Katapult attachments:', katapult.length);
  
  if (katapult.length > 0) {
    console.log('Katapult SCIDs:', [...new Set(katapult.map(a => a.poleScid))]);
  }
  if (measured.length > 0) {
    console.log('SPIDA Measured SCIDs:', [...new Set(measured.map(a => a.poleScid))]);
  }
  
  // Create a set of all unique attachment keys
  const allKeys = new Set([
    ...measured.map(a => `${a.poleScid}-${a.id}`),
    ...recommended.map(a => `${a.poleScid}-${a.id}`),
    ...katapult.map(a => `${a.poleScid}-${a.id}`)
  ]);
  
  console.log('Total unique keys:', allKeys.size);
  
  return Array.from(allKeys).map(key => {
    const meas = measured.find(a => `${a.poleScid}-${a.id}` === key);
    const rec = recommended.find(a => `${a.poleScid}-${a.id}` === key);
    const kat = katapult.find(a => `${a.poleScid}-${a.id}` === key);
    
    let status: ComparisonRow['status'];
    let deltaHeightMeasRec: number | undefined;
    let deltaHeightMeasKat: number | undefined;
    let deltaHeightRecKat: number | undefined;
    
    // Calculate deltas
    if (meas && rec) {
      deltaHeightMeasRec = rec.height - meas.height;
    }
    if (meas && kat) {
      deltaHeightMeasKat = kat.height - meas.height;
    }
    if (rec && kat) {
      deltaHeightRecKat = kat.height - rec.height;
    }
    
    // Determine status
    if (kat && !meas && !rec) {
      status = 'Katapult-Only';
    } else if (meas && rec && kat) {
      // Check if all three match
      const measRecMatch = Math.abs(deltaHeightMeasRec!) < 0.1 && 
                          meas.owner === rec.owner && 
                          meas.type === rec.type && 
                          meas.size === rec.size;
      const measKatMatch = Math.abs(deltaHeightMeasKat!) < 0.1 && 
                          meas.owner === kat.owner && 
                          meas.type === kat.type && 
                          meas.size === kat.size;
      
      if (measRecMatch && measKatMatch) {
        status = 'Match';
      } else if (measRecMatch && !measKatMatch) {
        status = 'Katapult-Mismatch';
      } else {
        status = 'Changed';
      }
    } else if (meas && rec) {
      // Only SPIDA data
      const heightMatches = Math.abs(deltaHeightMeasRec!) < 0.1;
      const ownerMatches = meas.owner === rec.owner;
      const typeMatches = meas.type === rec.type;
      const sizeMatches = meas.size === rec.size;
      
      status = (heightMatches && ownerMatches && typeMatches && sizeMatches) ? 'Match' : 'Changed';
    } else if (kat && (meas || rec)) {
      status = 'Katapult-Mismatch';
    } else if (meas && !rec) {
      status = 'Removed';
    } else {
      status = 'Added';
    }
    
    return {
      key,
      measured: meas,
      recommended: rec,
      katapult: kat,
      deltaHeightMeasRec,
      deltaHeightMeasKat,
      deltaHeightRecKat,
      status
    };
  });
}

/**
 * Generate QC comparison data from SPIDA and Katapult JSON
 */
export function generateQCComparison(
  spidaJson: SpidaJsonFullFormat | null, 
  katapultJson: KatapultJsonFormat | null = null
): QCComparisonData {
  console.log('=== QC COMPARISON DEBUG ===');
  console.log('SPIDA JSON provided:', !!spidaJson);
  console.log('Katapult JSON provided:', !!katapultJson);
  
  const designs = extractSpidaDesigns(spidaJson);
  console.log('SPIDA measured attachments:', designs.measured.length);
  console.log('SPIDA recommended attachments:', designs.recommended.length);
  
  const katapultAttachments = katapultJson ? extractKatapultAttachments(katapultJson) : [];
  console.log('Katapult attachments extracted:', katapultAttachments.length);
  
  if (katapultAttachments.length > 0) {
    console.log('Sample Katapult attachment:', katapultAttachments[0]);
  }
  
  const rows = compareDesigns(designs.measured, designs.recommended, katapultAttachments);
  
  // Calculate statistics
  const stats = {
    total: rows.length,
    matches: rows.filter(r => r.status === 'Match').length,
    changed: rows.filter(r => r.status === 'Changed').length,
    added: rows.filter(r => r.status === 'Added').length,
    removed: rows.filter(r => r.status === 'Removed').length,
    katapultOnly: rows.filter(r => r.status === 'Katapult-Only').length,
    katapultMismatch: rows.filter(r => r.status === 'Katapult-Mismatch').length,
    maxDeltaMeasRec: Math.max(0, ...rows.map(r => Math.abs(r.deltaHeightMeasRec || 0))),
    maxDeltaMeasKat: Math.max(0, ...rows.map(r => Math.abs(r.deltaHeightMeasKat || 0))),
    maxDeltaRecKat: Math.max(0, ...rows.map(r => Math.abs(r.deltaHeightRecKat || 0)))
  };
  
  console.log('QC Comparison generated:', { stats, rowCount: rows.length });
  
  return { rows, stats };
} 