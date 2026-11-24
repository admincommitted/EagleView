// Asset Management (pages/AssetManagement.jsx, Dashboard warranty alerts). Added 28-Oct-2026.
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op } = require('sequelize');
const Asset = require('../models/Asset');

const router = express.Router();
const DIR = path.join(__dirname, '..', 'uploads', 'assets');
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => { fs.mkdirSync(DIR, { recursive: true }); cb(null, DIR); },
        filename: (req, file, cb) => cb(null, `asset_${req.params.id}_${Date.now()}${path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '')}`)
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^(image\/|application\/pdf)/.test(file.mimetype || ''))
});
const fileUrl = (f) => (f ? '/uploads/assets/' + f.filename : undefined);
const EDITABLE = ['assetName', 'description', 'status', 'assignedTo', 'assignedDepartment', 'branch', 'category', 'assetTag', 'purchaseValue', 'sourcePurchaseId', 'warrantyExpiryDate'];
const pick = (b) => Object.fromEntries(EDITABLE.filter(k => b[k] !== undefined).map(k => [k, b[k] === '' ? null : b[k]]));

// GET /api/assets  → plain array (the page does setAssets(res.data))
router.get('/', async (req, res) => {
    try { res.json(await Asset.findAll({ order: [['createdAt', 'DESC']] })); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/assets/alerts/expiring?days=30 → warranties expired or expiring within N days
router.get('/alerts/expiring', async (req, res) => {
    try {
        const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
        const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        res.json(await Asset.findAll({
            where: { warrantyExpiryDate: { [Op.ne]: null, [Op.lte]: until }, status: { [Op.ne]: 'DISCARDED' } },
            order: [['warrantyExpiryDate', 'ASC']], limit: 50
        }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const data = pick(req.body || {});
        if (!data.assetName) return res.status(400).json({ error: 'assetName is required' });
        const a = await Asset.create(data);
        if (!a.assetTag) await a.update({ assetTag: 'AST-' + String(a.id).padStart(5, '0') });
        res.status(201).json(a);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        const a = await Asset.findByPk(req.params.id);
        if (!a) return res.status(404).json({ error: 'Asset not found' });
        await a.update(pick(req.body || {}));
        res.json(a);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/discard', upload.single('photo'), async (req, res) => {
    try {
        const a = await Asset.findByPk(req.params.id);
        if (!a) return res.status(404).json({ error: 'Asset not found' });
        if (!req.body || !req.body.reason) return res.status(400).json({ error: 'reason is required' });
        await a.update({ status: 'DISCARDED', discardReason: req.body.reason, discardPhotoUrl: fileUrl(req.file) || a.discardPhotoUrl, assignedTo: null, assignedDepartment: null });
        res.json(a);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

for (const [route, field, col] of [['bill', 'bill', 'billUrl'], ['photo', 'photo', 'photoUrl']]) {
    router.post('/:id/' + route, upload.single(field), async (req, res) => {
        try {
            const a = await Asset.findByPk(req.params.id);
            if (!a) return res.status(404).json({ error: 'Asset not found' });
            if (!req.file) return res.status(400).json({ error: 'Image or PDF file is required' });
            await a.update({ [col]: fileUrl(req.file) });
            res.json(a);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
}

module.exports = router;
