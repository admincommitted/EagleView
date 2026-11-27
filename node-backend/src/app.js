import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { BACKEND_ROOT, PUBLIC_DIR, UPLOADS_DIR } from './config/env.js';
import { applyDatabaseSettings, sequelize } from './config/database.js';
import './models/index.js';
import { prepareDatabase } from './jobs/prepareDatabase.js';
import { initPurchaseOrderTables } from './modules/purchase/po/po.service.js';
import { initShipmentTables } from './modules/freight/shipments/shipments.tables.js';
import { initGstInvoiceTables } from './modules/account/gst-invoice/gstInvoice.service.js';
import { initAccountsHubTables } from './modules/account/hub/hub.service.js';
import { authenticate, uploadsAuth } from './middlewares/auth.middleware.js';
import { checkModulePermissions } from './middlewares/permissions.middleware.js';
import { me as branchScopeOfUser, middleware as branchScope } from './middlewares/branchScope.middleware.js';
import {
  corsOptions,
  officeOnlyLimiter,
  scrubInternalErrors,
  securityHeaders,
  trustProxySetting,
} from './middlewares/security.middleware.js';
import { apiNotFound, errorHandler } from './middlewares/errorHandler.middleware.js';
import { findMoved as findMovedEsanchitFile } from './utils/customs/esanchitArchive.js';
import authRoutes from './modules/auth/auth.routes.js';
import fieldTrackingRoutes from './modules/field-tracking/fieldTracking.routes.js';
import { publicActionHandler as poPublicAction } from './modules/purchase/po/po.controller.js';
import { publicKycAction } from './modules/master/party/party.controller.js';
import { createProtectedApiRouter } from './routes.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const SMALL_BODY_LIMIT = '1mb';
const LARGE_BODY_LIMIT = '50mb';
const FIELD_APP_DIR = path.join(BACKEND_ROOT, 'field-app-src');

// the calls that work before login, and the routes that hold the branch / financial-year scoped data
const PUBLIC_API_PATHS = ['/api/auth', '/api/field-tracking', '/api/po', '/api/kyc-action'];
const BRANCH_SCOPED_PATHS = [
  '/api/accounts-hub',
  '/api/vouchers',
  '/api/accounts',
  '/api/credit-control',
  '/api/invoices',
  '/api/reports',
];

// an uploaded page / picture that can carry script is downloaded, never opened inside EagleView (it could read the token)
const ACTIVE_FILE = /\.(html?|xhtml|svgz?|xml|xsl|js|mjs)$/i;

const bodyParsers = (limit) => [express.json({ limit }), express.urlencoded({ limit, extended: true })];

function useSecurity(app) {
  app.set('trust proxy', trustProxySetting());
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(cors(corsOptions));
  app.use(
    '/api/auth/login',
    officeOnlyLimiter('login', 30, FIFTEEN_MINUTES_MS, 'Too many login attempts from this address. Wait 15 minutes.'),
  );
  app.use(
    ['/api/auth/forgot-password', '/api/auth/reset-password'],
    officeOnlyLimiter('reset', 10, FIFTEEN_MINUTES_MS, 'Too many password reset requests. Wait 15 minutes.'),
  );
  app.use(['/api/auth', '/api/field-tracking'], officeOnlyLimiter('public', 300, ONE_MINUTE_MS));
  app.use(PUBLIC_API_PATHS, ...bodyParsers(SMALL_BODY_LIMIT));
}

function useUploads(app) {
  app.use(
    '/uploads',
    uploadsAuth,
    express.static(UPLOADS_DIR, {
      setHeaders: (res, filePath) => {
        if (!ACTIVE_FILE.test(filePath)) return;
        res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
        res.setHeader('Content-Disposition', 'attachment');
      },
    }),
  );
  // an e-Sanchit PDF moved into its job's folder when the job was saved still opens from its first link
  app.get('/uploads/esanchit_archive/:dir/:file', uploadsAuth, (req, res, next) => {
    const movedFile = findMovedEsanchitFile(String(req.params.file || ''));
    return movedFile ? res.sendFile(movedFile) : next();
  });
}

function usePublicApi(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/field-tracking', fieldTrackingRoutes);
  // approval links opened from e-mail / WhatsApp carry their own signature instead of a login
  app.get('/api/po/:id/action', poPublicAction);
  app.get('/api/kyc-action/:docId', publicKycAction);
}

function useProtectedApi(app) {
  app.use('/api', authenticate);
  app.use('/api', ...bodyParsers(LARGE_BODY_LIMIT));
  app.use('/api', scrubInternalErrors);
  app.use('/api', checkModulePermissions);
  app.get('/api/branch-scope/me', branchScopeOfUser);
  app.use(BRANCH_SCOPED_PATHS, branchScope);
  app.use('/api', createProtectedApiRouter());
  app.use('/api', apiNotFound);
  app.use(errorHandler);
}

const noCacheHtml = (res, filePath) => {
  if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
};

function sendFrontendPage(req, res) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: `API not found: ${req.method} ${req.path}. If it was just added, restart the backend.`,
    });
  }
  if (['/uploads', '/socket.io', '/field-app'].some((prefix) => req.path.startsWith(prefix)))
    return res.status(404).end();
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
}

// the built React app (frontend/ "npm run build" writes node-backend/public) and the field staff phone app
function useFrontend(app) {
  if (!fs.existsSync(PUBLIC_DIR)) return;
  app.get('/field-app', (req, res, next) =>
    req.originalUrl.split('?')[0] === '/field-app' ? res.redirect('/field-app/') : next(),
  );
  app.get('/field-app/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(FIELD_APP_DIR, 'index.html'));
  });
  app.use('/field-app', express.static(FIELD_APP_DIR, { maxAge: '1h' }));
  app.use(express.static(PUBLIC_DIR, { setHeaders: noCacheHtml }));
  app.get('/{*splat}', sendFrontendPage);
  console.log('[Production] Serving frontend from:', PUBLIC_DIR);
  console.log('[Field App] PWA available at: /field-app/');
}

/** Opens the database: speed settings, creates missing tables (every model is registered by models/index.js), then
 *  adds missing columns and indexes. */
export async function initializeDatabase() {
  await applyDatabaseSettings();
  initPurchaseOrderTables();
  initShipmentTables();
  initGstInvoiceTables();
  initAccountsHubTables();
  await sequelize.sync();
  console.log('Database synced successfully');
  await prepareDatabase();
}

/** The Express app: security, uploads, public and protected API, then the frontend build. */
export function createApp() {
  const app = express();
  useSecurity(app);
  useUploads(app);
  usePublicApi(app);
  useProtectedApi(app);
  useFrontend(app);
  return app;
}
