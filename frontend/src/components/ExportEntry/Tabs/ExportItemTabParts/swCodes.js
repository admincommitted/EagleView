// Code suggestions for the Shipping Bill SW Info and SW Statement windows (19-Nov-2026), from the ICES 1.5 CHA-Customs
// Exports message format 3.7 (06-Nov-2026) and the ICEGATE advisories of 2026. Only suggestions: any other code can still
// be typed (the directories of ICEGATE are longer).

export const SB_INFO_TYPES = [
  ['ORC', 'Origin criteria'], ['CHR', 'Item characteristics'], ['DTY', 'Duty / cess'], ['DIR', 'Directory'], ['OTH', 'Other'],
  ['IDT', 'Item id type'], ['CTG', 'Item category'], ['PNM', 'Product name'], ['PEC', 'PGA exception category'],
];

export const SB_INFO_QUALIFIERS = {
  ORC: [['STO', 'State of origin'], ['DOO', 'District of origin'], ['EPT', 'Export preference (trade agreement) - every item']],
  CHR: [['SQC', 'Statistical quantity'], ['TEX', 'Textile tariff: flame retardant fabric or not']],
  DTY: [['GCESS', 'Cess'], ['RDT', 'RoDTEP claimed']],
  DIR: [['MOOWR', 'MOOWR (warehouse manufacture)'], ['SUC', 'SEZ unit code - SB level, invoice 1 / item 1'], ['XSB', 'X-bond - SB level, invoice 1 / item 1'],
    ['PNR', 'Hand carry: PNR'], ['ETICKET', 'Hand carry: e-ticket'], ['PASSPORT', 'Hand carry: passport']],
  OTH: [['DTA', 'DTA shipping bill - SB level, invoice 1 / item 1'], ['DTAG', 'GSTIN of the DTA unit (supplier)'], ['SEZG', 'GSTIN of the SEZ unit (recipient)']],
};

// NCPTI: the code of every SB accepted so far (iCAFFE files of Jun-Oct 2026). The NZ FTA advisory and format 3.7 print it
// as "NCTPI" - see claude/check-2026-11-19-icegate-formats-vs-eagleview.md.
export const SB_INFO_CODES = {
  'ORC/EPT': [['NCPTI', 'Not under any trade agreement'], ['FTANZD', 'India-New Zealand FTA (from 20-Oct-2026)']],
  'CHR/TEX': [['FR001', 'Flame retardant fabric'], ['FR009', 'Other than flame retardant fabric']],
  'DTY/RDT': [['RODTEPY', 'RoDTEP claimed'], ['RODTEPN', 'RoDTEP not claimed']],
  'DIR/MOOWR': [['MOOWRY', 'MOOWR - yes'], ['MOOWRN', 'MOOWR - no']],
  'OTH/DTA': [['DTASBY', 'DTA shipping bill']],
};

export const SB_STATEMENT_TYPES = ['DEC', 'REM'];
export const SB_STATEMENT_CODES = [
  ['RD001', 'RoDTEP declaration'], ['RS001', 'RoSCTL declaration'],
  ['DB001', 'Drawback A / C: no ITC of CGST / IGST on inputs'], ['DB002', 'Drawback A / C: no refund of IGST paid on export'],
  ['DB003', 'Drawback A / C: CENVAT credit not carried forward'], ['AUTPT', 'DTA to SEZ: goods for authorised operations only'],
];

export const infoCodesOf = (type, qual) => SB_INFO_CODES[`${String(type || '').trim().toUpperCase()}/${String(qual || '').trim().toUpperCase()}`] || [];
export const infoQualsOf = (type) => SB_INFO_QUALIFIERS[String(type || '').trim().toUpperCase()] || [];
