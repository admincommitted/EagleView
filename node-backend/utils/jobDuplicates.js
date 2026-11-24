// 10-Nov-2026: is this shipment already on another job? (as iCAFFE warns when a new job repeats an invoice / HAWB)
// Checked when a NEW Import (BE) or Export (SB) job is saved from the screen - a duplicated job keeps the invoices and
// AWB nos of the job it was copied from. Same IEC + same invoice no, or the same HAWB (or MAWB of a direct shipment
// without a HAWB), on a job of the last ~13 months that is not void / cancelled and not a BE amendment copy.
// The screen asks "save anyway?" and sends _dupOk: true to go on.
const { sequelize } = require('../db');

const q = (sql, args) => sequelize.query(sql, { replacements: args, type: sequelize.QueryTypes.SELECT });
const key = (v) => String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase();
const BLANK = new Set(['', 'NA', 'N/A', 'NIL', 'NONE', 'NOMAWB', 'NOHAWB', '0', 'DRAFT']);
const ok = (k) => k && !BLANK.has(k) && !/-INV$/.test(k);
const sinceDay = () => { const d = new Date(Date.now() - 400 * 86400000); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const colsCache = {};
async function cols(t) {
  if (!colsCache[t] || Date.now() - colsCache[t].at > 600000) colsCache[t] = { at: Date.now(), set: new Set((await q(`PRAGMA table_info(${t})`, [])).map(c => c.name)) };
  return colsCache[t].set;
}
const pj = (v) => { if (Array.isArray(v)) return v; try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } };

function add(found, row, why) {
  const k = String(row.id);
  if (!found.has(k)) found.set(k, { jobId: row.id, jobNo: row.jobNo, jobDate: row.jobDate || '', why: [] });
  const f = found.get(k); if (!f.why.includes(why)) f.why.push(why);
}

async function check(side, p) {
  const imp = side === 'IMPORT';
  const J = imp ? 'ImportJobs' : 'ExportJobs', I = imp ? 'ImportInvoices' : 'ExportInvoices', fk = imp ? 'importJobId' : 'exportJobId';
  const jc = await cols(J), ic = await cols(I);
  // the column, else the value kept in the JSON column (extendedData / additionalData - export jobs keep many fields there)
  const c = (set, names, alias) => {
    const jsonCol = ['extendedData', 'additionalData'].find(x => set.has(x));
    const out = names.filter(n => set.has(n)).map(n => `nullif(trim(${alias}."${n}"), '')`);
    if (jsonCol) for (const n of names) out.push(`nullif(trim(CASE WHEN json_valid(${alias}.${jsonCol}) THEN json_extract(${alias}.${jsonCol}, '$.${n}') END), '')`);
    return out;
  };
  const coal = (parts) => parts.length ? `coalesce(${parts.join(', ')}, '')` : "''";
  const day = `replace(substr(coalesce(nullif(trim(j.jobDate), ''), j.createdAt), 1, 10), '-', '')`;
  const live = [`${day} >= ?`, "coalesce(j.jobNo, '') NOT LIKE 'AMD/%'", "upper(coalesce(j.status, '')) NOT IN ('VOID', 'CANCELLED', 'CANCEL')"];
  if (jc.has('isVoid')) live.push('coalesce(j.isVoid, 0) = 0');
  const notSelf = p.id ? ' AND j.id <> ?' : '';
  const base = (args) => [sinceDay(), ...(p.id ? [p.id] : []), ...args];
  const found = new Map();

  // 1. same exporter / importer IEC + same invoice no
  const iec = key(imp ? (p.autoField_5 || p.iecCode) : (p.shipperIec || p.iec));
  const invNos = [...new Set((Array.isArray(p.invoices) ? p.invoices : []).map(i => key(i && (i.invNo || i.invoiceNo || i.no))).filter(ok))];
  const invExpr = `upper(replace(${coal(c(ic, ['invNo', 'invoiceNo', 'no'], 'i'))}, ' ', ''))`;
  const iecExpr = `upper(replace(${coal(c(jc, imp ? ['autoField_5', 'iecCode'] : ['shipperIec'], 'j'))}, ' ', ''))`;
  if (iec && invNos.length && invExpr !== "upper(replace('', ' ', ''))") {
    const rows = await q(`SELECT DISTINCT j.id, j.jobNo, j.jobDate, ${invExpr} k FROM ${I} i JOIN ${J} j ON j.id = i.${fk}
      WHERE ${live.join(' AND ')}${notSelf} AND ${iecExpr} = ? AND ${invExpr} IN (${invNos.map(() => '?').join(',')}) LIMIT 50`, base([iec, ...invNos]));
    for (const r of rows) add(found, r, 'Invoice ' + r.k);
  }

  // 2. same HAWB; a MAWB only when neither job has a HAWB (direct shipment - a consol MAWB carries many HAWBs)
  const rowsIgm = imp ? pj(p._igmRows) : [];
  const hawbs = [...new Set([p.hawbNo, ...rowsIgm.map(r => r && r.hawbNo)].map(key).filter(ok))];
  const mawbs = [...new Set([p.mawbNo, ...rowsIgm.map(r => r && r.mawbNo)].map(key).filter(ok))];
  const hExpr = `upper(replace(${coal(c(jc, ['hawbNo'], 'j'))}, ' ', ''))`, mExpr = `upper(replace(${coal(c(jc, ['mawbNo'], 'j'))}, ' ', ''))`;
  if (hawbs.length) {
    const rows = await q(`SELECT j.id, j.jobNo, j.jobDate, ${hExpr} k FROM ${J} j WHERE ${live.join(' AND ')}${notSelf} AND ${hExpr} IN (${hawbs.map(() => '?').join(',')}) LIMIT 50`, base(hawbs));
    for (const r of rows) add(found, r, 'HAWB ' + r.k);
    if (imp && jc.has('_igmRows')) {
      for (const h of hawbs.slice(0, 10)) {
        const cand = await q(`SELECT j.id, j.jobNo, j.jobDate, j._igmRows FROM ${J} j WHERE ${live.join(' AND ')}${notSelf} AND j._igmRows LIKE ? LIMIT 50`, base(['%' + h + '%']));
        for (const r of cand) if (pj(r._igmRows).some(x => key(x && x.hawbNo) === h)) add(found, r, 'HAWB ' + h);
      }
    }
  } else if (mawbs.length) {
    const noHawb = ` AND ${hExpr} IN ('', 'NA', 'NIL', 'NOHAWB')`;
    const rows = await q(`SELECT j.id, j.jobNo, j.jobDate, ${mExpr} k FROM ${J} j WHERE ${live.join(' AND ')}${notSelf} AND ${mExpr} IN (${mawbs.map(() => '?').join(',')})${noHawb} LIMIT 50`, base(mawbs));
    for (const r of rows) add(found, r, 'MAWB ' + r.k);
  }
  return [...found.values()].slice(0, 10);
}

function message(matches) {
  return 'This shipment may already be on ' + (matches.length === 1 ? 'job ' : 'jobs ') +
    matches.map(m => `${m.jobNo}${/^\d{4}-\d{2}-\d{2}/.test(String(m.jobDate || '')) ? ' (' + String(m.jobDate).slice(8, 10) + '-' + String(m.jobDate).slice(5, 7) + '-' + String(m.jobDate).slice(0, 4) + ')' : ''}: ${m.why.join(', ')}`).join('; ');
}

module.exports = { check, message };
