const express = require('express');
const router = express.Router();
const Port = require('../models/Port');

// GET all ports
router.get('/', async (req, res) => {
    try {
        // 04-Nov-2026: job screens get the active ports only (a port made inactive in the master kept showing in
        // every port box); the Port master screen asks for ?all=1 so it can still show and re-activate them.
        const where = req.query.all ? {} : { isActive: true };
        const ports = await Port.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json(ports);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST a new port
router.post('/', async (req, res) => {
    try {
        const port = await Port.create(req.body);
        res.status(201).json(port);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT (Modify) a port
router.put('/:id', async (req, res) => {
    try {
        await Port.update(req.body, { where: { id: req.params.id } });
        const updated = await Port.findByPk(req.params.id);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE a port
router.delete('/:id', async (req, res) => {
    try {
        await Port.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
