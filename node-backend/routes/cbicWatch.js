// Customs and trade updates by e-mail (utils/cbicCustomsWatch.js) - 17-Nov-2026: CBIC, ICEGATE, DGFT, own pages.
// Mounted at /api/settings/cbic-watch, so the "Settings" rights apply (view free, saving needs edit).
//   GET  /         status: recipients, on / off, last check, newest on the portal
//   GET  /latest   the newest customs entries on the CBIC portal now
//   POST /         { to, on, off: [source ids switched off], pages: "Name | https://..." per line }  save
//   POST /check    check the portal now (mails anything new)
//   POST /test     a test mail with the newest entry and its PDF ({ source: 'cbic_exrate' }: the newest exchange rates)
const express = require('express');
const W = require('../utils/cbicCustomsWatch');
const router = express.Router();
const who = (req) => (req.user && (req.user.username || req.user.email)) || 'user';

router.get('/', async (req, res) => {
  try { res.json({ success: true, ...(await W.status()) }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.get('/latest', async (req, res) => {
  try { res.json({ success: true, items: await W.latest() }); } catch (e) { res.status(502).json({ success: false, error: e.message }); }
});
router.post('/', async (req, res) => {
  try {
    const b = req.body || {}; const set = {};
    if (b.to !== undefined) {
      const parts = String(b.to || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
      const bad = parts.filter(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
      if (bad.length) return res.status(400).json({ success: false, error: 'Not an e-mail id: ' + bad.join(', ') });
      if (!parts.length) return res.status(400).json({ success: false, error: 'Enter at least one e-mail id' });
      set[W.K.to] = parts.join(', ');
    }
    if (b.on !== undefined) set[W.K.on] = b.on ? '1' : '0';
    if (b.off !== undefined) {
      if (!Array.isArray(b.off)) return res.status(400).json({ success: false, error: 'off must be a list' });
      set[W.K.off] = JSON.stringify(b.off.map(String).filter(x => /^[a-z_]+$|^page:[0-9a-f]{10}$/.test(x)).slice(0, 50));
    }
    if (b.pages !== undefined) {
      const lines = String(b.pages || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 20) return res.status(400).json({ success: false, error: 'At most 20 pages' });
      const bad = lines.filter(l => !/^(.*\|\s*)?https?:\/\/[^\s|]+$/i.test(l));
      if (bad.length) return res.status(400).json({ success: false, error: 'Not a page address (http:// or https://): ' + bad[0].slice(0, 80) });
      set[W.K.pages] = lines.join('\n');
    }
    await require('../utils/settingsStore').setMany(set);
    res.json({ success: true, ...(await W.status()) });
  } catch (e) { res.status(e.status || 500).json({ success: false, error: e.message }); }
});
router.post('/check', async (req, res) => {
  try { const r = await W.checkNow({ by: who(req) }); res.json({ success: !r.error && !r.busy, ...r }); } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.post('/test', async (req, res) => {
  try { res.json({ success: true, ...(await W.sendTest((req.body || {}).source === 'cbic_exrate' ? 'cbic_exrate' : undefined)) }); } catch (e) { res.status(e.status || 502).json({ success: false, error: e.message }); }
});
module.exports = router;
