/**
 * Work Description Service - Enhanced logic based on Python SPIDA Summary Generator
 * Provides sophisticated rule-based work description generation for cover sheet notes
 */

import { SpidaDesign } from '../types';

// Utility functions for safe data extraction
function getValue(data: any, key: string, defaultValue: any = 0): any {
  if (data && typeof data === 'object') {
    const item = data[key];
    if (item && typeof item === 'object' && 'value' in item) {
      return item.value;
    }
    return item !== null && item !== undefined ? item : defaultValue;
  }
  return defaultValue;
}

function getOwnerId(item: any): string {
  const owner = item?.owner;
  if (owner && typeof owner === 'object') {
    return owner.id || '';
  }
  return String(owner || '');
}

function azimuthToDirection(azimuth: number): string {
  if (typeof azimuth !== 'number') {
    return 'Unknown';
  }
  const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest', 'North'];
  const index = Math.round(azimuth / 45);
  return directions[index] || 'Unknown';
}

function numberToWords(num: number): string {
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  if (num > 0 && num < words.length) {
    return words[num];
  }
  return String(num);
}

interface WorkDescriptionOptions {
  measured: SpidaDesign;
  recommended: SpidaDesign;
  poleScid?: string;
}

/**
 * Enhanced work description generator based on Python logic
 */
export class WorkDescriptionService {
  
  /**
   * Generates work description by comparing measured and recommended designs
   */
  generateWorkDescription(options: WorkDescriptionOptions): string {
    const { measured, recommended } = options;
    const phrases: string[] = [];

    const measuredStructure = measured.structure || {};
    const recommendedStructure = recommended.structure || {};

    // Rule 1: Pole Replacement
    const poleReplacement = this.checkPoleReplacement(measuredStructure, recommendedStructure);
    if (poleReplacement) {
      phrases.push(poleReplacement);
    }

    // Rule 2: Stub Pole Transfers
    const stubTransfers = this.checkStubPoleTransfers(measuredStructure, recommendedStructure);
    phrases.push(...stubTransfers);

    // Rule 3: Vertical Relocations
    const verticalRelocations = this.checkVerticalRelocations(measuredStructure, recommendedStructure);
    phrases.push(...verticalRelocations);

    // Rule 4: Fiber Installation
    const fiberInstallation = this.checkFiberInstallation(measuredStructure, recommendedStructure);
    if (fiberInstallation) {
      phrases.push(fiberInstallation);
    }

    // Rule 5: Risers
    const risers = this.checkRisers(measuredStructure, recommendedStructure);
    phrases.push(...risers);

    // Rule 6: Guying
    const guying = this.checkGuying(measuredStructure, recommendedStructure);
    phrases.push(...guying);

    // Rule 7: Repairs (from damages array)
    if (recommendedStructure.damages && recommendedStructure.damages.length > 0) {
      phrases.push('Repair damaged comm.');
    }

    // Filter out empty phrases and join
    const result = phrases.filter(phrase => phrase && phrase.trim()).join(' ');
    
    // Default fallback if no specific work identified
    return result || 'Install Charter Fiber.';
  }

  /**
   * Check for pole replacement needs
   */
  private checkPoleReplacement(measuredStructure: any, recommendedStructure: any): string | null {
    const measuredPole = measuredStructure.pole?.clientItem || {};
    const recommendedPole = recommendedStructure.pole?.clientItem || {};

    const measuredHeight = getValue(measuredPole, 'height');
    const recommendedHeight = getValue(recommendedPole, 'height');
    
    const measuredClass = measuredPole.classOfPole;
    const recommendedClass = recommendedPole.classOfPole;

    if (measuredHeight !== recommendedHeight || measuredClass !== recommendedClass) {
      return 'Replace pole to resolve structural/clearance violations.';
    }

    return null;
  }

