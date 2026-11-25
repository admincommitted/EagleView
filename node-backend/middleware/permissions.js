const {
  moduleForApi,
  normalizePermissions,
  effective,
} = require("../utils/moduleCatalog");

const FREE = ["/api/users/my-permissions", "/api/users/modules"];
// 14-Nov-2026 (security check): a user with no rights saved still may not change these (admin only), and a failed
// check now refuses instead of letting the request through
const ADMIN_WRITE = ["System Settings", "User Management"];
const cache = new Map(); // userId -> { at, perms: {key: {canView..}} | null (null = no rows) }
const TTL = 30000;

async function loadPerms(userId) {
  const c = cache.get(userId);
  if (c && Date.now() - c.at < TTL) return c.perms;
  const UserPermission = require("../models/UserPermission");
  const rows = await UserPermission.findAll({ where: { userId } });
  const perms = rows.length
    ? Object.fromEntries(
        normalizePermissions(rows.map((r) => r.toJSON())).map((p) => [
          p.moduleName,
          p,
        ]),
      )
    : null;
  cache.set(userId, { at: Date.now(), perms });
  return perms;
}
const clearPermCache = (userId) => {
  cache.delete(userId);
  cache.delete(Number(userId));
  cache.delete(String(userId));
};

const actionFor = (method) => {
  const m = String(method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return "view";
  if (m === "POST") return "create";
  if (m === "PUT" || m === "PATCH") return "edit";
  if (m === "DELETE") return "delete";
  return "view";
};

function allowed(perms, moduleKey, action, readFree) {
  if (action === "view" && readFree) return true;
  const p = effective(perms, moduleKey); // module row OR any of its forms' rows
  if (!p) return false;
  if (action === "view") return !!p.canView;
  if (action === "create") return !!(p.canCreate || p.canEdit);
  if (action === "edit") return !!p.canEdit;
  if (action === "delete") return !!p.canDelete;
  return false;
}

const permissionMiddleware = async (req, res, next) => {
  try {
    if (req.method === "OPTIONS") return next();
    const user = req.user || {};
    if (String(user.role || "").toLowerCase() === "admin") return next();
    const path = (req.originalUrl || req.url || "").split("?")[0];
    if (FREE.some((f) => path === f || path.startsWith(f + "/"))) return next();
    // 16-Nov-2026: a Director (PO approver) may always read the POs and approve / reject / hold them, whatever the grid
    // says (routes/poRoutes.js checks the role again on the approval itself)
    if (
      String(user.role || "").toLowerCase() === "director" &&
      ((req.method === "GET" && /^\/api\/po(\/\d+)?\/?$/.test(path)) ||
        (req.method === "PUT" && /^\/api\/po\/\d+\/action\/?$/.test(path)))
    )
      return next();
    const hit = moduleForApi(path);
    if (!hit) return next();
    const perms = await loadPerms(user.id);
    const action = actionFor(req.method);
    if (!perms) {
      // no rights configured yet -> unrestricted (legacy), except changes in the admin modules
      if (action !== "view" && ADMIN_WRITE.includes(hit.key))
        return res
          .status(403)
          .json({
            success: false,
            error: `Only an admin can change ${hit.key}.`,
            module: hit.key,
            action,
          });
      return next();
    }
    if (allowed(perms, hit.key, action, hit.readFree)) return next();
    return res
      .status(403)
      .json({
        success: false,
        error: `No permission: ${hit.key} (${action}). Ask the admin to grant it in User Management.`,
        module: hit.key,
        action,
      });
  } catch (e) {
    console.warn("[Permissions] check failed, refusing:", e.message);
    res
      .status(503)
      .json({
        success: false,
        error: "Could not check your rights just now - try again.",
      });
  }
};

module.exports = permissionMiddleware;
module.exports.clearPermCache = clearPermCache;
module.exports.loadPerms = loadPerms;
