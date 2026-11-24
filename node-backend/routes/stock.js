const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../db');
const AwbStock = require('../models/AwbStock');
const HawbStock = require('../models/HawbStock');
const Party = require('../models/Party');

const router = express.Router();

/*
 * AWB / HAWB stock. 28-Oct-2026 rework:
 * - numbers checked: airline prefix 3 digits, serial 7 digits, check digit = serial mod 7 (IATA rule);
 *   a wrong check digit in the first AWB is refused (the old code silently made a different series);
 * - count limited (1-5000); numbers that already exist are skipped and reported (it said "generated N" anyway);
 * - one transaction per batch; Stock Date saved; HAWB party saved (partyType / partyId were ignored);
 * - /next RESERVES the number (status ALLOCATED) in one conditional update, so two users never get the same AWB;
 *   a reservation not saved on an AWB within 4 hours is given out again;
 * - unallocate only moves ALLOCATED back to AVAILABLE (it could make a USED / VOID number available again);
 * - new: void, delete (only AVAILABLE), verify and return of one AWB, for the Return Stock tab;
 * - list filters on Stock Date and shows the HAWB party name.
 */
const MAX_BATCH = 5000;
const RESERVE_MS = 4 * 60 * 60 * 1000;
const checkOf = (seq7) => Number(seq7) % 7;
const bad = (res, msg) => res.status(400).json({ success: false, error: msg });
const dayStart = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : null);
const dayEnd = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T23:59:59.999') : null);
function dateWhere(field, fromDate, toDate) {
    const f = dayStart(fromDate), t = dayEnd(toDate);
    if (f && t) return { [field]: { [Op.between]: [f, t] } };
    if (f) return { [field]: { [Op.gte]: f } };
    if (t) return { [field]: { [Op.lte]: t } };
    return {};
}
const modelOf = (type) => (String(type || 'AWB').toUpperCase() === 'HAWB' ? HawbStock : AwbStock);
const idList = (ids) => (Array.isArray(ids) ? ids.map(Number).filter(n => Number.isInteger(n) && n > 0) : []);
// "176-1234 5675", "17612345675" -> "17612345675"
const pureAwb = (v) => String(v || '').replace(/\D/g, '');
function awbProblem(no) {
    if (!/^\d{11}$/.test(no)) return 'AWB number must be 11 digits (3-digit prefix + 8-digit serial)';
    if (checkOf(no.slice(3, 10)) !== Number(no[10])) return `Check digit is wrong: for serial ${no.slice(3, 10)} it must be ${checkOf(no.slice(3, 10))}`;
    return null;
}

