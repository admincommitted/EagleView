const ADMIN_ROLE = 'admin';

const isAdminUser = (user) => String((user && user.role) || '').toLowerCase() === ADMIN_ROLE;

/** Lets only an admin through; anyone else gets 403 { error: message } (the master screens show that text). */
export const adminOnly = (message) => (req, res, next) => {
  if (!isAdminUser(req.user)) return res.status(403).json({ error: message });
  return next();
};
