// Party master values -> SB codes. Merchant / Manufacturer: Manufacturer [F], Merchant [M], Merchant Exporter Courier [C],
// Manufacturer Exporter Courier [D]. Class: Private [P], Government [G], Warehouse Shipping Bill [W].
export function partyMerc(value) {
  const text = String(value || '').toUpperCase();
  if (!text) return '';
  if (/COURIER/.test(text)) return /MANUF/.test(text) ? 'D' : 'C';
  if (/\[D\]$/.test(text) || text === 'D') return 'D';
  if (/\[C\]$/.test(text) || text === 'C') return 'C';
  if (/MANUF/.test(text) || text === 'F') return 'F';
  if (/MERCH/.test(text) || text === 'M' || text === 'R') return 'M';
  return '';
}

export function partyClass(value) {
  const text = String(value || '').toUpperCase();
  if (!text) return '';
  if (/WAREHOUSE|\[W\]/.test(text) || text === 'W') return 'W';
  if (/^GOV/.test(text) || text === 'G') return 'G';
  if (/^PRIV/.test(text) || text === 'P') return 'P';
  return '';
}

export const normalized = (value) => String(value || '').trim().toUpperCase();

// a branch without GSTIN falls back to the PAN: the GSTN type then is PAN (ICEGATE rejects a PAN sent as GSTIN)
export function registrationTypeOf(registrationNo, currentType) {
  if (/^[0-9]{2}[A-Z0-9]{13}$/.test(registrationNo)) return 'GSTIN';
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(registrationNo)) return 'PAN';
  return currentType || 'GSTIN';
}