// POST /api/stock/generate { airlinePrefix, startSerialNumber (7 digits, or 8 with check digit), count, stockDate }
router.post('/generate', async (req, res) => {
    const prefix = String(req.body.airlinePrefix || '').trim();
    const start = String(req.body.startSerialNumber || '').replace(/\s/g, '');
    const count = parseInt(req.body.count, 10);
    if (!/^\d{3}$/.test(prefix)) return bad(res, 'Airline prefix must be 3 digits (e.g. 176)');
    if (!/^\d{7,8}$/.test(start)) return bad(res, 'Starting AWB serial must be 7 digits (or 8 with the check digit)');
    if (start.length === 8 && checkOf(start.slice(0, 7)) !== Number(start[7])) return bad(res, `Check digit of the first AWB is wrong: for ${start.slice(0, 7)} it must be ${checkOf(start.slice(0, 7))}`);
    if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) return bad(res, `Count must be between 1 and ${MAX_BATCH}`);
    const first = parseInt(start.slice(0, 7), 10);
    if (first + count - 1 > 9999999) return bad(res, 'The series goes past serial 9999999 - reduce the count');
    const stockDate = dayStart(req.body.stockDate) || new Date();
    try {
        const rows = [];
        for (let i = 0; i < count; i++) {
            const seq = String(first + i).padStart(7, '0');
            rows.push({ airlinePrefix: prefix, sequenceNumber: seq, checkDigit: checkOf(seq), fullAwbNumber: `${prefix}${seq}${checkOf(seq)}`, status: 'AVAILABLE', stockDate });
        }
        const existing = new Set((await AwbStock.findAll({ attributes: ['fullAwbNumber'], where: { fullAwbNumber: rows.map(r => r.fullAwbNumber) } })).map(r => r.fullAwbNumber));
        const toAdd = rows.filter(r => !existing.has(r.fullAwbNumber));
        await sequelize.transaction(async (t) => { for (let i = 0; i < toAdd.length; i += 500) await AwbStock.bulkCreate(toAdd.slice(i, i + 500), { transaction: t }); });
        res.status(201).json({ success: true, generated: toAdd.length, skipped: existing.size, startAwb: rows[0].fullAwbNumber, endAwb: rows[rows.length - 1].fullAwbNumber });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/stock/next/:prefix - reserves the next AVAILABLE AWB (status ALLOCATED); saving the AWB makes it USED
router.get('/next/:prefix', async (req, res) => {
    const prefix = String(req.params.prefix || '').trim();
    if (!/^\d{3}$/.test(prefix)) return bad(res, 'Airline prefix must be 3 digits');
    try {
        // a reservation never saved on an AWB is released after 4 hours
        await AwbStock.update({ status: 'AVAILABLE' }, { where: { airlinePrefix: prefix, status: 'ALLOCATED', updatedAt: { [Op.lt]: new Date(Date.now() - RESERVE_MS) } } });
        for (let attempt = 0; attempt < 5; attempt++) {
            const stock = await AwbStock.findOne({ where: { airlinePrefix: prefix, status: 'AVAILABLE' }, order: [['sequenceNumber', 'ASC'], ['id', 'ASC']] });
            if (!stock) return res.status(404).json({ success: false, error: 'No available AWB stock for this prefix.' });
            // only one request can move this row from AVAILABLE to ALLOCATED
            const [n] = await AwbStock.update({ status: 'ALLOCATED' }, { where: { id: stock.id, status: 'AVAILABLE' } });
            if (n === 1) return res.json({ success: true, awbNumber: stock.fullAwbNumber, serial: stock.fullAwbNumber.substring(3), reservedForHours: RESERVE_MS / 3600000 });
        }
        res.status(409).json({ success: false, error: 'AWB stock is busy, please try again' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/stock/list?prefix=&status=&fromDate=&toDate=
router.get('/list', async (req, res) => {
    try {
        const { prefix, status, fromDate, toDate } = req.query;
        const where = { ...dateWhere('stockDate', fromDate, toDate) };
        if (prefix) where.airlinePrefix = String(prefix);
        if (status && status !== 'ALL') where.status = String(status);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 5000);
        // AWB screen suggestions (29-Oct-2026): ?prefix=176&suffix=1234 -> only this airline, serial starting with what was typed
        if (req.query.suffix) where.fullAwbNumber = { [Op.like]: String(prefix || '') + String(req.query.suffix).replace(/\D/g, '') + '%' };
        const order = req.query.order === 'seq' ? [['sequenceNumber', 'ASC'], ['id', 'ASC']] : [['stockDate', 'DESC'], ['airlinePrefix', 'ASC'], ['sequenceNumber', 'ASC']];
        let stocks = await AwbStock.findAll({ where, order, limit: req.query.unused ? Math.min(limit * 4, 5000) : limit });
        if (req.query.unused && stocks.length) {
            // stock still marked AVAILABLE but the number is already on a live AWB -> not offered
            const Airwaybill = require('../models/Airwaybill');
            const nos = stocks.map((s) => s.fullAwbNumber);
            const dashed = nos.map((n) => `${n.slice(0, 3)}-${n.slice(3)}`);
            const used = await Airwaybill.findAll({ attributes: ['awbNumber'], where: { awbNumber: { [Op.in]: [...nos, ...dashed] }, status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } } });
            const usedSet = new Set(used.map((a) => String(a.awbNumber).replace(/\D/g, '')));
            stocks = stocks.filter((s) => !usedSet.has(s.fullAwbNumber)).slice(0, limit);
        }
        res.json(stocks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stock/hawb/list?status=&fromDate=&toDate=
router.get('/hawb/list', async (req, res) => {
    try {
        const { status, fromDate, toDate } = req.query;
        const where = { ...dateWhere('stockDate', fromDate, toDate) };
        if (status && status !== 'ALL') where.status = String(status);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 5000);
        const stocks = await HawbStock.findAll({ where, order: [['stockDate', 'DESC'], ['prefix', 'ASC'], ['sequenceNumber', 'ASC']], limit });
        const ids = [...new Set(stocks.map(s => s.partyId).filter(Boolean))];
        const names = new Map(ids.length ? (await Party.findAll({ attributes: ['id', 'name'], where: { id: ids } })).map(p => [p.id, p.name]) : []);
        res.json(stocks.map(s => ({ ...s.toJSON(), partyName: names.get(s.partyId) || '', party: s.partyId ? { id: s.partyId, name: names.get(s.partyId) || '' } : null })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stock/hawb/generate { prefix, startSerialNumber, count, partyType, partyId, stockDate }
router.post('/hawb/generate', async (req, res) => {
    const prefix = String(req.body.prefix || '').trim().toUpperCase();
    const start = String(req.body.startSerialNumber || '').trim();
    const count = parseInt(req.body.count, 10);
    if (prefix && !/^[A-Z0-9/-]{1,10}$/.test(prefix)) return bad(res, 'HAWB prefix: up to 10 letters / digits');
    if (!/^\d{1,12}$/.test(start)) return bad(res, 'Starting HAWB number must be digits only');
    if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) return bad(res, `Count must be between 1 and ${MAX_BATCH}`);
    const partyId = req.body.partyId ? parseInt(req.body.partyId, 10) : null;
    try {
        if (partyId && !(await Party.findByPk(partyId, { attributes: ['id'] }))) return bad(res, 'Selected party not found');
        const first = parseInt(start, 10), pad = start.length;
        const stockDate = dayStart(req.body.stockDate) || new Date();
        const rows = [];
        for (let i = 0; i < count; i++) {
            const seq = String(first + i).padStart(pad, '0');
            rows.push({ prefix, sequenceNumber: seq, fullHawbNumber: prefix + seq, status: 'AVAILABLE', partyType: req.body.partyType || null, partyId, stockDate });
        }
        const existing = new Set((await HawbStock.findAll({ attributes: ['fullHawbNumber'], where: { fullHawbNumber: rows.map(r => r.fullHawbNumber) } })).map(r => r.fullHawbNumber));
        const toAdd = rows.filter(r => !existing.has(r.fullHawbNumber));
        await sequelize.transaction(async (t) => { for (let i = 0; i < toAdd.length; i += 500) await HawbStock.bulkCreate(toAdd.slice(i, i + 500), { transaction: t }); });
        res.status(201).json({ success: true, generated: toAdd.length, skipped: existing.size, startHawb: rows[0].fullHawbNumber, endHawb: rows[rows.length - 1].fullHawbNumber });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/stock/unallocate { ids, type: 'AWB'|'HAWB' } - ALLOCATED -> AVAILABLE only
router.post('/unallocate', async (req, res) => {
    try {
        const ids = idList(req.body.ids);
        if (!ids.length) return bad(res, 'Select at least one stock row');
        const [n] = await modelOf(req.body.type).update({ status: 'AVAILABLE' }, { where: { id: ids, status: 'ALLOCATED' } });
        res.json({ success: true, updated: n, skipped: ids.length - n, message: `${n} unallocated` + (ids.length - n ? `, ${ids.length - n} skipped (only ALLOCATED stock can be unallocated)` : '') });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/stock/void { ids, type } - AVAILABLE / ALLOCATED -> VOID (never given out again)
router.post('/void', async (req, res) => {
    try {
        const ids = idList(req.body.ids);
        if (!ids.length) return bad(res, 'Select at least one stock row');
        const [n] = await modelOf(req.body.type).update({ status: 'VOID' }, { where: { id: ids, status: ['AVAILABLE', 'ALLOCATED'] } });
        res.json({ success: true, updated: n, skipped: ids.length - n, message: `${n} voided` + (ids.length - n ? `, ${ids.length - n} skipped (USED / already VOID)` : '') });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/stock/delete { ids, type } - removes stock entered by mistake; only AVAILABLE rows
router.post('/delete', async (req, res) => {
    try {
        const ids = idList(req.body.ids);
        if (!ids.length) return bad(res, 'Select at least one stock row');
        const n = await modelOf(req.body.type).destroy({ where: { id: ids, status: 'AVAILABLE' } });
        res.json({ success: true, deleted: n, skipped: ids.length - n, message: `${n} deleted` + (ids.length - n ? `, ${ids.length - n} skipped (only AVAILABLE stock can be deleted; use Void for the others)` : '') });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/stock/verify/:awb - is this AWB in our stock, and its status
router.get('/verify/:awb', async (req, res) => {
    const no = pureAwb(req.params.awb);
    const problem = awbProblem(no);
    if (problem) return bad(res, problem);
    try {
        const row = await AwbStock.findOne({ where: { fullAwbNumber: no } });
        if (!row) return res.status(404).json({ success: false, error: 'This AWB is not in the stock' });
        res.json({ success: true, data: row });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/stock/return { awbNumber, action: 'UNUSED'|'VOID' }
//  UNUSED: ALLOCATED -> AVAILABLE (number can be used again); VOID: AVAILABLE / ALLOCATED -> VOID
router.post('/return', async (req, res) => {
    const no = pureAwb(req.body.awbNumber);
    const problem = awbProblem(no);
    if (problem) return bad(res, problem);
    const action = String(req.body.action || '').toUpperCase();
    if (!['UNUSED', 'VOID'].includes(action)) return bad(res, 'Action must be UNUSED or VOID');
    try {
        const row = await AwbStock.findOne({ where: { fullAwbNumber: no } });
        if (!row) return res.status(404).json({ success: false, error: 'This AWB is not in the stock' });
        if (row.status === 'USED') return bad(res, 'This AWB is already used on a saved AirWayBill - cancel that AWB first');
        if (row.status === 'VOID') return bad(res, 'This AWB is already VOID');
        if (action === 'UNUSED' && row.status === 'AVAILABLE') return bad(res, 'This AWB is already AVAILABLE');
        await row.update({ status: action === 'VOID' ? 'VOID' : 'AVAILABLE' });
        res.json({ success: true, data: row, message: `AWB ${no} is now ${row.status}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