  /**
   * Check for stub pole transfers
   */
  private checkStubPoleTransfers(measuredStructure: any, recommendedStructure: any): string[] {
    const phrases: string[] = [];

    // Check wires for stub pole comments
    const measuredWires = measuredStructure.wires || [];
    const recommendedWires = recommendedStructure.wires || [];

    for (const measuredWire of measuredWires) {
      const comment = String(measuredWire.comment || '').toLowerCase();
      if (comment.includes('stub pole')) {
        // Check if this wire still exists in recommended
        const wireExistsInRec = recommendedWires.some((recWire: any) => 
          recWire.externalId === measuredWire.externalId
        );
        if (!wireExistsInRec) {
          phrases.push('Transfer comms from stub pole. Stub pole removal needed.');
          break;
        }
      }
    }

    // Check equipment for stub pole comments
    const measuredEquipments = measuredStructure.equipments || [];
    const recommendedEquipments = recommendedStructure.equipments || [];

    for (const measuredEquip of measuredEquipments) {
      const comment = String(measuredEquip.comment || '').toLowerCase();
      if (comment.includes('stub pole')) {
        const equipExistsInRec = recommendedEquipments.some((recEquip: any) => 
          recEquip.externalId === measuredEquip.externalId
        );
        if (!equipExistsInRec) {
          phrases.push('Transfer comms from stub pole. Stub pole removal needed.');
          break;
        }
      }
    }

    return phrases;
  }

  /**
   * Check for vertical relocations (height changes)
   */
  private checkVerticalRelocations(measuredStructure: any, recommendedStructure: any): string[] {
    const phrases: string[] = [];
    const heightThreshold = 0.15; // 15cm threshold in meters

    // Create lookup maps for measured wires and equipment
    const measuredWiresByExternalId = new Map();
    (measuredStructure.wires || []).forEach((wire: any) => {
      if (wire.externalId) {
        measuredWiresByExternalId.set(wire.externalId, wire);
      }
    });

    const measuredEquipsByExternalId = new Map();
    (measuredStructure.equipments || []).forEach((equip: any) => {
      if (equip.externalId) {
        measuredEquipsByExternalId.set(equip.externalId, equip);
      }
    });

    // Check recommended wires for height changes
    (recommendedStructure.wires || []).forEach((recWire: any) => {
      const usageGroup = String(recWire.usageGroup || '');
      if (usageGroup.includes('COMM') && recWire.externalId && measuredWiresByExternalId.has(recWire.externalId)) {
        const measuredWire = measuredWiresByExternalId.get(recWire.externalId);
        const measuredHeight = getValue(measuredWire, 'attachmentHeight');
        const recHeight = getValue(recWire, 'attachmentHeight');
        
        if (Math.abs(recHeight - measuredHeight) > heightThreshold) {
          if (recHeight > measuredHeight) {
            phrases.push('Raise comms to resolve ground clearance violations.');
          } else {
            phrases.push('Lower comms to allow room for new attachment.');
          }
        }
      }
    });

    // Check equipment (drip loops) for height changes
    (recommendedStructure.equipments || []).forEach((recEquip: any) => {
      const equipType = String(recEquip.clientItem?.type || '').toUpperCase();
      if (equipType.includes('DRIP') && recEquip.externalId && measuredEquipsByExternalId.has(recEquip.externalId)) {
        const measuredEquip = measuredEquipsByExternalId.get(recEquip.externalId);
        const measuredHeight = getValue(measuredEquip, 'attachmentHeight');
        const recHeight = getValue(recEquip, 'attachmentHeight');
        
        if (recHeight - measuredHeight > heightThreshold) {
          phrases.push('Raise drip loop to allow room for new attachment.');
        }
      }
    });

    // Return unique phrases only
    return [...new Set(phrases)];
  }

  /**
   * Check for fiber installation
   */
  private checkFiberInstallation(measuredStructure: any, recommendedStructure: any): string | null {
    // Get Spectrum wire external IDs
    const measuredSpectrumWires = new Set(
      (measuredStructure.wires || [])
        .filter((wire: any) => getOwnerId(wire) === 'Spectrum')
        .map((wire: any) => wire.externalId)
        .filter(Boolean)
    );

    const recommendedSpectrumWires = new Set(
      (recommendedStructure.wires || [])
        .filter((wire: any) => getOwnerId(wire) === 'Spectrum')
        .map((wire: any) => wire.externalId)
        .filter(Boolean)
    );

    // Find new Spectrum wires
    const newSpectrumWires = new Set(
      [...recommendedSpectrumWires].filter(id => !measuredSpectrumWires.has(id))
    );

    if (newSpectrumWires.size > 0) {
      if (measuredSpectrumWires.size > 0) {
        // Existing Spectrum wires present
        return 'Install Charter Fiber and splice onto existing attachment.';
      } else {
        return 'Install Charter Fiber.';
      }
    }

    return null;
  }

