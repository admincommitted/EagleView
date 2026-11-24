const express = require('express');
const router = express.Router();
const InventoryGroup = require('../models/InventoryGroup');
const InventoryCategory = require('../models/InventoryCategory');
const UnitOfMeasure = require('../models/UnitOfMeasure');
const Godown = require('../models/Godown');
const StockItem = require('../models/StockItem');

// Helper to build tree
const buildTree = (items, parentId = null) => {
    return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
            ...item.dataValues,
            children: buildTree(items, item.id)
        }));
};

// GET all masters
router.get('/all', async (req, res) => {
    try {
        const groups = await InventoryGroup.findAll();
        const categories = await InventoryCategory.findAll();
        const uoms = await UnitOfMeasure.findAll();
        const godowns = await Godown.findAll();
        const items = await StockItem.findAll();

        res.json({
            success: true,
            data: {
                groupsTree: buildTree(groups),
                groupsFlat: groups,
                categoriesTree: buildTree(categories),
                categoriesFlat: categories,
                uoms: uoms,
                godownsTree: buildTree(godowns),
                godownsFlat: godowns,
                items: items
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST endpoints
router.post('/groups', async (req, res) => {
    try {
        const doc = await InventoryGroup.create(req.body);
        res.json({ success: true, data: doc });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/categories', async (req, res) => {
    try {
        const doc = await InventoryCategory.create(req.body);
        res.json({ success: true, data: doc });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/uoms', async (req, res) => {
    try {
        const doc = await UnitOfMeasure.create(req.body);
        res.json({ success: true, data: doc });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/godowns', async (req, res) => {
    try {
        const doc = await Godown.create(req.body);
        res.json({ success: true, data: doc });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/items', async (req, res) => {
    try {
        const doc = await StockItem.create(req.body);
        res.json({ success: true, data: doc });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
