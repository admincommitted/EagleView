const { restartEmailListeners } = require('../services/EmailListener');
const express = require('express');
const router = express.Router();
const IcegateProfile = require('../models/IcegateProfile');
// 14-Nov-2026 (security check): writing settings, keys and connections is for an admin only
const { requireAdmin } = require('../middleware/auth');

// Get all profiles
router.get('/', async (req, res) => {
  try {
    const profiles = await IcegateProfile.findAll({ order: [['createdAt', 'DESC']] });
    // Don't send exact password back to frontend for security
    // 28-Oct-2026: API key and IMAP app password are masked too (they were sent in clear)
    const safeProfiles = profiles.map(p => {
      const data = p.toJSON();
      data.password = '********'; // Masked
      data.apiKeyHint = p.apiKey ? '...' + String(p.apiKey).slice(-4) : '';
      data.apiKey = p.apiKey ? '********' : '';
      data.imapAppPassword = p.imapAppPassword ? '********' : '';
      return data;
    });
    res.json({ success: true, data: safeProfiles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create profile
router.post('/', requireAdmin, async (req, res) => {
  try {
    // If setting this as default, unset others
    if (req.body.isDefault) {
      await IcegateProfile.update({ isDefault: false }, { where: { isDefault: true } });
    }
    const b = { ...req.body }; delete b.id;
    for (const f of ['profileName', 'loginId', 'password', 'apiKey']) if (!String(b[f] || '').trim() || String(b[f]).startsWith('****')) return res.status(400).json({ success: false, error: `${f} is required` });
    ['profileName', 'loginId', 'apiKey', 'baseUrl', 'linkedChaCode', 'imapEmail'].forEach(f => { if (typeof b[f] === 'string') b[f] = b[f].trim(); });
    if (b.imapAppPassword && String(b.imapAppPassword).startsWith('****')) delete b.imapAppPassword;
    if (!(await IcegateProfile.count())) b.isDefault = true; // first profile = default
    const profile = await IcegateProfile.create(b);
    res.json({ success: true, data: { ...profile.toJSON(), password: '********', apiKey: '********', imapAppPassword: profile.imapAppPassword ? '********' : '' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update profile
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const profile = await IcegateProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    // If password comes as ********, it means user didn't change it, so don't update password field
    const updateData = { ...req.body };
    for (const f of ['password', 'apiKey', 'imapAppPassword']) {
      if (!updateData[f] || String(updateData[f]).startsWith('****')) delete updateData[f]; // masked / empty = keep
    }
    delete updateData.id; delete updateData.apiKeyHint;
    if (profile.isDefault && updateData.isDefault === false) return res.status(400).json({ success: false, error: 'Make another profile the default first' });

    if (updateData.isDefault && !profile.isDefault) {
      await IcegateProfile.update({ isDefault: false }, { where: { isDefault: true } });
    }

    await profile.update(updateData);
    res.json({ success: true, data: { ...profile.toJSON(), password: '********', apiKey: '********', imapAppPassword: profile.imapAppPassword ? '********' : '' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete profile
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const profile = await IcegateProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    
    await profile.destroy();
    if (profile.isDefault) { const next = await IcegateProfile.findOne({ order: [['id', 'ASC']] }); if (next) await next.update({ isDefault: true }); }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