  /**
   * Check for riser installations
   */
  private checkRisers(measuredStructure: any, recommendedStructure: any): string[] {
    const phrases: string[] = [];

    // Get riser external IDs
    const measuredRisers = new Set(
      (measuredStructure.equipments || [])
        .filter((equip: any) => equip.clientItem?.type === 'RISER')
        .map((equip: any) => equip.externalId)
        .filter(Boolean)
    );

    const recommendedRisers = new Set(
      (recommendedStructure.equipments || [])
        .filter((equip: any) => equip.clientItem?.type === 'RISER' && getOwnerId(equip) === 'Spectrum')
        .map((equip: any) => equip.externalId)
        .filter(Boolean)
    );

    // Find new risers
    const newRisers = new Set(
      [...recommendedRisers].filter(id => !measuredRisers.has(id))
    );

    if (newRisers.size > 0) {
      const measuredGuys = measuredStructure.guys || [];
      const recommendedGuys = recommendedStructure.guys || [];

      if (recommendedGuys.length > measuredGuys.length) {
        // New guy added - underground bore
        if (recommendedGuys.length > 0) {
          const lastGuy = recommendedGuys[recommendedGuys.length - 1];
          const guyAzimuth = getValue(lastGuy, 'azimuth', 0);
          const direction = azimuthToDirection(guyAzimuth);
          phrases.push(`Install Charter Fiber and riser. Bore underground to ${direction} service location.`);
        }
      } else {
        // No new guy - aerial construction
        phrases.push('Install Charter Fiber and riser. Continue aerial construction to the North.');
      }
    }

    return phrases;
  }

  /**
   * Check for guying changes
   */
  private checkGuying(measuredStructure: any, recommendedStructure: any): string[] {
    const phrases: string[] = [];

    const measuredGuys = measuredStructure.guys || [];
    const recommendedGuys = recommendedStructure.guys || [];
    
    const guysAdded = recommendedGuys.length - measuredGuys.length;

    if (guysAdded > 0) {
      if (guysAdded === 1) {
        phrases.push('Proposed down guy added.');
      } else {
        const numWord = numberToWords(guysAdded);
        phrases.push(`${numWord} proposed down guys added.`);
      }
    }

    // Check for anchor rearrangement
    const measuredAnchors = measuredStructure.anchors || [];
    const recommendedAnchors = recommendedStructure.anchors || [];

    if (measuredAnchors.length > 0 && recommendedAnchors.length > 0) {
      for (let i = 0; i < recommendedAnchors.length; i++) {
        if (i < measuredAnchors.length) {
          const measuredAnchor = measuredAnchors[i];
          const recommendedAnchor = recommendedAnchors[i];
          
          const measuredDist = getValue(measuredAnchor, 'leadDistance', getValue(measuredAnchor, 'distance', 0));
          const recDist = getValue(recommendedAnchor, 'leadDistance', getValue(recommendedAnchor, 'distance', 0));

          if (Math.abs(measuredDist - recDist) > 1.0) { // More than 1 meter change
            phrases.push('Rearrange comm anchors to resolve comm to power anchor violation.');
            break;
          }
        }
      }
    }

    return phrases;
  }

  /**
   * Generate enhanced work description with detailed analysis
   */
  generateDetailedWorkDescription(options: WorkDescriptionOptions): {
    description: string;
    analysis: {
      poleReplacement: boolean;
      stubPoleTransfers: string[];
      verticalRelocations: string[];
      fiberInstallation: string | null;
      risers: string[];
      guying: string[];
      repairs: boolean;
    };
  } {
    const { measured, recommended } = options;
    const measuredStructure = measured.structure || {};
    const recommendedStructure = recommended.structure || {};

    const analysis = {
      poleReplacement: !!this.checkPoleReplacement(measuredStructure, recommendedStructure),
      stubPoleTransfers: this.checkStubPoleTransfers(measuredStructure, recommendedStructure),
      verticalRelocations: this.checkVerticalRelocations(measuredStructure, recommendedStructure),
      fiberInstallation: this.checkFiberInstallation(measuredStructure, recommendedStructure),
      risers: this.checkRisers(measuredStructure, recommendedStructure),
      guying: this.checkGuying(measuredStructure, recommendedStructure),
      repairs: !!(recommendedStructure.damages && recommendedStructure.damages.length > 0)
    };

    const description = this.generateWorkDescription(options);

    return {
      description,
      analysis
    };
  }
}

// Export a singleton instance
export const workDescriptionService = new WorkDescriptionService();
