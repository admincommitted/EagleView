// Shared helpers of the Scheme tab (Dbk / License / RoDTEP / AR4). 29-Oct-2026
export const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(x) ? x : 0; };
export const r2 = (v) => (Math.round(num(v) * 100) / 100).toFixed(2);

// "19 - DRAWBACK" / "19" / "19-DBK" -> "19"
// 18-Nov-2026: the Scheme box of the Items tab first; schemeCode is the copy a file leaves on the item (it won, so a scheme
// changed on the screen did not change the Scheme tab, the checklist or the SB)
export const schemeCodeOf = (item) => String((item && (item.scheme || item.schemeCode)) || '').trim().split(/[\s-]/)[0].trim();

// 12-Nov-2026: scheme 60 is "Drawback + RoSCTL" - its items claim drawback too. Only 19 was read as drawback, so a
// scheme 60 job had no Dbk sub-tab, no drawback rates or amount (DBK Rs 0.00) and its items were listed as RoDTEP.
export const isDbkItem = (item) => ['19', '60'].includes(schemeCodeOf(item));
export const isRosctlItem = (item) => schemeCodeOf(item) === '60';
export const isLicenceItem = (item) => { const c = schemeCodeOf(item); return c === '03' || (c !== '' && c !== '00' && c !== '19' && c !== '60' && c !== '99'); };
const swList = (item) => { let v = item && item.swInfos; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
const rdtRowOf = (item) => swList(item).find((r) => String(r.swInfoField1 || r.type || '').toUpperCase() === 'DTY' && String(r.swInfoField2 || r.qual || '').toUpperCase() === 'RDT');
export const hasRdtInfo = (item) => !!rdtRowOf(item);
// the reward flag of a scheme 60 item is its RoSCTL claim (statement RS001) - RoDTEP is not given on RoSCTL goods
export const isRodtepItem = (item) => !isRosctlItem(item) && (String((item && item.rodtep) || '').toUpperCase() === 'Y' || hasRdtInfo(item));
export const claimsRodtep = (item) => {
  if (!item || isRosctlItem(item)) return false;
  const r = rdtRowOf(item);
  return r ? String(r.swInfoField3 || r.code || '').toUpperCase() === 'RODTEPY' : String(item.rodtep || '').toUpperCase() === 'Y';
};

export const invOf = (item, i) => String((item && (item.invSr || item.invNo)) || 1);
export const itemNoOf = (item, i) => String((item && (item.itemSr || item.itemNo)) || (i + 1));

// item FOB in INR (Items tab keeps itemFob in INR; files read may only have fobValueInr / fobRs)
export const itemFobInr = (item) => num(item && (item.itemFob || item.fobValueInr || item.fobInr || item.fobRs));

// RoSCTL schedule row of an item. The RoSCTL schedule uses the drawback schedule numbers without the suffix
// (DBK No 62030307B -> RoSCTL 62030307; the Special Advance Authorisation table D -> 62030307-AA); else the RITC.
export const findRosctl = (master, dbkNo, ritc) => {
  const list = master || [];
  const key = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, '');
  const by = (k) => (k ? list.find((m) => key(m.tariffItem) === k) : null);
  const d = key(dbkNo);
  if (d) {
    const base = d.replace(/[A-Z]$/, '');
    const row = (/D$/.test(d) ? by(base + '-AA') : null) || by(base) || by(d);
    if (row) return row;
  }
  return by(String(ritc || '').replace(/\D/g, ''));
};
// "[State 3.6%/Rs 37.4 + Central 2.45%/Rs 25.5]" in the schedule description -> the two levies
export const rosctlSplit = (desc) => {
  const m = /State\s*([\d.]+)\s*%(?:\s*\/\s*Rs\.?\s*([\d.]+))?\s*\+\s*Central\s*([\d.]+)\s*%(?:\s*\/\s*Rs\.?\s*([\d.]+))?/i.exec(String(desc || ''));
  return m ? { stateRate: num(m[1]), stateCap: num(m[2]), centralRate: num(m[3]), centralCap: num(m[4]) } : null;
};

// drawback schedule row of a DBK No (schedule code, else tariff item)
export const findDbk = (master, no) => {
  const k = String(no || '').trim().toUpperCase();
  if (!k) return null;
  const by = (code) => (master || []).find((d) => String(d.schemeCode || '').trim().toUpperCase() === code);
  // 04-Nov-2026: schedule numbers carry the ICEGATE suffix (610901B; D = Special Advance Authorisation table) -
  // a bare 610901 finds the B row
  return by(k) || (/\d$/.test(k) ? by(k + 'B') : null) || (master || []).find((d) => String(d.tariffItem || '').trim().toUpperCase() === k) || null;
};

