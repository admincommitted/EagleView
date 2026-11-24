const express = require('express');
const router = express.Router();
const Drawback = require('../models/Drawback');

router.post('/drawback', async (req, res) => {
    try {
        const { fob, qty, tariffItem } = req.body;
        if (!tariffItem) return res.status(400).json({ error: 'tariffItem is required' });

        const drawback = await Drawback.findOne({ where: { schemeCode: tariffItem } }) || await Drawback.findOne({ where: { tariffItem } });
        if (!drawback) {
            return res.json({
                success: false,
                message: 'Drawback not found',
                dbkRtAdv: 0,
                dbkRtSpe: 0,
                dbkVal: 0
            });
        }

        // same rule as the Scheme > Dbk screen (29-Oct-2026): % of FOB limited by cap x qty, or the specific rate x qty
        // when there is no % rate. dbkRtSpe is the specific rate (the cap was returned in it before; cap is dbkCap).
        const rate = parseFloat(drawback.drawbackRate) || 0;
        const spec = parseFloat(drawback.drawbackRateSpec) || 0;
        const cap = parseFloat(drawback.drawbackCap) || 0;
        const fobVal = parseFloat(fob) || 0;
        const quantity = parseFloat(qty) || 0;

        let dbkVal = 0;
        if (rate > 0) {
            dbkVal = fobVal * (rate / 100);
            if (cap > 0 && quantity > 0) dbkVal = Math.min(dbkVal, cap * quantity);
        } else if (spec > 0) {
            dbkVal = spec * quantity;
        }

        res.json({
            success: true,
            dbkRtAdv: rate,
            dbkRtSpe: spec,
            dbkCap: cap,
            uqc: drawback.uqc || '',
            dbkVal: dbkVal.toFixed(2)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
