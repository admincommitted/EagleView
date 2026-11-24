const express = require('express');
const router = express.Router();
const PenaltyRule = require('../models/PenaltyRule');

router.get('/', async (req, res) => {
  try {
    const rules = await PenaltyRule.findAll();
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 28-Oct-2026: fields checked and only known columns saved; same trade + type + mode twice is refused;
// update / delete answer 404 for a missing rule (they said "success" before)
const TRADES = ['IMPORT', 'EXPORT', 'BOTH'];
const MODES = ['SEA', 'AIR', 'ALL'];
function clean(b) {
  const v = {};
  const up = (x) => String(x == null ? '' : x).trim().toUpperCase();
  v.tradeType = up(b.tradeType || 'IMPORT');
  v.type = up(b.type);
  v.mode = up(b.mode);
  v.basis = up(b.basis);
  v.rateUom = up(b.rateUom || 'PER_SHIPMENT_PER_DAY');
  if (!TRADES.includes(v.tradeType)) throw new Error('Trade type must be IMPORT, EXPORT or BOTH');
  if (!MODES.includes(v.mode)) throw new Error('Mode must be SEA, AIR or ALL');
  if (!/^[A-Z_]{3,40}$/.test(v.type)) throw new Error('Penalty type is required');
  if (!/^[A-Z_]{3,40}$/.test(v.basis)) throw new Error('Calculation basis is required');
  const days = Number(b.freeDays);
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new Error('Free days must be a whole number 0 - 365');
  v.freeDays = days;
  for (const k of ['slab1Rate', 'slab2Rate', 'slab3Rate']) {
    const n = b[k] === '' || b[k] == null ? 0 : Number(b[k]);
    if (!Number.isFinite(n) || n < 0 || n > 99999999) throw new Error(`${k} must be a number 0 or more`);
    v[k] = Math.round(n * 100) / 100;
  }
  return v;
}
async function duplicate(v, id) {
  const { Op } = require('sequelize');
  return PenaltyRule.findOne({ where: { tradeType: v.tradeType, type: v.type, mode: v.mode, ...(id ? { id: { [Op.ne]: id } } : {}) } });
}

router.post('/', async (req, res) => {
  let v;
  try { v = clean(req.body || {}); } catch (e) { return res.status(400).json({ success: false, message: e.message }); }
  try {
    if (await duplicate(v)) return res.status(409).json({ success: false, message: `A ${v.tradeType} ${v.type} rule for ${v.mode} already exists - edit that one` });
    const rule = await PenaltyRule.create(v);
    res.json({ success: true, data: rule, message: 'Rule created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  let v;
  try { v = clean(req.body || {}); } catch (e) { return res.status(400).json({ success: false, message: e.message }); }
  try {
    const rule = await PenaltyRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    if (await duplicate(v, rule.id)) return res.status(409).json({ success: false, message: `A ${v.tradeType} ${v.type} rule for ${v.mode} already exists` });
    await rule.update(v);
    res.json({ success: true, data: rule, message: 'Rule updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await PenaltyRule.destroy({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