// 30-Oct-2026: the cap used to be applied only "if (cap > 0 && qty > 0)", so a row whose quantity was not keyed
// yet had its cap quietly dropped and the full percentage of FOB was claimed. On a 2% row with a Rs 5 per MTR cap
// that is Rs 11,100 claimed where the schedule allows Rs 5,000 - an over-claim of drawback, and exactly what
// Customs queries. These two now return null when the amount cannot be worked out, and the screens show why
// instead of a figure. A claim is never guessed.
export const CAP_NEEDS_QTY = 'The schedule caps this claim per unit - key the quantity before the amount can be worked out';
export const SPEC_NEEDS_QTY = 'This is a rate per unit - key the quantity before the amount can be worked out';
const r2n = (v) => Math.round(num(v) * 100) / 100;
// a claim that could not be worked out shows as blank, never as 0 (0 reads as "nothing due")
export const claimText = (v) => (v === null || v === undefined ? '' : r2(v));
export const claimSum = (list) => (list || []).reduce((a, v) => a + (v === null || v === undefined ? 0 : num(v)), 0);
export const claimPending = (list) => (list || []).filter((v) => v === null || v === undefined).length;

// All-industry rate: % of FOB, limited by the cap (Rs per unit x qty); entries with only a specific rate: Rs per unit x qty
export const dbkAmount = ({ fob, qty, rateAdv, rateSpe, cap }) => {
  const f = num(fob), q = num(qty), a = num(rateAdv), sp = num(rateSpe), c = num(cap);
  if (a > 0) {
    if (c > 0 && !(q > 0)) return null;      // cap is per unit: no quantity, no claim
    const v = f * a / 100;
    return r2n(c > 0 ? Math.min(v, c * q) : v);
  }
  if (sp > 0) return q > 0 ? r2n(sp * q) : null;
  return 0;
};

// RoDTEP: % of FOB, limited by the cap per unit; entries notified as Rs per UQC (rsPerUqc): Rs x qty
export const rodtepAmount = ({ fob, qty, rate, cap, rsPerUqc }) => {
  const f = num(fob), q = num(qty), r = num(rate), c = num(cap), rs = num(rsPerUqc);
  if (!(r > 0)) return rs > 0 ? (q > 0 ? r2n(rs * q) : null) : 0;
  if (c > 0 && !(q > 0)) return null;        // cap is per unit: no quantity, no claim
  const v = f * r / 100;
  return r2n(c > 0 ? Math.min(v, c * q) : v);
};

// why an amount came back blank ('' when it did not)
export const claimWhy = ({ qty, rateAdv, rateSpe, cap }) => {
  const q = num(qty), a = num(rateAdv), sp = num(rateSpe), c = num(cap);
  if (a > 0 && c > 0 && !(q > 0)) return CAP_NEEDS_QTY;
  if (!(a > 0) && sp > 0 && !(q > 0)) return SPEC_NEEDS_QTY;
  return '';
};

// Excel cell -> 'YYYY-MM-DD' (date cells come as serial numbers, text as dd-mm-yyyy / dd/mm/yyyy / yyyy-mm-dd)
export const toIsoDate = (v) => {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
  const s = String(v).trim();
  let m = /^(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})$/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
};

// RoSCTL: % of FOB, limited by the cap per unit (same rule as RoDTEP)
export const rosctlAmount = rodtepAmount;

