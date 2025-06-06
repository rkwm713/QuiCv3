
export interface Coordinate {
  lat: number;
  lon: number;
}

// Represents an item from spidaJson.clientData.poles (a pole type/definition)
export interface SpidaPoleTypeDefinition {
  aliases?: Array<{ id: string }>; // e.g., id: "45-3"
  species?: string;
  classOfPole?: string;
  height?: { unit: string; value: number };
  // Allow other properties that might exist on these definitions
  [key: string]: any; 
}

// Represents a pole instance within a design's structure in SPIDA
// This is typically found within location.designs[x].structure.pole
// OR directly within project.structures[x].recommendedDesign.pole
export interface SpidaDesignPoleStructure {
  clientItemAlias?: string; // e.g. "45-3" - Used if direct spec components aren't in the design's pole object
  clientItem?: { 
    species?: string;
    classOfPole?: string;
    height?: { unit: string; value: number };
    [key: string]: any;
  };
  // Direct spec components as per user's example from project.structures[x].recommendedDesign.pole
  length?: number | { unit: string; value: number }; // Can be number (meters) or object
  class?: string;
  species?: string;
  [key: string]: any;
}

// Represents a SPIDA design object
export interface SpidaDesign {
  layerType: "Measured" | "Recommended";
  structure: { // This usually contains attachments, wires, etc.
      pole: SpidaDesignPoleStructure; // This is where pole spec info might be for designs in leads
      [key: string]: any;
  };
  // The pole spec might also be directly inside the design object itself if not in structure.pole
  pole?: SpidaDesignPoleStructure; 
  analysis?: Array<{ 
      results: Array<{
          component: string; // e.g., "Pole"
          actual: number;    // The percentage value for loading
          [key: string]: any;
      }>;
      [key: string]: any;
  }>;
  [key: string]: any;
}

// Represents a SPIDA structure directly from project.structures or spidadevices.structures
export interface SpidaProjectStructure {
  id: string; // Primary source for Pole Number
  externalId?: string; // Fallback for Pole Number
  label?: string; // Fallback if id and externalId are missing, or for display
  geographicCoordinate?: { type: string; coordinates: [number, number] }; // lon, lat
  mapLocation?: { type: string; coordinates: [number, number] }; // lon, lat
  latitude?: number; 
  longitude?: number;
  designs?: SpidaDesign[]; // Some structures might have designs directly
  recommendedDesign?: { pole: SpidaDesignPoleStructure; attachments?: any[]; items?: any[]; [key:string]:any; }; // As per user's example
  measuredDesign?: { pole: SpidaDesignPoleStructure; attachments?: any[]; items?: any[]; [key:string]:any; }; // Fallback design
  // Other fields from a structure object
  [key: string]: any;
}


// Represents a SPIDA location object from the 'leads'
export interface SpidaLocation extends SpidaProjectStructure { // Locations can also have structure-like fields
  // label: string; // Inherited, e.g., "1-PL28462" or "001"
  designs: SpidaDesign[]; // Locations always have designs array
}


// This is what normalizeSpidaData will operate on. App.tsx must construct these.
export interface IntermediateSpidaPole {
  originalIndexInFeed: number; // Index from the iteration (either project.structures or leads)
  idSpidaDisplay: string; // The sequential, zero-padded ID like "001", "002" generated based on primary structures array if found
  originalStructureId?: string | null; // The 'id' field from SPIDA structure, if available
  poleNumDisplay: string | null; // The extracted pole number (from structure.id or structure.externalId or label)
  coords: Coordinate | null;
  
  // Data for spec calculation: either from project.structure.design.pole or location.design.pole
  poleStructureForSpec: SpidaDesignPoleStructure | null; 
  
  // Extracted percentage strings
  existingPctStr: string | null; 
  finalPctStr: string | null;
  
  // Extracted comm drop flag 
  commDropFlag: boolean | null;
  
  rawSpidaData: SpidaProjectStructure | SpidaLocation; // Store original structure/location data
}


export interface RawKatapultPole {
  StructureRID?: string | number;
  PoleNumber?: string | number; // Fallback Katapult pole number
  geometry?: {
    type?: string;
    coordinates?: [number, number]; // [lon, lat]
  };
  Latitude?: number; 
  Longitude?: number;
  "Pole Specs"?: string;
  "Condition (%)"?: number | string;
  button?: string; 
  node_type?: string; // Direct node_type property
  attributes?: { 
    scid?: { "-Imported"?: string | number, [key:string]:any };
    PL_number?: { "-Imported"?: string | number, [key:string]:any }; // Preferred Katapult pole number
    PoleNumber?: { "-Imported"?: string | number, [key:string]:any }; // Secondary Katapult pole number
    DLOC_number?: string | number; // Fallback
    pole_tag?: { tagtext?: string | number, [key:string]:any }; // Fallback
    electric_pole_tag?: { assessment?: string | number; [key: string]: any; }; // Added for pole number extraction
    pole_spec?: string; // Direct pole spec
    birthmark_reference_id?: string; // To link to birthmark table
    "existing_capacity_%"?: string | number;
    "final_passing_capacity_%"?: string | number;
    node_type?: string | { // node_type can also be nested in attributes
        "-Imported"?: string | number;
        "multi_added"?: string | number; // Common Katapult pattern
        [key: string]: any; 
    };
    [key: string]: any; // Allow other attributes
  };
  [key: string]: any;
}

