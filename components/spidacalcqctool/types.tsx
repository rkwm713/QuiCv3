// /components/SpidaQcTool/types.ts

// A simplified interface for a generic attachment to standardize the data
export interface Attachment {
    id?: string;                     // NEW: unique identifier (optional for now)
    type: string;
    owner: string;
    description: string;
    height: number;
    synthetic?: boolean; // Flag for synthetic attachments (e.g., insulators derived from wire heights)
    parentInsulatorId?: string;      // NEW: links wires to their parent insulator
    parentCrossArmId?: string;       // NEW: links insulators to their parent cross-arm
    poleScid?: string;               // NEW: pole identifier for grouping
  }
  
  // NEW: Normalized attachment point that both SPIDA and Katapult converge to
  export interface AttachmentPoint {
    id: string;                      // Unique identifier
    source: 'spida' | 'katapult';    // Which system this came from
    owner: string;                   // Normalized owner
    description: string;             // Description of the attachment point
    height: number;                  // Height in meters
    wires: string[];                 // Array of wire IDs attached at this point
    synthetic: boolean;              // True if this was inferred from wire grouping
    poleScid: string;               // Pole identifier
    originalData?: any;             // Reference to original data for debugging
  }
  
  // Helper interface for wire grouping logic
  export interface WireGroup {
    key: string;                    // Composite key for grouping
    owner: string;
    height: number;
    wires: Attachment[];
    hasInsulator: boolean;          // Whether this group already has an explicit insulator
  }
  
  // Interface for a single design layer (Measured or Recommended)
  export interface Design {
    label: string;
    pole: {
      species: string;
      classOfPole: string;
      height: {
        value: number;
      };
    };
    attachments: Attachment[];
    originalStructure?: any; // NEW: Preserve original SPIDA structure for cross-arm processing
  }
  
  // Interface for a single pole location, containing its designs
  export interface PoleLocationData {
    label: string;
    designs: Design[];
  }
  
  // Interface for the root of the SPIDAcalc JSON structure
  export interface SpidaCalcData {
    label: string;
    clientFile: string;
    engineer: string;
    date: string;
    leads: {
      label: string;
      locations: any[]; // We'll parse this dynamically
    }[];
    clientData?: {
      insulators?: {
        size: string;
        [key: string]: any;
      }[];
      [key: string]: any;
    };
  }

  // --- CORRECTED Katapult Types ---
  export interface KatapultNode {
    attributes: {
      electric_pole_tag?: { assessment: string };
      pole_tag?: { [id: string]: { tagtext: string } };
      scid?: { auto_button?: string };
    };
    photos?: { [id: string]: { association: string } };
    equipment?: { 
      [tagId: string]: {
        _measured_height: number;
        equipment_type?: string;
        measurement_of?: string;
        pixel_selection?: Array<{ percentX: number; percentY: number }>;
        [key: string]: any;
      }
    };
  }

  export interface KatapultPhotoData {
    wire?: { [id: string]: { _measured_height: number; _trace: string; wire_type?: string } };
    pole_top?: { [id: string]: { _measured_height: number } };
    equipment?: { [id: string]: { _measured_height: number; _trace: string; equipment_type?: string; measurement_of?: string } };
    guying?: { [id: string]: { _measured_height: number; _trace: string; guy_type?: string; guying_type?: string } };
  }

  export interface KatapultTrace {
    company: string;
    cable_type?: string;
    label: string;
    proposed?: boolean;
    _trace_type?: string; // e.g., "down_guy", "equipment", etc.
  }

  export interface KatapultData {
    name: string;
    nodes: { [id: string]: KatapultNode };
    photos: { [id: string]: { 
      photofirst_data?: KatapultPhotoData;
      active_design?: string;
      alternate_designs?: {
        designs?: {
          [designId: string]: {
            data?: {
              photo?: {
                photofirst_data?: {
                  equipment?: { [id: string]: { 
                    _measured_height: number; 
                    _trace: string; 
                    equipment_type?: string;
                    measurement_of?: string;
                    [key: string]: any; 
                  }};
                  wire?: { [id: string]: { 
                    _measured_height: number; 
                    _trace: string;
                    wire_type?: string;
                    [key: string]: any; 
                  }};
                  guying?: { [id: string]: { 
                    _measured_height: number; 
                    _trace: string;
                    guy_type?: string;
                    guying_type?: string;
                    [key: string]: any; 
                  }};
                  [key: string]: any;
                }
              }
            }
          }
        }
      };
    }};
    traces: { trace_data: { [id: string]: KatapultTrace } };
  }

  // Interface for enhanced comparison with fallback logic
  export interface EnhancedComparison {
    katapult: Attachment | null;
    spida: Attachment | null;
    sourceLabel: string | null;
    changeType?: 'brand-new' | 'height-change';
    measuredHeight?: number;
  }

  // NEW: Enhanced comparison using attachment points
  export interface AttachmentPointComparison {
    spidaPoint: AttachmentPoint | null;
    katapultPoint: AttachmentPoint | null;
    matchType: 'exact' | 'height-only' | 'spida-only' | 'katapult-only';
    heightDifference?: number;
  }

  // Guy matching types for production spec
  export type MatchResult =
    | { status: "matched", height_in: number, owner: string, katapult_id: string, spida_id: string }
    | { status: "unmatched_katapult", height_in: number, owner: string, katapult_id: string }
    | { status: "unmatched_spida", height_in: number, owner: string, spida_id: string };

  // Interface for comparison results
  export interface ComparisonResult {
    poleLabel: string;
    poleInfo: {
      species?: string;
      classOfPole?: string;
      height?: number;
    };
    spidaMeasured: Attachment[];
    katapultExisting: Attachment[];
    spidaRecommended: Attachment[];
    katapultProposed: Attachment[];
    enhancedProposedComparison?: EnhancedComparison[];
    guyMatchResults?: MatchResult[]; // Production guy matching results
    
    // NEW: Attachment point comparisons
    attachmentPointComparisons?: AttachmentPointComparison[];
    
    // NEW: Cross-arm mapping results
    crossArmMatches?: Array<{
      spidaGroup: import('./crossArmMapper').CrossArmGroup | null;
      katapultGroup: import('./crossArmMapper').CrossArmGroup | null;
      heightDifferenceFt?: number;
      matchType: 'exact' | 'close' | 'spida-only' | 'katapult-only';
    }>;
  }