// ---- RoDTEP schedule and quantity (12-Nov-2026) ----
// Exports under Advance Authorisation / EOU / SEZ claim RoDTEP at the Appendix 4RE rates (lower), DTA exports at the
// Appendix 4R rates. iCAFFE 16518 (scheme 03): 29372200 at 0.4% (4RE), not 0.7% (4R).
const SCHEMES_4RE = new Set(['01', '02', '03', '04', '05', '16', '17', '34', '35', '39', '41', '44', '46', '63']);
export const isAppendix4RE = (item) => SCHEMES_4RE.has(schemeCodeOf(item));
export const rodtepRowOf = (master, item) => {
  const r = String((item && (item.ritc || item.hsnCode)) || '').replace(/\D/g, '');
  return r ? (master || []).find((m) => String(m.tariffItem || '').replace(/\D/g, '') === r) || null : null;
};
// the rate an item claims: { rate, cap, rsPerUqc, uqc, appendix } (null when the RITC is not in the schedule)
export const rodtepRateOf = (m, item) => {
  if (!m) return null;
  const aa = isAppendix4RE(item) && m.rateAA !== null && m.rateAA !== undefined && m.rateAA !== '';
  return { rate: num(aa ? m.rateAA : m.rate), cap: num(aa ? m.capAA : m.cap), rsPerUqc: num(aa ? m.rsPerUqcAA : m.rsPerUqc), uqc: String(m.uqc || '').toUpperCase(), appendix: aa ? '4RE' : '4R' };
};
const up = (v) => String(v || '').trim().toUpperCase();
// SW info rows of an item: its own rows, else the rows kept with the job (a job read from a file) / the CACHE01 rows
const infoRowOf = (item, infoRows, type, qual) => {
  const own = swList(item).find((r) => up(r.swInfoField1 || r.type) === type && up(r.swInfoField2 || r.qual || r.qualifier) === qual);
  if (own) return { msr: num(own.swInfoField5 ?? own.msr ?? own.measurement), uqc: up(own.swInfoField6 || own.uqc || own.unit) };
  const inv = String(parseInt((item && (item.invSr || item.invNo)) || 1, 10) || 1), itm = String(parseInt((item && (item.itemSr || item.itemNo)) || 0, 10) || 0);
  const r = (infoRows || []).find((x) => up(x.infoType || x.type) === type && up(x.infoQualifier || x.qualifier) === qual
    && String(parseInt(x.invoiceSerialNumber ?? x.invSr ?? String(x.invItemNo || '').split('/')[0], 10) || 1) === inv
    && String(parseInt(x.itemSerialNumber ?? x.itemSr ?? String(x.invItemNo || '').split('/')[1], 10) || 0) === itm);
  return r ? { msr: num(r.infoMeasure ?? r.measurement), uqc: up(r.infouqc || r.unit) } : null;
};
// The RoDTEP quantity is the measurement of the item's SW info row DTY / RDT, in the unit of the RoDTEP schedule
// (iCAFFE 19513: 139.7 KGS for 11 NOS of 83071000). The checklist printed the item qty (11 NOS) and the cap per
// unit was applied to it. Item qty only when there is no RDT measurement and the item unit is the schedule's.
export const rodtepQtyOf = (item, infoRows, schedUqc) => {
  const rdt = infoRowOf(item, infoRows, 'DTY', 'RDT');
  if (rdt && rdt.msr > 0) return { qty: rdt.msr, unit: rdt.uqc || up(schedUqc), from: 'RDT' };
  const sqc = infoRowOf(item, infoRows, 'CHR', 'SQC');
  const iu = up(item && (item.unit || item.uqc)), su = up(schedUqc);
  if (sqc && sqc.msr > 0 && (!su || sqc.uqc === su)) return { qty: sqc.msr, unit: sqc.uqc || su, from: 'SQC' };
  if (!su || iu === su) return { qty: num(item && (item.qty || item.quantity)), unit: iu || su, from: 'ITEM' };
  return { qty: 0, unit: su, from: 'NONE' };   // item in NOS, schedule in KGS: the KGS have to be keyed
};
// PMV of an item in INR: ICEGATE's presentMarketValue is per unit; the Items form keeps unitPmv / pmv (per unit) and
// totalPmv. A job read from a file has only the per-unit value, so its total PMV printed 0 (iCAFFE 19513: 85,509.60
// per unit x 11 = 9,40,605.60).
export const itemUnitPmv = (it) => num(it && (it.unitPmv || it.pmv || it.presentMarketValue));
export const itemTotalPmv = (it) => {
  const t = num(it && it.totalPmv);
  if (t > 0) return t;
  const u = itemUnitPmv(it), q = num(it && (it.qty || it.quantity));
  return u > 0 && q > 0 ? r2n(u * q) : 0;
};
export const RDT_QTY_NEEDED ='Quantity in the RoDTEP schedule unit is needed (SW info DTY / RDT, e.g. KGS for an item in NOS)';

// one RoSCTL row per scheme 60 item: schedule row, levies, estimate (null = cap per unit, quantity not keyed)
export const rosctlRowsOf = (items, dbkRows, master) => (items || []).map((it, i) => ({ it, i })).filter(({ it }) => isRosctlItem(it)).map(({ it, i }) => {
  const inv = invOf(it, i), itm = itemNoOf(it, i);
  const d = (dbkRows || []).find((r) => String(r.invNo || r.invSr || 1) === inv && String(r.itemNo || r.itemSr) === itm);
  const dbkNo = (d && d.dbkNo) || it.dbkNo || '';
  const m = findRosctl(master, dbkNo, it.ritc || it.hsnCode);
  const qty = num(it.qty || it.quantity);
  const fob = itemFobInr(it);
  const amt = m ? rosctlAmount({ fob, qty, rate: m.rate, cap: m.cap }) : 0;
  return { it, i, inv, itm, dbkNo, m, slNo: m ? m.tariffItem : '', split: m ? rosctlSplit(m.description) : null, qty, unit: it.unit || it.uqc || (m && m.uqc) || '', fob, rate: m ? num(m.rate) : 0, cap: m ? num(m.cap) : 0, amt, noRow: !m };
});

// a yes / no flag of a saved row: the database gives back '0' / '1' / 'true' / 'false' (12-Nov-2026: valManual came back
// as '0', which reads as true - drawback amounts of a reopened job were never worked out again)
export const flagOn = (v) => v === true || v === 1 || (typeof v === 'string' && /^(1|true|y|yes)$/i.test(v.trim()));
