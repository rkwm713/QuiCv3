export const HEIGHT_COMPARISON_CONSTANTS = {
  METERS_TO_FEET: 3.28084,
  DEFAULT_THRESHOLD: 0.5, // feet
  HEIGHT_TOLERANCE_FT: 0.5,
  
  // Credible height range for utility poles
  MIN_CREDIBLE_HEIGHT_FT: 15,
  MAX_CREDIBLE_HEIGHT_FT: 150,
  
  // Default height to add above highest attachment when deriving pole height
  ATTACHMENT_TO_POLE_HEIGHT_BUFFER_FT: 2,
} as const;

export const HEIGHT_COMPARISON_STATUS_COLORS = {
  'OK': 'bg-green-900/20 text-green-400 border-green-500',
  'HEIGHT DIFF': 'bg-red-900/20 text-red-400 border-red-500',
  'ONLY IN KAT': 'bg-purple-900/20 text-purple-400 border-purple-500',
  'ONLY IN SPIDA': 'bg-blue-900/20 text-blue-400 border-blue-500',
} as const;

export const HEIGHT_COMPARISON_ITEM_TYPE_COLORS = {
  'Pole': 'bg-blue-900/20 text-blue-400 border-blue-500',
  'Wire': 'bg-orange-900/20 text-orange-400 border-orange-500',
  'Other Attachment': 'bg-purple-900/20 text-purple-400 border-purple-500',
} as const;

export const HEIGHT_COMPARISON_FILTERS = {
  STATUS_OPTIONS: ['OK', 'HEIGHT DIFF', 'ONLY IN KAT', 'ONLY IN SPIDA'] as const,
  ITEM_TYPE_OPTIONS: ['Pole', 'Wire', 'Other Attachment'] as const,
} as const; 