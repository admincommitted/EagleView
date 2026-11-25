const SHIPMENT_MODE_BY_CODE = { A: 'AIR', S: 'SEA', L: 'LAND' };
const BOE_TYPE_BY_CODE = { H: 'HOME_CONSUMPTION', W: 'WAREHOUSE', X: 'EX_BOND' };
const BE_TYPE_LABELS = { W: 'WAREHOUSE (W)', X: 'EX-BOND (X)' };
const MODE_LABELS = { A: 'AIR', L: 'LAND' };

export const shipmentModeOf = (transportMode) => SHIPMENT_MODE_BY_CODE[transportMode] || 'SEA';
export const boeTypeOf = (beType) => BOE_TYPE_BY_CODE[beType] || 'HOME_CONSUMPTION';

export const transportModeOf = (shipmentMode) => (shipmentMode === 'AIR' ? 'A' : shipmentMode === 'LAND' ? 'L' : 'S');
export const beTypeOf = (boeType) => (boeType === 'WAREHOUSE' ? 'W' : boeType === 'EX_BOND' ? 'X' : 'H');

export const beTypeLabel = (beType) => BE_TYPE_LABELS[beType?.toUpperCase()] || 'HOME CONSUMPTION (H)';
export const transportModeLabel = (transportMode) => MODE_LABELS[transportMode] || 'SEA';

// the Mode / BE Type boxes of an imported file hold free text (AIR, SEA, W, X, ...)
export function transportModeFromFile(text) {
  const mode = text.toUpperCase();
  if (mode.includes('A')) return 'A';
  return mode.includes('S') ? 'S' : 'L';
}

export function beTypeFromFile(text) {
  const type = text.toUpperCase();
  if (type.includes('W')) return 'W';
  return type.includes('X') ? 'X' : 'H';
}
