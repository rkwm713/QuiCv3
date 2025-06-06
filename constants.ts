import { MatchTier, ComparisonStats } from './types';

export const APP_TITLE = "QuiC";

export const COORDINATE_MATCH_THRESHOLD_METERS = {
  DIRECT: 1, // For direct coordinate match without spec verification if needed
  VERIFIED_SPEC: 5, // For coordinate match + spec verification (Python used 5m)
};

// Height tolerance for spec matching, e.g., 1 foot
export const POLE_SPEC_HEIGHT_TOLERANCE_FEET = 1;


export const MATCH_TIER_COLORS: Record<MatchTier, string> = {
  [MatchTier.SCID_EXACT_MATCH]: 'text-green-400 border-green-500', // For text/borders
  [MatchTier.POLE_NUMBER_MATCH]: 'text-blue-400 border-blue-500',
  [MatchTier.COORDINATE_DIRECT_MATCH]: 'text-yellow-400 border-yellow-500',
  [MatchTier.COORDINATE_SPEC_VERIFIED]: 'text-orange-400 border-orange-500',
  [MatchTier.UNMATCHED_SPIDA]: 'text-red-400 border-red-500',
  [MatchTier.UNMATCHED_KATAPULT]: 'text-purple-400 border-purple-500',
};

export const MAP_MARKER_COLORS: Record<MatchTier, string> = {
  [MatchTier.SCID_EXACT_MATCH]: '#34D399', // green-400
  [MatchTier.POLE_NUMBER_MATCH]: '#60A5FA', // blue-400
  [MatchTier.COORDINATE_DIRECT_MATCH]: '#FBBF24', // yellow-400
  [MatchTier.COORDINATE_SPEC_VERIFIED]: '#F97316', // orange-500 (more distinct than orange-400)
  [MatchTier.UNMATCHED_SPIDA]: '#F87171', // red-400
  [MatchTier.UNMATCHED_KATAPULT]: '#A78BFA', // purple-400
};

export const TABLE_COLUMNS = [
  { key: 'matchTier', label: 'Match Tier', spidaField: null, katapultField: null, className: 'min-w-[180px]' },
  { key: 'displaySpidaScid', label: 'SPIDA SCID #', spidaField: 'scid', katapultField: null, className: 'min-w-[130px]' },
  { key: 'displayKatapultScid', label: 'Katapult SCID #', spidaField: null, katapultField: 'scid', className: 'min-w-[130px]' },
  { key: 'displaySpidaPoleNum', label: 'SPIDA Pole #', spidaField: 'poleNum', katapultField: null, className: 'min-w-[130px]' },
  { key: 'displayKatapultPoleNum', label: 'Katapult Pole #', spidaField: null, katapultField: 'poleNum', className: 'min-w-[130px]' },
  { key: 'editableSpidaSpec', label: 'SPIDA Pole Spec', spidaField: 'spec', katapultField: null, editable: true, type: 'text', className: 'min-w-[220px]' },
  { key: 'displayKatapultPoleSpec', label: 'Katapult Pole Spec', spidaField: null, katapultField: 'spec', className: 'min-w-[220px]' },
  { key: 'editableSpidaExistingPct', label: 'SPIDA Existing %', spidaField: 'existingPct', katapultField: null, editable: true, type: 'number', className: 'min-w-[160px]' },
  { key: 'displayKatapultExistingPct', label: 'Katapult Existing %', spidaField: null, katapultField: 'existingPct', className: 'min-w-[160px]' },
  { key: 'editableSpidaFinalPct', label: 'SPIDA Final %', spidaField: 'finalPct', katapultField: null, editable: true, type: 'number', className: 'min-w-[160px]' },
  { key: 'displayKatapultFinalPct', label: 'Katapult Final %', spidaField: null, katapultField: 'finalPct', className: 'min-w-[160px]' },
  { 
    key: 'displayKatapultCommDrop', 
    label: 'COM DROP NEEDED?', 
    spidaField: null, 
    katapultField: 'commDrop', 
    className: 'min-w-[180px]' 
  },
  { key: 'editableSpidaCommDrop', label: 'Com Drop? (SPIDA)', spidaField: 'commDrop', katapultField: null, editable: true, type: 'select', options: ['Yes', 'No', ''], className: 'min-w-[140px]' },
  { key: 'displayKatapultCommDrop', label: 'Com Drop? (Kat)', spidaField: null, katapultField: 'commDrop', className: 'min-w-[140px]' },
];

export const MISMATCH_HIGHLIGHT_CLASS = 'bg-red-500 bg-opacity-30';
export const EDIT_HIGHLIGHT_CLASS = 'bg-yellow-500 bg-opacity-20';
export const REVIEW_FLAG_CLASS = 'bg-yellow-400 bg-opacity-40';

export const SVG_MAP_SETTINGS = {
  POLE_RADIUS: 5,
  VIEWBOX_PADDING: 50, // pixels
  LINE_OPACITY: 0.5,
};

export const INITIAL_STATS: ComparisonStats = {
  totalSpidaPoles: 0,
  totalKatapultPoles: 0,
  matchesByTier: {
    [MatchTier.SCID_EXACT_MATCH]: 0,
    [MatchTier.POLE_NUMBER_MATCH]: 0,
    [MatchTier.COORDINATE_DIRECT_MATCH]: 0,
    [MatchTier.COORDINATE_SPEC_VERIFIED]: 0,
    [MatchTier.UNMATCHED_SPIDA]: 0,
    [MatchTier.UNMATCHED_KATAPULT]: 0,
  },
  totalMatches: 0,
  matchSuccessRate: "0.00%",
};

export const ALLOWED_KATAPULT_NODE_TYPES = new Set([
  "pole", 
  "power", // Assuming "Power" from prompt means "power" in lowercase
  "power transformer", 
  "joint", 
  "joint transformer"
]);