// ICEGATE CTX (commercial tax) type codes; older jobs and the Party master saved the label instead of the code
export const CTX_CODES = { GSTIN: 'G', GSTN: 'G', 'INCOME TAX PAN': 'P', PAN: 'P', AADHAR: 'A', AADHAAR: 'A', PASSPORT: 'I', 'TIN NO': 'T', TIN: 'T', VAT: 'V', CST: 'C', 'SALES TAX REGISTRATION NO': 'S', 'SALES TAX': 'S', 'GST GOVERNMENT': 'O', 'GST GOVERNMENT (UIN)': 'O', 'GST DIPLOMAT': 'D', 'GST DIPLOMAT (UIN)': 'D', 'NOT REGISTERED': 'N', NONE: 'N' };

export const CTX_OPTIONS = [
  ['G', 'GSTIN'], ['P', 'Income Tax PAN'], ['A', 'Aadhar'], ['I', 'Passport'], ['T', 'TIN No'], ['V', 'VAT'], ['C', 'CST'],
  ['S', 'Sales Tax Registration No'], ['O', 'GST Government (UIN)'], ['D', 'GST Diplomat (UIN)'], ['N', 'Not registered'],
].map(([value, name]) => ({ value, label: `${value} - ${name}` }));

export const ctxCode = (value) => {
  const text = String(value || '').trim().toUpperCase();
  if (!text || text === 'SELECT') return '';
  if (/^[VCSGPAITDON]$/.test(text)) return text;
  return CTX_CODES[text] || CTX_CODES[text.replace(/^[A-Z] - /, '')] || '';
};

// a CTX state typed by name or code -> the master state name and its GST state code (the typed text when unknown)
export const stateInfoFor = (states, value) => {
  if (!value || !states) return { name: value, taxCode: value };
  const term = value.toUpperCase().trim();
  const found = states.find((state) => (state.stateName || '').toUpperCase().trim() === term || (state.stateCode || '').toUpperCase().trim() === term);
  return { name: found ? found.stateName : value, taxCode: found?.taxCode || value };
};
