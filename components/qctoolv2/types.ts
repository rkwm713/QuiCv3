// SPIDAcalc Types
export interface SpidaPole {
  label: string;
  scid?: string;
  designs: SpidaDesign[];
}

export interface SpidaDesign {
  layerType: 'Measured' | 'Recommended' | 'MEASURED' | 'RECOMMENDED';
  structure: {
    pole: {
      agl: { value: number }; // meters
      clientItem: {
        classOfPole: string;
        species: string;
      };
    };
    wires: SpidaWire[];
    insulators: SpidaInsulator[];
    equipments: SpidaEquipment[];
    guys: SpidaGuy[];
    crossArms: SpidaCrossArm[];
  };
}

export interface SpidaWire {
  id: string;
  attachmentHeight: { value: number }; // meters
  usageGroup: string;
  clientItem: {
    size: string;
  };
}

export interface SpidaInsulator {
  id: string;
  attachmentHeight: { value: number }; // meters (offset.value in actual data)
  clientItem: {
    size: string;
  };
  wires: string[]; // wire IDs
}

export interface SpidaEquipment {
  attachmentHeight: { value: number }; // meters
  clientItem: {
    type: string;
  };
}

export interface SpidaGuy {
  attachmentHeight: { value: number }; // meters (attachHeight.value in some data)
}

export interface SpidaCrossArm {
  attachmentHeight: { value: number }; // meters
}

// Katapult Types
export interface KatapultPole {
  nodeId: string;
  poleTag: string;
  scid: string;
  measuredHeight: number; // feet
  poleClass: string;
  poleSpecies: string;
  heights: KatapultAttachment[];
  moveRecommendations: Record<string, number>; // tagId -> mr_move in inches
}

export interface KatapultAttachment {
  heightId: string;
  type: string;
  company?: string;
  height_ft: number;
  height_in: number;
  totalHeightFeet: number; // calculated from ft + in/12
  needsPseudoInsulator?: boolean;
}

// New Four-Layer Bucket Structure
export interface AttachmentRow {
  type: string;
  desc: string;
  height_ft: number;
  synthetic?: boolean;
  ref: string;
  children?: AttachmentRow[];
}

export interface HeightBucket {
  height_ft: number;
  colour: 'green' | 'amber' | 'red' | 'grey';
  KatMeasured: AttachmentRow[];
  SpidaMeasured: AttachmentRow[];
  KatRecommended: AttachmentRow[];
  SpidaRecommended: AttachmentRow[];

  /** @deprecated temporary compatibility */
  Measured?: AttachmentRow[];
  /** @deprecated temporary compatibility */
  Recommended?: AttachmentRow[];
}

export interface PoleComparison {
  poleId: string;
  scid?: string;
  buckets: HeightBucket[];
  notes?: string[];
}

export interface ComparisonResults {
  totalPoles: number;
  matchedPoles: number;
  poleComparisons: PoleComparison[];
  summary: {
    greenBuckets: number;
    amberBuckets: number;
    redBuckets: number;
  };
}

// Legacy types for backward compatibility during transition
export interface Discrepancy {
  type: 'pole-height' | 'pole-class' | 'pole-species' | 'equipment' | 'wire' | 'guy';
  category: string;
  spidaValue: string | number;
  katapultValue: string | number;
  difference?: number; // for height comparisons
  severity: 'high' | 'medium' | 'low';
  designType?: 'Measured' | 'Recommended';
}

// Preprocessing row structure
export interface PreprocessedRow {
  poleId: string;
  scid?: string;
  layer: 'Measured' | 'Recommended' | 'KatMeasured' | 'KatRecommended' | 'SpidaMeasured' | 'SpidaRecommended';
  type: string;
  desc: string;
  height_ft: number;
  ref: string;
  synthetic?: boolean;
  needsPseudoInsulator?: boolean;
  parentIns?: string; // id of parent insulator (for wires)
  subType?: string;   // granular subtype such as usage group or equipment type
}

// RawRow alias – maintained for clarity with latest spec
export type RawRow = PreprocessedRow; // identical structure for now 