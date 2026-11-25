export const EMPTY_STATUS = {
  code: '',
  description: '',
  macroBucket: 'DRAFT',
  colorCode: '#e2e8f0',
  textColor: '#1e293b',
  module: 'IMPORT',
  sequence: 0,
  disables: '',
  enables: '',
  bubbleStyle: 'LEFT_BORDER',
};

export const MODULES = ['IMPORT', 'EXPORT'];

export const MACRO_BUCKETS = {
  IMPORT: ['DRAFT', 'SUBMITTED', 'QUERY_RAISED', 'OOC'],
  EXPORT: ['DRAFT', 'TD_DONE', 'XRAY_DONE', 'LEO'],
};

export const BUBBLE_STYLES = [
  { value: 'LEFT_BORDER', label: 'Classic (Left Border)' },
  { value: 'SOLID', label: 'Solid Background' },
  { value: 'OUTLINE', label: 'Minimal Outline' },
  { value: 'GLOW', label: 'Neon Glow' },
  { value: 'DASHED', label: 'Dashed Outline' },
  { value: 'GRADIENT', label: 'Gradient Fill' },
  { value: 'BOTTOM_BORDER', label: 'Bottom Border' },
  { value: 'SOFT_SHADOW', label: 'Soft Shadow Card' },
  { value: 'PILL', label: 'Pill Shape' },
  { value: 'GLASSMORPHISM', label: 'Frosted Glass' },
  { value: 'MATERIAL_ACCENT', label: 'Material Accent' },
  { value: 'NEUMORPHISM', label: '3D Raised' },
  { value: 'FOLDED_RIBBON', label: 'Folded Ribbon' },
  { value: 'HOLLOW_NEON', label: 'Dark Hollow Neon' },
];

// disables / enables are stored as "CODE_A, CODE_B"
export const codesOf = (list) => String(list || '').split(',').map((code) => code.trim()).filter(Boolean);
