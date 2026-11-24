// DSR templates (Settings → DSR Template Master). Added 28-Oct-2026.
const express = require('express');
const DsrTemplate = require('../models/DsrTemplate');
const router = express.Router();

const toClient = (t) => {
    let cfg = {};
    try { cfg = JSON.parse(t.config || '{}') || {}; } catch (e) { cfg = {}; }
    return { ...cfg, id: t.id, name: t.name, module: t.module, client: t.client, clientRole: t.clientRole, createdAt: t.createdAt, updatedAt: t.updatedAt };
};

router.get('/', async (req, res) => {
    try { res.json({ success: true, data: (await DsrTemplate.findAll({ order: [['id', 'ASC']] })).map(toClient) }); }
    catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST saves one template: numeric id = update, temporary id ('new_...') or none = create
router.post('/', async (req, res) => {
    try {
        const { id, name, module, client, clientRole, createdAt, updatedAt, ...rest } = req.body || {};
        if (!name || !String(name).trim()) return res.status(400).json({ success: false, message: 'Template name is required' });
        const data = { name: String(name).trim(), module: module || 'IMPORT', client: client || 'ALL', clientRole: clientRole || null, config: JSON.stringify(rest) };
        const existing = /^\d+$/.test(String(id || '')) ? await DsrTemplate.findByPk(id) : null;
        const row = existing ? await existing.update(data) : await DsrTemplate.create(data);
        res.json({ success: true, message: existing ? 'Template updated' : 'Template saved', data: toClient(row) });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const n = await DsrTemplate.destroy({ where: { id: req.params.id } });
        res.status(n ? 200 : 404).json({ success: !!n });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
