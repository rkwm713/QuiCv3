import { ProcessedPole, HeightComparisonItem, HeightComparisonData, HeightComparisonStats } from '../types';

const METERS_TO_FEET = 3.28084;
const DEFAULT_THRESHOLD = 0.5; // feet
export const HEIGHT_TOLERANCE_FT = 0.5;

export class HeightComparisonService {

  /**
   * Extract accurate pole heights from raw JSON data
   * Returns Map<poleTag, { kHeightFt: number | null, sHeightFt: number | null }>
   */
  static extractPoleHeights(poles: ProcessedPole[]): Map<string, { kHeightFt: number | null, sHeightFt: number | null }> {
    const heightMap = new Map<string, { kHeightFt: number | null, sHeightFt: number | null }>();

    poles.forEach(pole => {
      const poleTag = pole.displaySpidaScid || pole.displayKatapultScid || 
                     pole.displaySpidaPoleNum || pole.displayKatapultPoleNum || 
                     pole.id;

      const kHeightFt = this.extractKatapultPoleHeight(pole.katapult?.rawData, pole.displayKatapultPoleSpec);
      const sHeightFt = this.extractSpidaPoleHeight(pole.spida?.rawData, pole.displaySpidaPoleSpec);

      heightMap.set(poleTag, { kHeightFt, sHeightFt });
    });

    return heightMap;
  }

  /**
   * Extract pole height from Katapult raw data
   */
  private static extractKatapultPoleHeight(rawData: any, fallbackSpec?: string): number | null {
    if (!rawData) return this.parseHeightFromString(fallbackSpec || '', 'katapult');

    // 1. Look for direct height attributes
    if (rawData.attributes) {
      const attrs = rawData.attributes;
      
      // measured_pole_height (feet)
      if (attrs.measured_pole_height !== undefined) {
        const height = this.extractNumberFromValue(attrs.measured_pole_height);
        if (height !== null && this.isCredibleFeet(height)) {
          return this.normalizeHeight(height);
        }
      }
      
      // total_pole_height_ft (feet)
      if (attrs.total_pole_height_ft !== undefined) {
        const height = this.extractNumberFromValue(attrs.total_pole_height_ft);
        if (height !== null && this.isCredibleFeet(height)) {
          return this.normalizeHeight(height);
        }
      }
      
      // pole_height_inches (inches → ÷ 12)
      if (attrs.pole_height_inches !== undefined) {
        const heightInches = this.extractNumberFromValue(attrs.pole_height_inches);
        if (heightInches !== null) {
          const heightFt = heightInches / 12;
          if (this.isCredibleFeet(heightFt)) {
            return this.normalizeHeight(heightFt);
          }
        }
      }
    }

    // 2. Derive from highest attachment + 2 ft
    const derivedHeight = this.deriveHeightFromAttachments(rawData);
    if (derivedHeight !== null) {
      return this.normalizeHeight(derivedHeight);
    }

    // 3. Fallback to spec string parsing
    return this.parseHeightFromString(fallbackSpec || '', 'katapult');
  }

  /**
   * Extract pole height from SPIDA raw data
   */
  private static extractSpidaPoleHeight(rawData: any, fallbackSpec?: string): number | null {
    if (!rawData) return this.parseHeightFromString(fallbackSpec || '', 'spida');

    // 1. structures[i].pole.length.value
    let height = this.extractSpidaHeightFromPath(rawData, 'pole.length');
    if (height !== null) return this.normalizeHeight(height);

    // 2. structures[i].pole.height.value
    height = this.extractSpidaHeightFromPath(rawData, 'pole.height');
    if (height !== null) return this.normalizeHeight(height);

    // 3. structures[i].design.pole.height.value (check designs array)
    if (rawData.designs && Array.isArray(rawData.designs)) {
      for (const design of rawData.designs) {
        if (design.structure?.pole?.height) {
          height = this.convertSpidaHeight(design.structure.pole.height);
          if (height !== null && this.isCredibleFeet(height)) {
            return this.normalizeHeight(height);
          }
        }
      }
    }

    // 4. Fallback to spec string parsing (assume metres for small numbers)
    return this.parseHeightFromString(fallbackSpec || '', 'spida');
  }

  /**
   * Extract height from SPIDA object path with unit handling
   */
  private static extractSpidaHeightFromPath(data: any, path: string): number | null {
    const pathParts = path.split('.');
    let current = data;
    
    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return this.convertSpidaHeight(current);
  }

