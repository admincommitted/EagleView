// One-time move of beNo / beDate (and the clearance dates) from extendedData JSON into their columns (30-Oct-2026).
// Safe to run on every start: only rows whose column is empty and whose JSON has the value are touched.
const { sequelize } = require('../db');
const FIELDS = ['beNo', 'beDate', 'assessmentDate', 'dutyPaidDate', 'challanNo', 'oocDate'];

async function migrateBeFields() {
  try {
    const ImportJob = require('../models/ImportJob');
    const { Op } = require('sequelize');
    const rows = await ImportJob.findAll({ where: { extendedData: { [Op.or]: FIELDS.map(f => ({ [Op.like]: `%"${f}"%` })) } }, attributes: ['id', 'extendedData', ...FIELDS] });
    let moved = 0;
    for (const r of rows) {
      let ext; try { ext = JSON.parse(r.extendedData || '{}'); } catch (e) { continue; }
      if (!ext || typeof ext !== 'object') continue;
      const upd = {}; let touched = false;
      for (const f of FIELDS) {
        if (f in ext) {
          const v = ext[f];
          if ((r[f] === null || r[f] === undefined || r[f] === '') && v !== null && v !== undefined && String(v) !== '') upd[f] = String(v);
          delete ext[f]; touched = true;
        }
      }
      if (!touched) continue;
      upd.extendedData = Object.keys(ext).length ? JSON.stringify(ext) : null;
      await ImportJob.update(upd, { where: { id: r.id } });
      moved++;
    }
    if (moved) console.log(`[DB] BE No / dates moved from extendedData into columns on ${moved} import job(s)`);
  } catch (e) { console.warn('[DB] BE fields migrate:', e.message); }
}
module.exports = { migrateBeFields };
