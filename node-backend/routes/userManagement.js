const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../models/User');
const UserPermission = require('../models/UserPermission');
const { requireAdmin } = require('../middleware/auth');
const { GROUPS, LEGACY, normalizePermissions } = require('../utils/moduleCatalog');
const { clearPermCache } = require('../middleware/permissions');

// Module list for the permission grid (every logged-in user may read it) - 30-Oct-2026
router.get('/modules', (req, res) => {
  res.json({ success: true, legacy: LEGACY, groups: GROUPS.map(g => ({ name: g.name, modules: g.modules.map(m => ({ key: m.key, label: m.label, routes: m.routes, forms: (m.forms || []).map(f => ({ key: f.key, label: f.label, routes: f.routes })) })) })) });
});

// The caller's own rights (null = no restrictions set) - used after login / on page load
router.get('/my-permissions', async (req, res) => {
  try {
    const rows = await UserPermission.findAll({ where: { userId: req.user.id } });
    res.json({ success: true, role: req.user.role, permissions: rows.length ? normalizePermissions(rows.map(r => r.toJSON())) : null });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Only known modules are stored; legacy names are mapped; one row per module.
// A user saved from the permission grid with nothing ticked gets one marker row, so "no rows" (= legacy, unrestricted)
// only applies to users that were never saved from this screen.
const RESTRICTED_MARKER = '__restricted__';
const cleanPermissions = (list) => {
  const rows = normalizePermissions((Array.isArray(list) ? list : []).map(p => ({ ...p })));
  return rows.length ? rows : [{ moduleName: RESTRICTED_MARKER, canView: false, canCreate: false, canEdit: false, canDelete: false }];
};

// Security fix (22-Oct-2026): password hashes are never sent to the browser,
// and only admins can create or change users.
const safeUser = (u) => {
  const obj = u && u.toJSON ? u.toJSON() : { ...u };
  delete obj.password;
  return obj;
};
// Fields a request may never set directly on a User row.
const stripProtected = (data) => { delete data.id; delete data.createdAt; delete data.updatedAt; delete data.resetTokenHash; delete data.resetTokenExpires; return data; };
const STATUSES = ['active', 'inactive', 'locked'];
// 16-Nov-2026: 'director' = PO approver (approves / rejects / holds purchase orders); 'operator' is the old default
const ROLES = ['admin', 'director', 'user', 'operator'];
const checkUser = (d, isNew) => {
  if (d.role !== undefined && d.role !== null && d.role !== '') { d.role = String(d.role).toLowerCase(); if (!ROLES.includes(d.role)) return 'Role must be admin, director or user'; }
  if (d.password !== undefined && d.password !== '' && String(d.password).length < 8) return 'Password must be at least 8 characters';
  if (isNew && !d.password) return 'Password is required for a new user';
  if (d.status !== undefined && !STATUSES.includes(d.status)) return 'Status must be active, inactive or locked';
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return 'Email is not valid';
  if (d.password === '') delete d.password;
  return null;
};

// GET all users with their permissions - admin only; reset-link fields never sent (28-Oct-2026)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password', 'resetTokenHash', 'resetTokenExpires'] },
      include: [{ model: UserPermission, as: 'permissions' }],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new user
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { permissions, ...userData } = req.body;
    stripProtected(userData);
    const bad = checkUser(userData, true);
    if (bad) return res.status(400).json({ error: bad });
    
    // Check if username exists
    const existing = await User.findOne({ where: { username: userData.username } });
    if (existing) {
      return res.status(400).json({ error: `User ID "${userData.username}" already exists. Please choose a different User ID.` });
    }

    if (userData.password) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
    }
    const newUser = await User.create(userData);
    
    if (permissions && Array.isArray(permissions)) {
      const permsToInsert = cleanPermissions(permissions).map(p => ({ ...p, userId: newUser.id }));
      await UserPermission.bulkCreate(permsToInsert);
    }

    res.status(201).json(safeUser(newUser));
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update user
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, ...userData } = req.body;
    stripProtected(userData);
    const bad = checkUser(userData, false);
    if (bad) return res.status(400).json({ error: bad });
    if (String(id) === String(req.user.id) && userData.status && userData.status !== 'active') return res.status(400).json({ error: 'You cannot disable or lock your own account' });
    if (String(id) === String(req.user.id) && userData.role && String(userData.role).toLowerCase() !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin rights' });
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Duplicate User ID check — skip if username not being changed
    if (userData.username && userData.username !== user.username) {
      const { Op } = require('sequelize');
      const duplicate = await User.findOne({
        where: {
          username: userData.username,
          id: { [Op.ne]: parseInt(id) } // exclude current user
        }
      });
      if (duplicate) {
        return res.status(400).json({ error: `User ID "${userData.username}" already exists. Please choose a different User ID.` });
      }
    }

    if (userData.password) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
    }
    await user.update(userData);
    if (userData.status !== undefined) { try { require('../middleware/auth').clearUserStatus(user.id); } catch (e) { /* cache */ } }
    
    if (permissions && Array.isArray(permissions)) {
      // Delete old permissions and insert new ones
      await UserPermission.destroy({ where: { userId: id } });
      const permsToInsert = cleanPermissions(permissions).map(p => ({ ...p, userId: id }));
      await UserPermission.bulkCreate(permsToInsert);
      clearPermCache(id);
    }

    res.json(safeUser(user));
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
