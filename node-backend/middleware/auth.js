require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const jwt = require("jsonwebtoken");
const revoke = require("../utils/tokenRevoke");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error(
    "[Auth] JWT_SECRET is missing or too short in node-backend/.env. Server will not start without it.",
  );
}

const authMiddleware = (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const authHeader = req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) {
    return res.status(401).json({ error: "Access denied. Please log in." });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.log("[Auth] JWT rejected:", err.message);
    return res
      .status(401)
      .json({ error: "Session expired. Please log in again." });
  }
  // 28-Oct-2026: a user disabled / locked in User Management was still let in until the token expired
  // 14-Nov-2026: a token given up with Logout stops at once (utils/tokenRevoke.js; waits for its list after a restart)
  revoke
    .load()
    .then(() => {
      if (revoke.isRevoked(req.user)) {
        res.status(401).json({ error: "Logged out. Please log in again." });
        return null;
      }
      return userStatus(req.user && req.user.id);
    })
    .then((st) => {
      if (st === null && res.headersSent) return;
      if (st === "missing")
        return res
          .status(401)
          .json({ error: "Account not found. Please log in again." });
      if (st === "inactive" || st === "locked")
        return res
          .status(403)
          .json({ error: `Account is ${st}. Please contact admin.` });
      next();
    })
    .catch(() => next());
};
const statusCache = new Map(); // userId -> { st, at }
async function userStatus(id) {
  if (!id) return null;
  const c = statusCache.get(id);
  if (c && Date.now() - c.at < 30000) return c.st;
  const u = await User.findByPk(id, { attributes: ["status"] });
  const st = u ? String(u.status || "active").toLowerCase() : "missing";
  statusCache.set(id, { st, at: Date.now() });
  return st;
}
const clearUserStatus = (id) =>
  statusCache.delete(id) ||
  statusCache.delete(Number(id)) ||
  statusCache.delete(String(id));

// Allows only admin users through. Use after authMiddleware.
const requireAdmin = (req, res, next) => {
  const role = String((req.user && req.user.role) || "").toLowerCase();
  if (role !== "admin") {
    return res
      .status(403)
      .json({ error: "Only admins can perform this action." });
  }
  next();
};

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.JWT_SECRET = JWT_SECRET;
module.exports.clearUserStatus = clearUserStatus;
