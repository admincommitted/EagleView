// Status Master (MDM → Status Master, Timeline drawer). Added 28-Oct-2026.
const express = require('express');
const StatusMaster = require('../models/StatusMaster');
const router = express.Router();

const FIELDS = ['description', 'macroBucket', 'colorCode', 'textColor', 'module', 'sequence', 'disables', 'enables', 'bubbleStyle'];

router.get('/', async (req, res) => {
    try {
        const where = req.query.module ? { module: req.query.module } : {};
        res.json({ success: true, data: await StatusMaster.findAll({ where, order: [['module', 'ASC'], ['sequence', 'ASC'], ['code', 'ASC']] }) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST creates or updates by code. 28-Oct-2026: with { mode: 'create' } an existing code is refused (409) instead of
// being overwritten silently; code format checked; colours checked
const COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
async function save(req, res, code, mode) {
    try {
        code = String(code || '').trim().toUpperCase();
        if (!/^[A-Z0-9_]{2,40}$/.test(code)) return res.status(400).json({ success: false, message: 'Code: 2-40 letters, digits or _ (e.g. EXAM_SCHEDULED)' });
        const data = { code };
        for (const f of FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];
        data.sequence = parseInt(data.sequence, 10) || 0;
        for (const c of ['colorCode', 'textColor']) if (data[c] && !COLOR.test(String(data[c]))) return res.status(400).json({ success: false, message: `${c} must be a colour like #e2e8f0` });
        const existing = await StatusMaster.findOne({ where: { code } });
        if (existing && mode === 'create') return res.status(409).json({ success: false, message: `Status ${code} already exists - pick it from the list to edit` });
        if (!existing && mode === 'update') return res.status(404).json({ success: false, message: 'Not found' });
        const row = existing ? await existing.update(data) : await StatusMaster.create(data);
        res.json({ success: true, data: row, message: existing ? 'Updated' : 'Created' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
}
router.post('/', (req, res) => save(req, res, req.body && req.body.code, req.body && req.body.mode));
router.put('/:code', (req, res) => save(req, res, req.params.code, 'update'));

router.delete('/:code', async (req, res) => {
    try {
        const n = await StatusMaster.destroy({ where: { code: String(req.params.code).toUpperCase() } });
        if (!n) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
