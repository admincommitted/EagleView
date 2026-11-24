// /api/user-prefs/:key - the logged-in user's own preferences (28-Oct-2026). A user reads / writes only own rows.
const express = require('express');
const UserPreference = require('../models/UserPreference');

const router = express.Router();
const KEY = /^[a-z0-9_.-]{1,60}$/i;
const MAX = 10000; // characters of JSON
let synced = null;
const ready = () => (synced = synced || UserPreference.sync().catch(e => { synced = null; throw e; }));
const uid = (req) => Number(req.user && req.user.id);

router.get('/:key', async (req, res) => {
    try {
        if (!KEY.test(req.params.key)) return res.status(400).json({ success: false, error: 'Bad key' });
        if (!uid(req)) return res.status(401).json({ success: false, error: 'Not logged in' });
        await ready();
        const row = await UserPreference.findOne({ where: { userId: uid(req), prefKey: req.params.key } });
        let value = null;
        if (row && row.value != null) { try { value = JSON.parse(row.value); } catch (e) { value = null; } }
        res.json({ success: true, key: req.params.key, value, saved: !!row });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT { value }
router.put('/:key', async (req, res) => {
    try {
        if (!KEY.test(req.params.key)) return res.status(400).json({ success: false, error: 'Bad key' });
        if (!uid(req)) return res.status(401).json({ success: false, error: 'Not logged in' });
        const text = JSON.stringify(req.body && 'value' in req.body ? req.body.value : null);
        if (text.length > MAX) return res.status(413).json({ success: false, error: 'Preference too large' });
        await ready();
        const where = { userId: uid(req), prefKey: req.params.key };
        const [row, created] = await UserPreference.findOrCreate({ where, defaults: { ...where, value: text } });
        if (!created) await row.update({ value: text });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
