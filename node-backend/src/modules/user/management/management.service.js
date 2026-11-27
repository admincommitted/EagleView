import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { User, UserPermission } from '../../../models/index.js';
import { GROUPS, LEGACY, normalizePermissions } from '../../../utils/common/moduleCatalog.js';
import { clearUserStatus } from '../../../middlewares/auth.middleware.js';
import { clearPermCache } from '../../../middlewares/permissions.middleware.js';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';

const BCRYPT_ROUNDS = 10;
// A user saved from the permission grid with nothing ticked gets one marker row, so "no rows" (= legacy, unrestricted)
// only applies to users that were never saved from this screen.
const RESTRICTED_MARKER = '__restricted__';
const PROTECTED_FIELDS = ['id', 'createdAt', 'updatedAt', 'resetTokenHash', 'resetTokenExpires'];
const HIDDEN_FIELDS = ['password', 'resetTokenHash', 'resetTokenExpires'];

const errorWith = (ErrorClass, message) => new ErrorClass(message, { body: { error: message } });
const duplicateUserIdMessage = (username) => `User ID "${username}" already exists. Please choose a different User ID.`;

/** Module list for the permission grid (every logged-in user may read it). */
export function listModules() {
  const formsOf = (moduleEntry) =>
    (moduleEntry.forms || []).map((form) => ({ key: form.key, label: form.label, routes: form.routes }));
  return {
    success: true,
    legacy: LEGACY,
    groups: GROUPS.map((group) => ({
      name: group.name,
      modules: group.modules.map((moduleEntry) => ({
        key: moduleEntry.key,
        label: moduleEntry.label,
        routes: moduleEntry.routes,
        forms: formsOf(moduleEntry),
      })),
    })),
  };
}

/** The caller's own rights (null = no restrictions set). */
export async function myPermissions(tokenUser) {
  const rows = await UserPermission.findAll({ where: { userId: tokenUser.id } });
  return {
    success: true,
    role: tokenUser.role,
    permissions: rows.length ? normalizePermissions(rows.map((row) => row.toJSON())) : null,
  };
}

/** Only known modules are stored; legacy names are mapped; one row per module. */
function permissionRowsFor(userId, permissions) {
  const rows = normalizePermissions(
    (Array.isArray(permissions) ? permissions : []).map((permission) => ({ ...permission })),
  );
  const stored = rows.length
    ? rows
    : [{ moduleName: RESTRICTED_MARKER, canView: false, canCreate: false, canEdit: false, canDelete: false }];
  return stored.map((permission) => ({ ...permission, userId }));
}

/** Password hashes are never sent to the browser. */
function safeUser(user) {
  const plain = user && user.toJSON ? user.toJSON() : { ...user };
  delete plain.password;
  return plain;
}

/** Splits the body into the user fields a request may set and the permission list. */
function splitUserBody(body) {
  const { permissions, ...userData } = body;
  for (const field of PROTECTED_FIELDS) delete userData[field];
  return { permissions, userData };
}

const hashPassword = async (password) => bcrypt.hash(password, await bcrypt.genSalt(BCRYPT_ROUNDS));

export function listUsers() {
  return User.findAll({
    attributes: { exclude: HIDDEN_FIELDS },
    include: [{ model: UserPermission, as: 'permissions' }],
    order: [['createdAt', 'DESC']],
  });
}

export async function createUser(body) {
  const { permissions, userData } = splitUserBody(body);
  const existing = await User.findOne({ where: { username: userData.username } });
  if (existing) throw errorWith(BadRequestError, duplicateUserIdMessage(userData.username));

  if (userData.password) userData.password = await hashPassword(userData.password);
  const newUser = await User.create(userData);
  if (permissions && Array.isArray(permissions))
    await UserPermission.bulkCreate(permissionRowsFor(newUser.id, permissions));
  return safeUser(newUser);
}

/** An admin cannot lock himself out or take away his own admin rights. */
function checkNotLockingOutSelf(id, actorId, userData) {
  if (String(id) !== String(actorId)) return;
  if (userData.status && userData.status !== 'active') {
    throw errorWith(BadRequestError, 'You cannot disable or lock your own account');
  }
  if (userData.role && String(userData.role).toLowerCase() !== 'admin') {
    throw errorWith(BadRequestError, 'You cannot remove your own admin rights');
  }
}

async function checkUserIdFree(id, user, username) {
  if (!username || username === user.username) return;
  const duplicate = await User.findOne({ where: { username, id: { [Op.ne]: parseInt(id) } } });
  if (duplicate) throw errorWith(BadRequestError, duplicateUserIdMessage(username));
}

async function replacePermissions(id, permissions) {
  await UserPermission.destroy({ where: { userId: id } });
  await UserPermission.bulkCreate(permissionRowsFor(id, permissions));
  clearPermCache(id);
}

export async function updateUser(id, body, actorId) {
  const { permissions, userData } = splitUserBody(body);
  checkNotLockingOutSelf(id, actorId, userData);

  const user = await User.findByPk(id);
  if (!user) throw errorWith(NotFoundError, 'User not found');
  await checkUserIdFree(id, user, userData.username);

  if (userData.password) userData.password = await hashPassword(userData.password);
  await user.update(userData);
  if (userData.status !== undefined) {
    try {
      clearUserStatus(user.id);
    } catch {
      // only a cache
    }
  }
  if (permissions && Array.isArray(permissions)) await replacePermissions(id, permissions);
  return safeUser(user);
}
