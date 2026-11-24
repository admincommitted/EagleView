// Customs duty lists that had no screen (22-Nov-2026), mounted at /api/tariff/dutylists:
//   add          anti-dumping duty rows      table AddDutyRates (filled from iCAFFE by load_icaffe_antidumping.js; view only here)
//   cvd          countervailing duty rows    table CvdDutyRates      (new)
//   cess         export cess rows            table ExportCessRates   (new)
//   tariffvalue  tariff values (36/2001)     table TariffValueRates  (new)
// The three new tables are made here on first use (CREATE TABLE IF NOT EXISTS), so the screen works before any loader ran.
//   GET    /                         -> row counts of the four lists
//   GET    /:kind?q=&page=&limit=&inactive=1 -> { rows, total, page, limit }
//   POST   /:kind                    -> add a row            (cvd, cess, tariffvalue)
//   PUT    /:kind/:id                -> change a row
//   PUT    /:kind/:id/active         -> { isActive } - a row is switched off, never deleted, from the screen
// Reads are open to every logged-in user and writes need the "Customs & Compliance" module (the /api/tariff rule).
const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const TABLES = require('../utils/dutyListTables');
const router = express.Router();

const T = (name, type, opt = {}) => ({ name, type, ...opt }); // type: s = text, n = number
const KINDS = {
  add: { table: 'AddDutyRates', readOnly: true, order: 'notifDate DESC, notifNo DESC, CAST(serialNo AS INTEGER), CAST(cthSlNo AS INTEGER)',
    cols: [T('notifNo', 's'), T('notifDate', 's'), T('endDate', 's'), T('serialNo', 's'), T('cthSlNo', 's'), T('cth', 's'), T('specSeries', 's'), T('originCountry', 's'), T('exportCountry', 's'), T('flag', 's'), T('rate', 'n'), T('amount', 'n'), T('uqc', 's'), T('currency', 's'), T('memorandum', 's')],
    search: ['notifNo', 'cth', 'originCountry', 'exportCountry', 'memorandum'] },
  cvd: { table: 'CvdDutyRates', order: 'notifNo DESC, CAST(serialNo AS INTEGER), CAST(itemSlNo AS INTEGER), CAST(suppSlNo AS INTEGER)',
    cols: [T('notifNo', 's', { req: true, max: 20 }), T('serialNo', 's', { max: 10 }), T('itemSlNo', 's', { max: 10 }), T('suppSlNo', 's', { max: 10 }), T('cth', 's', { req: true, max: 8 }), T('originCountry', 's', { max: 2 }), T('exportCountry', 's', { max: 2 }), T('rate', 'n'), T('calcMethod', 's', { max: 40 }), T('description', 's', { max: 500 }), T('exporter', 's', { max: 300 }), T('producer', 's', { max: 300 })],
    search: ['notifNo', 'cth', 'originCountry', 'exportCountry', 'description', 'producer', 'exporter'],
    ddl: TABLES.cvd.ddl, idx: TABLES.cvd.idx },
  cess: { table: 'ExportCessRates', order: 'ritc, CAST(serialNo AS INTEGER)',
    cols: [T('ritc', 's', { max: 8 }), T('serialNo', 's', { max: 10 }), T('tariffValue', 'n'), T('tariffUnit', 's', { max: 10 }), T('ratePercent', 'n'), T('rateRs', 'n'), T('unit', 's', { max: 10 }), T('description', 's', { max: 300 })],
    search: ['ritc', 'description'],
    ddl: TABLES.cess.ddl, idx: TABLES.cess.idx },
  tariffvalue: { table: 'TariffValueRates', order: 'cth, CAST(serialNo AS INTEGER)',
    cols: [T('notifNo', 's', { req: true, max: 20 }), T('serialNo', 's', { max: 10 }), T('cth', 's', { req: true, max: 8 }), T('description', 's', { req: true, max: 300 }), T('tariffValue', 'n', { req: true }), T('currency', 's', { max: 3 }), T('uqc', 's', { max: 6 }), T('effectiveDate', 's', { max: 10 })],
    search: ['notifNo', 'cth', 'description'],
    ddl: TABLES.tariffvalue.ddl, idx: TABLES.tariffvalue.idx },
};