// Represents the data extracted from a Katapult birthmark for spec building
export interface KatapultBirthmarkData {
  heightFt: number | null;
  poleClass: string | null;
  species: string | null;
  originalDataSource?: any; // keep other birthmark data if needed
}


export interface KatapultJsonNode extends RawKatapultPole {
  _nodeKey?: string; // To store its original key from the JSON map
}

export interface KatapultJsonFormat {
  nodes?: Record<string, KatapultJsonNode>;
  connections?: Record<string, any>;
  [key: string]: any;
}


// Transformed/Normalized types for internal processing
export interface NormalizedPole {
  originalIndex: number; 
  originalDataSource: 'spida' | 'katapult';
  scid: string | null; // This should be the cleaned/normalized SCID
  poleNum: string | null; // This should be the cleaned/normalized Pole Number
  coords: Coordinate | null;
  spec: string | null; 
  existingPct: number | null;
  finalPct: number | null; 
  commDrop: boolean | null; 
  rawData: IntermediateSpidaPole['rawSpidaData'] | KatapultJsonNode; // Adjusted to use KatapultJsonNode
}

export enum MatchTier {
  UNMATCHED_SPIDA = 'Unmatched SPIDA',
  UNMATCHED_KATAPULT = 'Katapult-Only',
  SCID_EXACT_MATCH = 'SCID Exact Match',
  POLE_NUMBER_MATCH = 'Pole Number Match',
  COORDINATE_DIRECT_MATCH = 'Coordinate Direct Match (<1m)', 
  COORDINATE_SPEC_VERIFIED = 'Coordinate + Specification Verified', 
}

export interface ProcessedPole {
  id: string; 
  matchTier: MatchTier;
  
  spida?: NormalizedPole;
  katapult?: NormalizedPole;

  displaySpidaScid: string;
  displayKatapultScid: string;
  displaySpidaPoleNum: string;
  displayKatapultPoleNum: string;
  displaySpidaPoleSpec: string;
  displayKatapultPoleSpec: string;
  displaySpidaExistingPct: string;
  displayKatapultExistingPct: string;
  displaySpidaFinalPct: string;
  displayKatapultFinalPct: string; 
  displaySpidaCommDrop: string;
  displayKatapultCommDrop: string; 

  editableSpidaSpec: string; 
  editableSpidaExistingPct: string; 
  editableSpidaFinalPct: string;
  editableSpidaCommDrop: 'Yes' | 'No' | ''; 

  isScidMismatch: boolean;
  isPoleNumMismatch: boolean;
  isCoordsMismatch: boolean; 
  isSpecMismatch: boolean;
  isExistingPctMismatch: boolean;
  isFinalPctMismatch: boolean; 
  isCommDropMismatch: boolean;

  mapCoords?: Coordinate; 
  spidaMapCoords?: Coordinate; 
  katapultMapCoords?: Coordinate; 
  
  matchDistanceMeters?: number | null; 

  isEdited: boolean;
}

export interface ComparisonStats {
  totalSpidaPoles: number;
  totalKatapultPoles: number;
  matchesByTier: Record<MatchTier, number>;
  totalMatches: number;
  matchSuccessRate: string; 
}

export interface MapPole {
  id: string;
  coords: Coordinate;
  color: string;
  tier: MatchTier;
  label: string;
}

export interface MapLine {
  id: string;
  from: Coordinate;
  to: Coordinate;
  color: string;
}

// For SpidaJson parsing, to represent the overall structure
export interface SpidaJsonFullFormat { 
  project?: {
    structures?: SpidaProjectStructure[];
    [key: string]: any;
  };
  spidadevices?: { // Alternative path for structures
    structures?: SpidaProjectStructure[];
    [key: string]: any;
  };
  clientData?: {
    poles?: SpidaPoleTypeDefinition[]; 
    owners?: Array<{ id: string, name: string, [key: string]: any }>; 
    [key: string]: any;
  };
  leads?: Array<{ // Fallback path if project.structures is not found
    locations: SpidaLocation[];
    [key: string]: any;
  }>;
  [key: string]: any;
}
