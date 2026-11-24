// 04-Nov-2026: iCAFFE party directory - exporters, consignees, sub agents, overseas agents, shipping lines, IATA agents
// and banks read from iCAFFE (table IcaffeParties, filled by load_icaffe_parties.js). Large (tens of thousands of rows),
// so it is NOT mixed into the Party master that the job screens load in full; it is searched here and a row is copied
// into the Party master ("Add to Party Master") when it is needed in a job.
const express = require('express');
const router = express.Router();
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');

const TYPES = ['EXPORTER', 'CONSIGNEE', 'SUBAGENT', 'OVERSEAS_AGENT', 'SHIPLINE', 'IATA_AGENT', 'BANK'];
const q = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const tableReady = async () => (await q("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'IcaffeParties'")).length > 0;
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const out = (r) => ({ ...r, addresses: parse(r.addresses, []), adCodes: parse(r.adCodes, []), dbkAccounts: parse(r.dbkAccounts, []), extra: parse(r.extra, {}) });

// GET /api/icaffe-parties/stats
router.get('/stats', async (req, res) => {
  try {
    if (!(await tableReady())) return res.json({ loaded: false, types: [] });
    const rows = await q('SELECT partyType, count(*) n, sum(CASE WHEN importedPartyId IS NOT NULL THEN 1 ELSE 0 END) imported FROM IcaffeParties GROUP BY partyType');
    res.json({ loaded: true, types: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/icaffe-parties?q=&type=&limit=  (name, code, IEC, PAN or GSTIN)
router.get('/', async (req, res) => {
  try {
    if (!(await tableReady())) return res.json([]);
    const text = String(req.query.q || '').trim();
    const type = String(req.query.type || '').trim().toUpperCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const where = []; const p = [];
    if (type && TYPES.includes(type)) { where.push('partyType = ?'); p.push(type); }
    if (text) {
      where.push('(name LIKE ? OR code = ? OR iec = ? OR pan = ? OR gstin LIKE ?)');
      p.push('%' + text + '%', text.toUpperCase(), text.toUpperCase(), text.toUpperCase(), '%' + text.toUpperCase() + '%');
    }
    const sql = 'SELECT * FROM IcaffeParties' + (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name LIMIT ?';
    p.push(text + '%', limit);
    res.json((await q(sql, p)).map(out));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = (await q('SELECT * FROM IcaffeParties WHERE id = ?', [req.params.id]))[0];
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(out(r));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/icaffe-parties/:id/import -> copies the row into the Party master (or links an existing party of the same name)
router.post('/:id/import', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const Party = require('../models/Party');
    const PartyBranch = require('../models/PartyBranch');
    const PartyADCode = require('../models/PartyADCode');
    const r0 = (await sequelize.query('SELECT * FROM IcaffeParties WHERE id = ?', { replacements: [req.params.id], type: QueryTypes.SELECT, transaction: t }))[0];
    if (!r0) { await t.rollback(); return res.status(404).json({ error: 'Not found' }); }
    const r = out(r0);
    if (!['EXPORTER', 'CONSIGNEE', 'SUBAGENT', 'OVERSEAS_AGENT', 'SHIPLINE'].includes(r.partyType)) { await t.rollback(); return res.status(400).json({ error: r.partyType === 'IATA_AGENT' ? 'IATA agents are in the IATA Agent Master' : 'This type does not go into the Party master' }); }
    const flag = { EXPORTER: 'isShipper', CONSIGNEE: 'isConsignee', SUBAGENT: 'isSubAgent', OVERSEAS_AGENT: 'isOverseasAgent', SHIPLINE: 'isShipline', IATA_AGENT: 'isIataAgent' }[r.partyType];
    const name = String(r.name || '').replace(/\s+/g, ' ').trim();
    let party = (r.importedPartyId && await Party.findByPk(r.importedPartyId, { transaction: t })) || await Party.findOne({ where: { code: r.code }, transaction: t }) || await Party.findOne({ where: { name }, transaction: t });
    let created = false;
    if (party) {
      if (!party[flag]) await party.update({ [flag]: true, partyType: party.partyType === 'MULTI' ? 'MULTI' : party.partyType }, { transaction: t });
    } else {
      const a = r.addresses[0] || {};
      party = await Party.create({
        partyType: { EXPORTER: 'SHIPPER', CONSIGNEE: 'CONSIGNEE', SUBAGENT: 'SUBAGENT', OVERSEAS_AGENT: 'AGENT', SHIPLINE: 'SHIPLINE', IATA_AGENT: 'IATA_AGENT' }[r.partyType],
        [flag]: true, code: r.code, name, extendedName: r.extra.extendedName || null,
        street: [a.address1, a.address2].filter(Boolean).join(', ') || null, city: a.city || r.city || null, stateProvince: a.state || r.state || null,
        zipPostcode: a.pinCode || r.pinCode || null, countryCode: r.countryCode || null, phoneNumber: a.phone || r.phone || null, email: a.email1 || r.email || null,
        taxId: r.iec || null, panNumber: r.pan || null, classType: r.classType || null, iecNoReqd: !!r.iec,
        rbiNumber: r.extra.rbiNumber || null, mercManuf: r.extra.mercManuf || null, remarks: 'From iCAFFE ' + r.code
      }, { transaction: t });
      created = true;
      let n = 0;
      for (const b of r.addresses) {
        n++;
        await PartyBranch.create({ partyId: party.id, branchSrNo: String(n), isDefault: n === 1, branchName: b.branchName || 'DEFAULT', contactPerson: b.contactPerson || null,
          address1: b.address1 || '', address2: b.address2 || '', city: b.city || '', state: b.state || '', country: r.countryCode || b.country || '', pinCode: b.pinCode || '',
          phone: b.phone || '', mobile: b.mobile || '', fax: b.fax || '', email1: b.email1 || '', email2: b.email2 || '', website: b.website || '', tanNo: b.tanNo || '',
          gstin: b.gstin || '', regNo: b.gstin || '', ctxState: b.gstStateCode || '' }, { transaction: t });
      }
      for (const c of r.adCodes) {
        if (!c.adCode) continue;
        await PartyADCode.create({ partyId: party.id, adCode: c.adCode, bankName: c.bankName || '', serialNo: c.serialNo || '', forexCode: c.forexCode || '', bankAddress: c.bankAddress || '', branchAddress: c.branchAddress || '', loadingPort: c.port || '' }, { transaction: t });
      }
    }
    await sequelize.query('UPDATE IcaffeParties SET importedPartyId = ?, updatedAt = ? WHERE id = ?', { replacements: [party.id, new Date().toISOString(), r.id], transaction: t });
    await t.commit();
    try { require('./masters').clearPartyCache(); } catch (e) { /* cache clears itself in 10 min */ }
    res.json({ ok: true, created, partyId: party.id, name: party.name });
  } catch (e) {
    try { await t.rollback(); } catch (x) { /* closed */ }
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