  /**
   * Convert SPIDA height object to feet
   */
  private static convertSpidaHeight(heightObj: any): number | null {
    if (!heightObj) return null;

    if (typeof heightObj === 'number') {
      // Raw number - assume metres if < 60, feet otherwise
      return heightObj < 60 ? heightObj * METERS_TO_FEET : heightObj;
    }

    if (typeof heightObj === 'object' && heightObj.value !== undefined) {
      const value = heightObj.value;
      const unit = heightObj.unit;

      if (typeof value !== 'number') return null;

      if (unit === 'METRE' || unit === 'METER' || unit === 'm') {
        return value * METERS_TO_FEET;
      } else if (unit === 'FOOT' || unit === 'FEET' || unit === 'ft') {
        return value;
      } else {
        // No unit specified - assume metres if < 60, feet otherwise
        return value < 60 ? value * METERS_TO_FEET : value;
      }
    }

    return null;
  }

  /**
   * Derive pole height from highest attachment + 2 ft
   */
  private static deriveHeightFromAttachments(rawData: any): number | null {
    if (!rawData?.attributes) return null;

    let maxHeight = 0;
    let foundAttachment = false;

    Object.keys(rawData.attributes).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('height') && 
          (lowerKey.includes('wire') || lowerKey.includes('conductor') || 
           lowerKey.includes('guy') || lowerKey.includes('anchor') || 
           lowerKey.includes('equipment') || lowerKey.includes('transformer'))) {
        
        const height = this.extractNumberFromValue(rawData.attributes[key]);
        if (height !== null && height > maxHeight) {
          maxHeight = height;
          foundAttachment = true;
        }
      }
    });

    return foundAttachment ? maxHeight + 2 : null;
  }

  /**
   * 🚨 Legacy only – avoid when possible
   * Parse height from specification string (fallback)
   */
  private static parseHeightFromString(spec: string, source: 'katapult' | 'spida'): number | null {
    if (!spec || spec === 'N/A' || spec === '') return null;

    // Common patterns: "45/3", "45-3", "45ft", "45 ft", "13.7m", "13.7 m"
    const heightPatterns = [
      /(\d+(?:\.\d+)?)\s*ft/i,     // "45ft" or "45 ft"
      /(\d+(?:\.\d+)?)\s*m/i,      // "13.7m" or "13.7 m"  
      /(\d+)(?:\/\d+|-\d+)/,       // "45/3" or "45-3" (assume feet)
      /^(\d+(?:\.\d+)?)$/          // Just a number
    ];

    for (const pattern of heightPatterns) {
      const match = spec.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        
        // Handle unit conversion
        if (pattern.source.includes('m')) {
          // It's in meters, convert to feet
          return this.normalizeHeight(value * METERS_TO_FEET);
        } else if (pattern.source.includes('ft') || pattern.source.includes('\/') || pattern.source.includes('-')) {
          // It's in feet
          return this.normalizeHeight(value);
        } else {
          // Just a number - for SPIDA assume metres if < 60, for Katapult assume feet
          if (source === 'spida' && value < 60) {
            return this.normalizeHeight(value * METERS_TO_FEET);
          } else {
            return this.normalizeHeight(value);
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if height value is credible for utility poles
   */
  private static isCredibleFeet(value: number): boolean {
    return value > 15 && value < 150;
  }

  /**
   * Normalize height to single decimal place
   */
  private static normalizeHeight(heightFt: number): number {
    return Math.round(heightFt * 10) / 10;
  }
  
  /**
   * Generates height comparison data from processed poles
   */
  static generateHeightComparison(
    poles: ProcessedPole[], 
    threshold: number = DEFAULT_THRESHOLD
  ): HeightComparisonData {
    const items: HeightComparisonItem[] = [];
    
    // 1. Extract accurate pole heights first
    const poleHeightMap = this.extractPoleHeights(poles);
    
    // Add pole height comparison items
    poleHeightMap.forEach((heights, poleTag) => {
      if (heights.kHeightFt !== null || heights.sHeightFt !== null) {
        items.push({
          poleTag,
          itemType: 'Pole',
          description: 'Pole Height',
          katapultHeightFt: heights.kHeightFt,
          spidaHeightFt: heights.sHeightFt,
          delta: null, // Will be calculated in processItem
          status: 'OK' // Will be calculated in processItem
        });
      }
    });
    
    // Process each pole for wires and attachments
    poles.forEach(pole => {
      // Extract wire heights
      const wireItems = this.extractWireHeights(pole);
      items.push(...wireItems);
      
      // Extract other attachment heights
      const attachmentItems = this.extractOtherAttachments(pole);
      items.push(...attachmentItems);
    });

    // Calculate deltas and status for each item
    const processedItems = items.map(item => this.processItem(item, threshold));
    
    // Generate statistics
    const stats = this.calculateStats(processedItems);
    
    return {
      items: processedItems,
      stats,
      threshold
    };
  }



  /**
   * Extract wire height information from raw data
   */
  private static extractWireHeights(pole: ProcessedPole): HeightComparisonItem[] {
    const items: HeightComparisonItem[] = [];
    
    const poleTag = pole.displaySpidaScid || pole.displayKatapultScid || 
                   pole.displaySpidaPoleNum || pole.displayKatapultPoleNum || 
                   pole.id;

    // Extract from Katapult data
    const katapultWires = this.extractWiresFromKatapult(pole.katapult?.rawData);
    const spidaWires = this.extractWiresFromSpida(pole.spida?.rawData);

    // Create a map of all unique wire descriptions
    const allWireDescriptions = new Set<string>();
    katapultWires.forEach(wire => allWireDescriptions.add(wire.description));
    spidaWires.forEach(wire => allWireDescriptions.add(wire.description));

    // Create comparison items for each wire
    allWireDescriptions.forEach(description => {
      const katapultWire = katapultWires.find(w => w.description === description);
      const spidaWire = spidaWires.find(w => w.description === description);

      items.push({
        poleTag,
        itemType: 'Wire',
        description,
        katapultHeightFt: katapultWire?.heightFt || null,
        spidaHeightFt: spidaWire?.heightFt || null,
        delta: null,
        status: 'OK'
      });
    });

    return items;
  }

  /**
   * Extract other attachment heights
   */
  private static extractOtherAttachments(pole: ProcessedPole): HeightComparisonItem[] {
    const items: HeightComparisonItem[] = [];
    
    const poleTag = pole.displaySpidaScid || pole.displayKatapultScid || 
                   pole.displaySpidaPoleNum || pole.displayKatapultPoleNum || 
                   pole.id;

    // Extract from raw data
    const katapultAttachments = this.extractAttachmentsFromKatapult(pole.katapult?.rawData);
    const spidaAttachments = this.extractAttachmentsFromSpida(pole.spida?.rawData);

    // Create a map of all unique attachment descriptions
    const allAttachmentDescriptions = new Set<string>();
    katapultAttachments.forEach(att => allAttachmentDescriptions.add(att.description));
    spidaAttachments.forEach(att => allAttachmentDescriptions.add(att.description));

    // Create comparison items for each attachment
    allAttachmentDescriptions.forEach(description => {
      const katapultAtt = katapultAttachments.find(a => a.description === description);
      const spidaAtt = spidaAttachments.find(a => a.description === description);

      items.push({
        poleTag,
        itemType: 'Other Attachment',
        description,
        katapultHeightFt: katapultAtt?.heightFt || null,
        spidaHeightFt: spidaAtt?.heightFt || null,
        delta: null,
        status: 'OK'
      });
    });

    return items;
  }



  /**
   * Extract wire information from Katapult raw data
   */
  private static extractWiresFromKatapult(rawData: any): Array<{description: string, heightFt: number}> {
    const wires: Array<{description: string, heightFt: number}> = [];
    
    if (!rawData) return wires;

    // Look for wire/conductor information in various Katapult data structures
    // This is a simplified extraction - real implementation would need to handle Katapult's specific data format
    if (rawData.attributes) {
      // Look for conductor/wire height attributes
      Object.keys(rawData.attributes).forEach(key => {
        if (key.toLowerCase().includes('conductor') || key.toLowerCase().includes('wire')) {
          const height = this.extractNumberFromValue(rawData.attributes[key]);
          if (height !== null) {
            wires.push({
              description: key,
              heightFt: height
            });
          }
        }
      });
    }

    return wires;
  }

  /**
   * Extract wire information from SPIDA raw data
   */
  private static extractWiresFromSpida(rawData: any): Array<{description: string, heightFt: number}> {
    const wires: Array<{description: string, heightFt: number}> = [];
    
    if (!rawData) return wires;

    // Look for wire/conductor information in SPIDA data structures
    // Check designs for attachments/wires
    if (rawData.designs) {
      rawData.designs.forEach((design: any) => {
        if (design.structure && design.structure.wires) {
          design.structure.wires.forEach((wire: any) => {
            const height = this.extractHeightFromSpidaObject(wire);
            if (height !== null) {
              wires.push({
                description: wire.description || wire.type || 'Wire',
                heightFt: height * METERS_TO_FEET // SPIDA uses meters
              });
            }
          });
        }
      });
    }

    return wires;
  }

  /**
   * Extract attachment information from Katapult raw data
   */
  private static extractAttachmentsFromKatapult(rawData: any): Array<{description: string, heightFt: number}> {
    const attachments: Array<{description: string, heightFt: number}> = [];
    
    if (!rawData || !rawData.attributes) return attachments;

    // Look for attachment-related attributes
    Object.keys(rawData.attributes).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('anchor') || lowerKey.includes('guy') || 
          lowerKey.includes('equipment') || lowerKey.includes('transformer')) {
        const height = this.extractNumberFromValue(rawData.attributes[key]);
        if (height !== null) {
          attachments.push({
            description: key,
            heightFt: height
          });
        }
      }
    });

    return attachments;
  }

  /**
   * Extract attachment information from SPIDA raw data
   */
  private static extractAttachmentsFromSpida(rawData: any): Array<{description: string, heightFt: number}> {
    const attachments: Array<{description: string, heightFt: number}> = [];
    
    if (!rawData) return attachments;

    // Look for attachments in SPIDA designs
    if (rawData.designs) {
      rawData.designs.forEach((design: any) => {
        if (design.structure && design.structure.attachments) {
          design.structure.attachments.forEach((attachment: any) => {
            const height = this.extractHeightFromSpidaObject(attachment);
            if (height !== null) {
              attachments.push({
                description: attachment.description || attachment.type || 'Attachment',
                heightFt: height * METERS_TO_FEET // SPIDA uses meters
              });
            }
          });
        }
      });
    }

    return attachments;
  }

  /**
   * Extract height from SPIDA object (handles various height field formats)
   */
  private static extractHeightFromSpidaObject(obj: any): number | null {
    if (!obj) return null;

    // Check various height field names
    const heightFields = ['height', 'attachHeight', 'groundHeight', 'elevation'];
    
    for (const field of heightFields) {
      if (obj[field] !== undefined) {
        if (typeof obj[field] === 'number') {
          return obj[field];
        } else if (obj[field] && typeof obj[field] === 'object' && obj[field].value !== undefined) {
          return obj[field].value;
        }
      }
    }

    return null;
  }

  /**
   * Extract numeric value from various Katapult attribute formats
   */
  private static extractNumberFromValue(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    if (value && typeof value === 'object') {
      if (value['-Imported'] !== undefined) {
        const num = parseFloat(value['-Imported']);
        return isNaN(num) ? null : num;
      }
      if (value.value !== undefined) {
        const num = parseFloat(value.value);
        return isNaN(num) ? null : num;
      }
    }
    return null;
  }

  /**
   * Process item to calculate delta and status
   */
  private static processItem(item: HeightComparisonItem, threshold: number): HeightComparisonItem {
    const { katapultHeightFt, spidaHeightFt } = item;
    
    if (katapultHeightFt === null && spidaHeightFt === null) {
      return { ...item, delta: null, status: 'OK' };
    }
    
    if (katapultHeightFt === null) {
      return { ...item, delta: null, status: 'ONLY IN SPIDA' };
    }
    
    if (spidaHeightFt === null) {
      return { ...item, delta: null, status: 'ONLY IN KAT' };
    }
    
    const delta = Math.abs(katapultHeightFt - spidaHeightFt);
    const status = delta <= threshold ? 'OK' : 'HEIGHT DIFF';
    
    return { ...item, delta, status };
  }

  /**
   * Calculate statistics from processed items
   */
  private static calculateStats(items: HeightComparisonItem[]): HeightComparisonStats {
    const stats = {
      total: items.length,
      ok: 0,
      heightDiff: 0,
      onlyInKat: 0,
      onlyInSpida: 0
    };

    items.forEach(item => {
      switch (item.status) {
        case 'OK':
          stats.ok++;
          break;
        case 'HEIGHT DIFF':
          stats.heightDiff++;
          break;
        case 'ONLY IN KAT':
          stats.onlyInKat++;
          break;
        case 'ONLY IN SPIDA':
          stats.onlyInSpida++;
          break;
      }
    });

    return stats;
  }

  /**
   * Get status color for UI display
   */
  static getStatusColor(status: HeightComparisonItem['status']): string {
    switch (status) {
      case 'OK':
        return 'text-green-400 bg-green-900/20 border-green-500';
      case 'HEIGHT DIFF':
        return 'text-red-400 bg-red-900/20 border-red-500';
      case 'ONLY IN KAT':
        return 'text-purple-400 bg-purple-900/20 border-purple-500';
      case 'ONLY IN SPIDA':
        return 'text-blue-400 bg-blue-900/20 border-blue-500';
      default:
        return 'text-slate-400 bg-slate-900/20 border-slate-500';
    }
  }
} 