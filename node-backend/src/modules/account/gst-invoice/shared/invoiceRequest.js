import { handleRoute } from '../../shared/routeHandler.js';

/** Who saved / changed the invoice: the logged-in user, else the X-User-Name header the screen sends. */
export const invoiceUserName = (req) =>
  (req.user && (req.user.fullName || req.user.name || req.user.username)) || req.headers['x-user-name'] || '';

/** Errors answer their own status (400 for the invoice checks, 404 not found), else 500 - always { error }. */
export const withErrorStatus = (controller) => handleRoute(controller, { useErrorStatus: true });

/** Read-only screens: any failure answers 500 { error }. */
export const withServerError = (controller) => handleRoute(controller);
