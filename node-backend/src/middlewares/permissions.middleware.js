import { UserPermission } from '../models/index.js';
import { effective, moduleForApi, normalizePermissions } from '../utils/common/moduleCatalog.js';

const ALWAYS_ALLOWED_PATHS = ['/api/users/my-permissions', '/api/users/modules'];
// a user with no rights saved may still not change these: admin only
const ADMIN_WRITE_MODULES = ['System Settings', 'User Management'];
const PERMISSION_CACHE_TTL_MS = 30000;

// A Director (PO approver) may always read the POs and approve / reject / hold them, whatever the grid says
// (the PO approval route checks the role again on the approval itself)
const DIRECTOR_PO_READ = /^\/api\/po(\/\d+)?\/?$/;
const DIRECTOR_PO_ACTION = /^\/api\/po\/\d+\/action\/?$/;

const permissionCache = new Map(); // userId -> { checkedAt, perms: { moduleName: row } | null (null = no rows) }

/** The user's module rights keyed by module name, or null when none are saved (= unrestricted, legacy). */
export async function loadPerms(userId) {
  const cached = permissionCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < PERMISSION_CACHE_TTL_MS) return cached.perms;
  const rows = await UserPermission.findAll({ where: { userId } });
  const perms = rows.length
    ? Object.fromEntries(normalizePermissions(rows.map((row) => row.toJSON())).map((perm) => [perm.moduleName, perm]))
    : null;
  permissionCache.set(userId, { checkedAt: Date.now(), perms });
  return perms;
}

export function clearPermCache(userId) {
  permissionCache.delete(userId);
  permissionCache.delete(Number(userId));
  permissionCache.delete(String(userId));
}

function actionForMethod(method) {
  const verb = String(method || 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return 'view';
  if (verb === 'POST') return 'create';
  if (verb === 'PUT' || verb === 'PATCH') return 'edit';
  if (verb === 'DELETE') return 'delete';
  return 'view';
}

function isAllowed(perms, moduleKey, action, readFree) {
  if (action === 'view' && readFree) return true;
  const perm = effective(perms, moduleKey); // module row OR any of its forms' rows
  if (!perm) return false;
  if (action === 'view') return !!perm.canView;
  if (action === 'create') return !!(perm.canCreate || perm.canEdit);
  if (action === 'edit') return !!perm.canEdit;
  if (action === 'delete') return !!perm.canDelete;
  return false;
}

const roleOf = (user) => String(user.role || '').toLowerCase();

const isAlwaysAllowedPath = (path) => ALWAYS_ALLOWED_PATHS.some((free) => path === free || path.startsWith(`${free}/`));

const isDirectorPoCall = (user, method, path) =>
  roleOf(user) === 'director' &&
  ((method === 'GET' && DIRECTOR_PO_READ.test(path)) || (method === 'PUT' && DIRECTOR_PO_ACTION.test(path)));

const refusal = (moduleKey, action, error) => ({ success: false, error, module: moduleKey, action });

/** Module-wise rights from User Management, checked on every /api call after the login. */
export async function checkModulePermissions(req, res, next) {
  try {
    if (req.method === 'OPTIONS') return next();
    const user = req.user || {};
    if (roleOf(user) === 'admin') return next();
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (isAlwaysAllowedPath(path)) return next();
    if (isDirectorPoCall(user, req.method, path)) return next();

    const hit = moduleForApi(path);
    if (!hit) return next();
    const perms = await loadPerms(user.id);
    const action = actionForMethod(req.method);

    if (!perms) {
      if (action !== 'view' && ADMIN_WRITE_MODULES.includes(hit.key)) {
        return res.status(403).json(refusal(hit.key, action, `Only an admin can change ${hit.key}.`));
      }
      return next();
    }
    if (isAllowed(perms, hit.key, action, hit.readFree)) return next();
    return res
      .status(403)
      .json(
        refusal(
          hit.key,
          action,
          `No permission: ${hit.key} (${action}). Ask the admin to grant it in User Management.`,
        ),
      );
  } catch (error) {
    // a failed check refuses instead of letting the request through
    console.warn('[Permissions] check failed, refusing:', error.message);
    return res.status(503).json({ success: false, error: 'Could not check your rights just now - try again.' });
  }
}

export default checkModulePermissions;
