// Code lists for the Job Header search popups, taken from the ICEGATE / CBIC material collected for this project
// (project notes "icegate-site-study.md" 8A + 6, "icegate-json-filing-notes.md").
// - BE BOND table, bond code column: e-Bond purpose code (CBIC Circular 04/2025-Customs, Annexure F). "EB" is invalid
//   (ICEGATE error 553); an e-Bond not tagged to a purpose code gives error 539. IGCR keeps its separate EI bond.
// - BE CERT table: for IGCR the IIN goes in with certificate type EI. No other certificate type code is listed in the
//   documents we have, so the box also takes any code typed by hand.
// Bond codes added in Masters > Bond are shown first in the search.

const ebond = (code, scenario, text) => ({ code, name: `${scenario}: ${text}`, src: 'e-Bond purpose code' });

export const BOND_CODES = [
  { code: 'EI', name: 'IGCR bond (Import of Goods at Concessional Rate)', src: 'IGCR' },
  ebond('P1', 'Provisional assessment', 'CAROTAR, PSU / Govt (0%)'),
  ebond('P2', 'Provisional assessment', 'CAROTAR, others (100%)'),
  ebond('P3', 'Provisional assessment', 'SVB, others (5%)'),
  ebond('P4', 'Provisional assessment', 'SVB, AEO T1 (2.5%)'),
  ebond('P5', 'Provisional assessment', 'SVB, AEO T2 (1.25%)'),
  ebond('P6', 'Provisional assessment', 'SVB, AEO T3 / PSU / Govt (0%)'),
  ebond('P7', 'Provisional assessment', 'Chemical test, AEO T3 / PSU / Govt (0%)'),
  ebond('P8', 'Provisional assessment', 'Chemical test, AEO T2 (25%)'),
  ebond('P9', 'Provisional assessment', 'Chemical test, AEO T1 (50%)'),
  ebond('PA', 'Provisional assessment', 'Chemical test, others (100%)'),
  ebond('PB', 'Provisional assessment', 'CAROTAR random verification (0%)'),
  ebond('PZ', 'Provisional assessment', 'officer determined'),
  ebond('E1', 'Export promotion (EPCG / AA / DFIA)', 'turnover > 5 cr, PSU, status holder, GST >= 1 cr (0%)'),
  ebond('E2', 'Export promotion (EPCG / AA / DFIA)', '15%'),
  ebond('E3', 'Export promotion (EPCG / AA / DFIA)', 'custodian service providers (25%)'),
  ebond('E4', 'Export promotion (EPCG / AA / DFIA)', 'others (100%)'),
  ebond('EZ', 'Export promotion (EPCG / AA / DFIA)', 'officer determined'),
  ebond('R1', 'Concessional rate other than IGCR', 'container (0%)'),
  ebond('R2', 'Concessional rate other than IGCR', 'jobbing (0%)'),
  ebond('RZ', 'Concessional rate other than IGCR', 'officer determined'),
  ebond('D1', 'Section 143', '0%'),
  ebond('DZ', 'Section 143', 'officer determined'),
  ebond('W1', 'Warehouse Sec 59(2)', '100%'),
  ebond('W2', 'Warehouse Sec 59(2)', 'by AEO tier / goods / storage period'),
  ebond('W3', 'Warehouse Sec 59(2)', 'by AEO tier / goods / storage period'),
  ebond('W4', 'Warehouse Sec 59(2)', 'by AEO tier / goods / storage period'),
  ebond('W5', 'Warehouse Sec 59(2)', 'by AEO tier / goods / storage period'),
  ebond('W6', 'Warehouse Sec 59(2)', '0%'),
  ebond('W7', 'Warehouse Sec 59(2)', '100%'),
  ebond('W8', 'Warehouse Sec 59(2)', '100%'),
  ebond('W9', 'Warehouse Sec 59(2)', '50%'),
  ebond('WA', 'Warehouse Sec 59(2)', '25%'),
  ebond('WZ', 'Warehouse Sec 59(2)', 'officer determined'),
  ebond('M1', 'MOOWR private', '0%'),
  ebond('MZ', 'MOOWR private', 'officer determined'),
  ebond('S1', 'MOOWR special warehouse', '0%'),
  ebond('SZ', 'MOOWR special warehouse', 'officer determined'),
];

export const CERT_TYPES = [
  { code: 'EI', name: 'IGCR: Import Intimation Number (IIN)', src: 'IGCR' },
];

// master rows first (Masters > Bond), then the ICEGATE list; one row per code
export function mergeCodes(masterRows, builtIn) {
  const out = []; const seen = new Set();
  for (const r of [...(masterRows || []), ...builtIn]) {
    const code = String(r.code || '').trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code); out.push({ ...r, code });
  }
  return out;
}

export const filterCodes = (rows, q) => { const t = String(q || '').trim().toLowerCase(); return t ? rows.filter(r => String(r.code).toLowerCase().includes(t) || String(r.name || '').toLowerCase().includes(t)) : rows; };