let ready = null;
const ensure = () => {
  if (!ready) {
    ready = (async () => {
      for (const k of Object.values(KINDS)) {
        if (!k.ddl) continue;
        await sequelize.query(k.ddl);
        for (const c of k.idx || []) await sequelize.query(`CREATE INDEX IF NOT EXISTS ${k.table.toLowerCase()}_${c.toLowerCase()} ON ${k.table} (${c})`);
      }
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
};
const hasTable = async (t) => (await sequelize.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", { replacements: [t], type: QueryTypes.SELECT })).length > 0;
const kindOf = (req, res) => { const k = KINDS[String(req.params.kind || '').toLowerCase()]; if (!k) res.status(404).json({ error: 'Unknown list' }); return k; };

// one row from the form: trimmed, upper-cased codes, numbers as numbers; returns { values } or { error }
function clean(k, body) {
  const v = {};
  for (const c of k.cols) {
    let x = body[c.name];
    if (c.type === 'n') {
      if (x === '' || x === null || x === undefined) { if (c.req) return { error: c.name + ' is required' }; v[c.name] = null; continue; }
      const n = Number(String(x).replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0) return { error: c.name + ' must be a number, 0 or more' };
      v[c.name] = n;
    } else {
      x = String(x === null || x === undefined ? '' : x).trim();
      if (['cth', 'ritc', 'originCountry', 'exportCountry', 'currency', 'uqc', 'tariffUnit', 'unit'].includes(c.name)) x = x.toUpperCase();
      if (!x && c.req) return { error: c.name + ' is required' };
      if (c.max && x.length > c.max) return { error: c.name + ' is too long (' + c.max + ' characters at most)' };
      if ((c.name === 'cth' || c.name === 'ritc') && x && !/^\d{2,8}$/.test(x)) return { error: c.name.toUpperCase() + ' must be 2 to 8 digits' };
      if (c.name === 'effectiveDate' && x && !/^\d{4}-\d{2}-\d{2}$/.test(x)) return { error: 'Date must be YYYY-MM-DD' };
      v[c.name] = x || null;
    }
  }
  return { values: v };
}
const nowSql = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');

router.get('/', async (req, res) => {
  try {
    await ensure();
    const out = {};
    for (const [key, k] of Object.entries(KINDS)) {
      if (!(await hasTable(k.table))) { out[key] = { total: 0, active: 0 }; continue; }
      const r = (await sequelize.query(`SELECT count(*) total, coalesce(sum(CASE WHEN isActive = 1 THEN 1 ELSE 0 END), 0) active FROM ${k.table}`, { type: QueryTypes.SELECT }))[0];
      out[key] = { total: r.total, active: r.active };
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:kind', async (req, res) => {
  try {
    const k = kindOf(req, res); if (!k) return;
    await ensure();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    if (!(await hasTable(k.table))) return res.json({ rows: [], total: 0, page: 1, limit });
    const where = [], p = [];
    if (String(req.query.inactive || '') !== '1') where.push('isActive = 1');
    const q = String(req.query.q || '').trim();
    if (q) { where.push('(' + k.search.map((c) => `${c} LIKE ?`).join(' OR ') + ')'); k.search.forEach((c) => p.push((c === 'cth' || c === 'ritc' ? '' : '%') + q + '%')); }
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const total = (await sequelize.query(`SELECT count(*) n FROM ${k.table}${w}`, { replacements: p, type: QueryTypes.SELECT }))[0].n;
    const rows = await sequelize.query(`SELECT id, ${k.cols.map((c) => c.name).join(', ')}, isActive FROM ${k.table}${w} ORDER BY ${k.order} LIMIT ? OFFSET ?`, { replacements: [...p, limit, (page - 1) * limit], type: QueryTypes.SELECT });
    res.json({ rows, total, page, limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:kind', async (req, res) => {
  try {
    const k = kindOf(req, res); if (!k) return;
    if (k.readOnly) return res.status(400).json({ error: 'This list is loaded from iCAFFE and is not changed here' });
    await ensure();
    const c = clean(k, req.body || {}); if (c.error) return res.status(400).json({ error: c.error });
    const names = k.cols.map((x) => x.name), t = nowSql();
    const [id] = await sequelize.query(`INSERT INTO ${k.table} (${names.join(', ')}, source, isActive, createdAt, updatedAt) VALUES (${names.map(() => '?').join(', ')}, 'MANUAL', 1, ?, ?)`, { replacements: [...names.map((n) => c.values[n]), t, t], type: QueryTypes.INSERT });
    res.status(201).json({ id, ...c.values, isActive: 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:kind/:id/active', async (req, res) => {
  try {
    const k = kindOf(req, res); if (!k) return;
    if (k.readOnly) return res.status(400).json({ error: 'This list is loaded from iCAFFE and is not changed here' });
    await ensure();
    const id = parseInt(req.params.id, 10); if (!id) return res.status(400).json({ error: 'Bad id' });
    const on = req.body && (req.body.isActive === true || req.body.isActive === 1 || req.body.isActive === '1') ? 1 : 0;
    const [, meta] = await sequelize.query(`UPDATE ${k.table} SET isActive = ?, updatedAt = ? WHERE id = ?`, { replacements: [on, nowSql(), id] });
    if (meta && meta.changes === 0) return res.status(404).json({ error: 'Row not found' });
    res.json({ id, isActive: on });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:kind/:id', async (req, res) => {
  try {
    const k = kindOf(req, res); if (!k) return;
    if (k.readOnly) return res.status(400).json({ error: 'This list is loaded from iCAFFE and is not changed here' });
    await ensure();
    const id = parseInt(req.params.id, 10); if (!id) return res.status(400).json({ error: 'Bad id' });
    const c = clean(k, req.body || {}); if (c.error) return res.status(400).json({ error: c.error });
    const names = k.cols.map((x) => x.name);
    const [, meta] = await sequelize.query(`UPDATE ${k.table} SET ${names.map((n) => n + ' = ?').join(', ')}, updatedAt = ? WHERE id = ?`, { replacements: [...names.map((n) => c.values[n]), nowSql(), id] });
    if (meta && meta.changes === 0) return res.status(404).json({ error: 'Row not found' });
    res.json({ id, ...c.values });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
