
// --- HIDE CMD WINDOWS FOR PUPPETEER ---
const cp = require('child_process');
const originalSpawn = cp.spawn;
cp.spawn = function(command, args, options) {
    if (!options) options = {};
    options.windowsHide = true;
    return originalSpawn(command, args, options);
};
// --------------------------------------

const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { sequelize } = require('./db');

const authRoutes = require('./routes/auth');
const mastersRoutes = require('./routes/masters');
const awbRoutes = require('./routes/awb');
const reportsRoutes = require('./routes/reports');
const userManagementRoutes = require('./routes/userManagement');
const settingsRouter = require('./routes/settings');
const tactRoutes = require('./routes/tact');
const authMiddleware = require('./middleware/auth');


const Country = require('./models/Country');
const State = require('./models/State');
const City = require('./models/City');

Country.hasMany(State, { foreignKey: 'countryId', as: 'states' });

State.belongsTo(Country, { foreignKey: 'countryId' });

State.hasMany(City, { foreignKey: 'stateId', as: 'cities' });
City.belongsTo(State, { foreignKey: 'stateId' });
City.belongsTo(Country, { foreignKey: 'countryId' });


// Global uncaught exception handler to prevent server crashes from rogue socket/IMAP disconnects
// 30-Oct-2026: a failure to take the port used to be swallowed here, so the window stayed open, "Database synced"
// scrolled past and the server looked started while it was not listening at all - every screen kept talking to
// whatever already held the port. A port that cannot be taken is fatal and says so.
process.on('uncaughtException', (err) => {
  if (err && err.code === 'EADDRINUSE') { portBusy(err.port || PORT); return; }
  console.error('[Global] Uncaught Exception:', err.message || err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Global] Unhandled Rejection:', reason);
});

// What to do when the port is already taken - said once, in words the operator can act on.
function portBusy(port) {
  const p = port || process.env.PORT || 5000;
  console.error('\n' + '='.repeat(72));
  console.error(`  PORT ${p} IS ALREADY IN USE - this server did NOT start.`);
  console.error('  Something else is answering on that port (most likely an older copy of this');
  console.error('  server still running, or the old HRMS backend in the "backend" folder).');
  console.error('');
  console.error('  Find it and close it (PowerShell):');
  console.error(`    Get-Process -Id (Get-NetTCPConnection -LocalPort ${p} -State Listen).OwningProcess`);
  console.error(`    Stop-Process -Id (Get-NetTCPConnection -LocalPort ${p} -State Listen).OwningProcess -Force`);
  console.error('');
  console.error('  Then start this server again. To run it on another port instead:');
  console.error(`    $env:PORT=5001; node server.js`);
  console.error('='.repeat(72) + '\n');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, require('./utils/webSecurity').originAllowed(origin)), // 14-Nov-2026: not every site
    methods: ['GET', 'POST']
  }
});

const notificationsRoutes = require('./routes/notifications');
const whatsappRoutes = require('./routes/whatsapp');

let onlineUsers = {}; // socketId -> userData
let userSockets = {}; // userId -> socketId

app.set('io', io);
app.set('userSockets', userSockets);

// Online users (28-Oct-2026): identity comes from the verified JWT, not from what the browser claims,
// and the list is one entry per user (several tabs of the same user no longer show twice).
function onlineList() {
  const byUser = {};
  for (const u of Object.values(onlineUsers)) {
    const k = String(u.userId);
    if (byUser[k]) byUser[k].sessions++; else byUser[k] = { ...u, sessions: 1 };
  }
  return Object.values(byUser);
}
// 14-Nov-2026: a socket needs a login (office screens: the EagleView token in handshake auth) or a registered phone
// (fieldToken); the old field app (no token) only while "Old field app allowed" is on, and then it hears only siren /
// task messages. Rooms decide who hears what (utils/liveBus.js). Before, anyone could connect and hear the online users'
// names / e-mails and the field staff's live GPS.
const liveBus = require('./utils/liveBus');
const fieldAuth = require('./utils/fieldAuth');
async function staffFromToken(tok) {
  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('./middleware/auth');
  const p = jwt.verify(String(tok || ''), JWT_SECRET);
  if (require('./utils/tokenRevoke').isRevoked(p)) throw new Error('logged out');
  const u = await require('./models/User').findByPk(p.id, { attributes: ['username', 'fullName', 'email', 'status'] });
  if (!u || ['inactive', 'locked'].includes(String(u.status || '').toLowerCase())) throw new Error('account not active');
  return { p, name: u.fullName || u.username || p.username, email: u.email || p.email };
}
io.use(async (socket, next) => {
  try {
    const a = socket.handshake.auth || {};
    if (a.token) {
      try { socket.data.staff = await staffFromToken(a.token); return next(); } catch (e) { return next(new Error('Login expired - please log in again')); }
    }
    if (a.fieldToken) {
      const ag = await fieldAuth.agentForToken(String(a.fieldToken));
      if (!ag) return next(new Error('Phone not registered - register it again with the office code'));
      socket.data.agentId = ag.id; return next();
    }
    if ((await fieldAuth.cfg()).legacy) { socket.data.legacy = true; return next(); }
    return next(new Error('Login required'));
  } catch (e) { return next(new Error('Could not check the login')); }
});
async function joinStaff(socket, st) {
  const { p, name, email } = st;
  for (const r of await liveBus.staffRooms(p)) socket.join(r);
  onlineUsers[socket.id] = { userId: p.id, username: p.username, name, firstName: name, email, role: p.role };
  userSockets[p.id] = socket.id;
  io.to('staff').emit('online_users', onlineList());
}
io.on('connection', (socket) => {
  if (socket.data.staff) joinStaff(socket, socket.data.staff).catch(() => {});
  else if (socket.data.agentId) socket.join('agent:' + socket.data.agentId);
  else if (socket.data.legacy) socket.join('field-legacy');

  // older screens send their token in this event after connecting: the same check
  socket.on('user_connected', async (userData) => {
    try {
      if (onlineUsers[socket.id]) { socket.emit('online_users', onlineList()); return; }
      const st = await staffFromToken(userData && userData.token);
      socket.data.staff = st;
      socket.leave('field-legacy');
      await joinStaff(socket, st);
    } catch (e) { /* bad / expired token: hears nothing */ }
  });

  socket.on('disconnect', () => {
    const userData = onlineUsers[socket.id];
    delete onlineUsers[socket.id];
    if (userData && userSockets[userData.userId] === socket.id) {
      // another tab of the same user still open? keep notifications going to it
      const other = Object.keys(onlineUsers).find(id => String(onlineUsers[id].userId) === String(userData.userId));
      if (other) userSockets[userData.userId] = other; else delete userSockets[userData.userId];
    }
    if (userData) io.to('staff').emit('online_users', onlineList());
  });
});

// 14-Nov-2026 (security check) - for EagleView on the internet (utils/webSecurity.js):
//  - trust proxy: the real client address from a reverse proxy on this PC (TRUST_PROXY in .env for another proxy)
//  - security headers on every answer; CORS only for EagleView's own addresses (was: every web site)
//  - before the login check only small bodies (1 MB); the big ones (50 MB: job JSON, imports) after it
//  - per-IP limits on the login / password-reset calls from outside the office
const webSec = require('./utils/webSecurity');
require('./utils/tokenRevoke').load(); // logged-out tokens: read at start so /uploads and sockets refuse them too
app.set('trust proxy', webSec.trustProxySetting());
app.disable('x-powered-by');
app.use(webSec.headers);
app.use(cors({ origin: (origin, cb) => cb(null, webSec.originAllowed(origin)) }));
const outsideOnly = (mw) => (req, res, next) => (webSec.isOfficeIp(req.ip) ? next() : mw(req, res, next));
app.use('/api/auth/login', outsideOnly(webSec.limiter('login', 30, 15 * 60000, 'Too many login attempts from this address. Wait 15 minutes.')));
app.use(['/api/auth/forgot-password', '/api/auth/reset-password'], outsideOnly(webSec.limiter('reset', 10, 15 * 60000, 'Too many password reset requests. Wait 15 minutes.')));
app.use(['/api/auth', '/api/field-tracking'], outsideOnly(webSec.limiter('public', 300, 60000)));
app.use(['/api/auth', '/api/field-tracking', '/api/po', '/api/kyc-action'], express.json({ limit: '1mb' }), express.urlencoded({ limit: '1mb', extended: true }));

// Register routes

// 30-Oct-2026: /uploads (e-Sanchit PDFs, signed invoices, KYC, licences, final docs) needs a login. Plain links from the
// screens carry no Authorization header, so the token is also accepted from the edi_token cookie (set by the app at
// login) or ?token= (for a link opened in a new tab).
const uploadsAuth = (req, res, next) => {
  const h = req.header('Authorization') || '';
  let tok = h.startsWith('Bearer ') ? h.slice(7).trim() : h.trim();
  if (!tok) { const m = /(?:^|;\s*)edi_token=([^;]+)/.exec(req.headers.cookie || ''); if (m) { try { tok = decodeURIComponent(m[1]); } catch (e) { tok = m[1]; } } }
  // 14-Nov-2026: no ?token= any more (a token in a link ends up in browser history and server logs); logged-out tokens refused
  try {
    const p = require('jsonwebtoken').verify(tok, require('./middleware/auth').JWT_SECRET);
    if (require('./utils/tokenRevoke').isRevoked(p)) throw new Error('logged out');
    return next();
  } catch (e) { return res.status(401).type('text').send('Login required to open this file'); }
};
// 14-Nov-2026: an uploaded page / picture that can carry script (html, svg, xml, js) is downloaded, not opened inside
// EagleView, and runs in a sandbox if a browser shows it anyway (it could have read the login token)
const ACTIVE_FILE = /\.(html?|xhtml|svgz?|xml|xsl|js|mjs)$/i;
app.use('/uploads', uploadsAuth, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (ACTIVE_FILE.test(filePath)) { res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'"); res.setHeader('Content-Disposition', 'attachment'); }
  },
}));
// 14-Nov-2026: a link to an e-Sanchit PDF filed under draft / misc / job-<id> that was moved to the job's own folder when
// the job was saved (utils/esanchitArchive.js) still opens the PDF
app.get('/uploads/esanchit_archive/:dir/:file', uploadsAuth, (req, res, next) => {
  const p = require('./utils/esanchitArchive').findMoved(String(req.params.file || ''));
  return p ? res.sendFile(p) : next();
});
app.use('/api/auth', authRoutes);
app.use('/api/field-tracking', require('./routes/fieldTracking')); // No auth needed
// Field Tracking - NO auth required (field boys ke phones mein JWT token nahi hota)
// â”€â”€ Protect all routes below this line â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PO approval links from e-mail/WhatsApp are opened without login; they carry a signature (see routes/poRoutes.js)
app.get('/api/po/:id/action', require('./routes/poRoutes').publicAction);
app.get('/api/kyc-action/:docId', require('./routes/masters').publicKycAction); // signed KYC approve / reject link from the e-mail (28-Oct-2026)
app.use('/api', authMiddleware);
app.use('/api', express.json({ limit: '50mb' }), express.urlencoded({ limit: '50mb', extended: true })); // logged-in users only
// 14-Nov-2026: a server error (500+) whose text is an internal one (SQL / code / file system) goes to the browser as a
// short message with a reference; the full text stays in the server log under that reference
const INTERNAL_ERR = /SQLITE_|Sequelize|no such (table|column)|syntax error|near "|ECONN|ENOENT|EACCES|EPERM|ETIMEDOUT|Cannot read propert|is not a function|is not defined|of undefined|of null|\.js:\d+|\bat \w+ \(|Unexpected token|\bER_[A-Z]|constraint failed/i;
app.use('/api', (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === 'object') {
      for (const k of ['error', 'message', 'details']) {
        if (typeof body[k] === 'string' && INTERNAL_ERR.test(body[k])) {
          const ref = Date.now().toString(36).toUpperCase();
          console.error(`[API ${ref}] ${req.method} ${req.originalUrl.split('?')[0]} -> ${body[k]}`);
          body = { ...body, [k]: `Server error (ref ${ref}). Please try again; if it repeats, tell the admin this reference.` };
        }
      }
    }
    return json(body);
  };
  next();
});
app.use('/api', require('./middleware/permissions')); // module-wise rights from User Management (30-Oct-2026)
// 06-Nov-2026: branch + financial year from the top bar (X-Branch / X-FY). Accounts data is limited to the branch picked
// (or all of the user's branches for ALL) and a user can never read or change another branch's vouchers - see utils/branchScope.js
{ const bs = require('./utils/branchScope'); app.get('/api/branch-scope/me', bs.me);
  app.use(['/api/accounts-hub', '/api/vouchers', '/api/accounts', '/api/credit-control', '/api/invoices', '/api/reports'], bs.middleware); }
app.use('/api/notifications', notificationsRoutes);
app.use('/api/masters', mastersRoutes);
app.use('/api/calculations', require('./routes/calculations'));
app.use('/api/awb', awbRoutes);
app.use('/api/po', require('./routes/poRoutes')); // Purchase Orders (was never mounted) - 28-Oct-2026
app.use('/api/reports', reportsRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/stock', require('./routes/stock'));
app.use('/api/search', require('./routes/search'));
app.use('/api/penalty-rules', require('./routes/penaltyRules'));
// 14-Nov-2026: /api/test-route removed (a leftover test answer)
app.use('/api/locations', require('./routes/locationMaster'));
app.use('/api/icaffe-parties', require('./routes/icaffeParties')); // 04-Nov-2026: iCAFFE party directory
app.use('/api/accounts-hub', require('./routes/accountsHub')); // 04-Nov-2026: Accounts module (iCAFFE layout) - masters, reports, month closing
app.use('/api/masters/ports', require('./routes/portMaster'));
app.use('/api/settings/cbic-watch', require('./routes/cbicWatch')); // 17-Nov-2026: new CBIC customs notifications by e-mail
app.use('/api/settings', settingsRouter);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/email', require('./routes/email'));
app.use('/api/tact', tactRoutes);
app.use('/api/icegate/signer', require('./routes/signerQueue')); // 16-Nov-2026: EagleView Signer (DSC tool on each PC): what waits to be signed, signed files back
app.use('/api/icegate', require('./routes/icegate'));
app.use('/api/job-files', require('./routes/jobFiles')); // 18-Nov-2026: Documents window of the job list - e-Sanchit PDFs as one line per document, remove unused ones, upload other shipment documents
app.use('/api/ulip', require('./routes/ulip'));
app.use('/api/dgft', require('./routes/dgftIec')); // 13-Nov-2026: DGFT View Any IEC
app.use('/api/icegate-enquiry', require('./routes/icegateIgm')); // 14-Nov-2026: Import IGM details from ICEGATE public enquiry
app.use('/api/icegate-profiles', require('./routes/icegate-profile'));
app.use('/api/import-file', require('./routes/import-file'));
app.use('/api/warehouse-be', require('./routes/warehouse-be'));
app.use('/api/export-jobs', require('./routes/exportJobs'));
app.use('/api/export-dashboard', require('./routes/exportDashboard'));
app.use('/api/dashboard', require('./routes/importDashboard'));
// Added 28-Oct-2026: routes the frontend was calling but the backend did not have
app.use('/api/assets', require('./routes/assets'));
app.use('/api/status-master', require('./routes/statusMaster'));
app.use('/api/document-series', require('./routes/documentSeries')); // 28-Oct-2026: Document Series master
app.use('/api/number-series', require('./routes/numberSeries')); // 05-Nov-2026: Number Series (iCAFFE) - voucher / invoice / docket numbers
app.use('/api/contracts', require('./routes/contracts')); // 28-Oct-2026: Customer Contract & Quotation master
app.use('/api/user-prefs', require('./routes/userPrefs')); // 28-Oct-2026: per-user preferences (favourite reports)
app.use('/api/timeline', require('./routes/timeline'));
app.use('/api/dsr-templates', require('./routes/dsrTemplates'));
app.use('/api/tariff', require('./routes/tariff'));
app.use('/api/import-jobs', require('./routes/importJobs'));
app.use('/api/be-amendments', require('./routes/beAmendments')); // 10-Nov-2026: BE amendment register (iCAFFE way: amended copy of the BE job, own number)
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/vouchers', require('./routes/vouchers'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/accounting-masters', require('./routes/accountingMasters'));
// Credit Control & Ageing - the screen used to show four invented customers (30-Oct-2026)
app.use('/api/credit-control', require('./routes/creditControl'));
// Budgets & Variance - the screen used to show four invented budgets (30-Oct-2026)
app.use('/api/budgets', require('./routes/budgets'));
// Sales & CRM - leads / quotations. The screen used to show invented leads and quotes (30-Oct-2026)
app.use('/api/sales', require('./routes/sales'));
app.use('/api/sales-hub', require('./routes/salesHub')); // 11-Nov-2026 Sales module (customers, sales persons, enquiries, quotes)
// Fleet & Transport - lorry receipts. The screen used to show invented trips (30-Oct-2026)
app.use('/api/fleet', require('./routes/fleet'));
// The three freight dashboards - they used to list invented shipments (30-Oct-2026)
app.use('/api/freight', require('./routes/freight'));
app.use('/api/shipments', require('./routes/shipments')); // 05-Nov-2026: Shipment Registration (iCAFFE), 4 divisions, branch-wise
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/bulk-zip', require('./routes/bulkZip'));
app.use('/api/ai-extractor', require('./routes/ai-extractor'));
app.use('/api/chatbot', require('./routes/chatbot')); // EagleView AI chat: answers from the database + saved history (28-Oct-2026)
// HRMS moved to the separate hrms-backend app (22-Oct-2026). Old SQLite HR route unmounted:
// app.use('/api/hr', require('./routes/hr'));

const PORT = process.env.PORT || 5000;

require('./models/AppSetting');
require('./models/SettingsTables'); // Settings screens: CompanyProfile, SftpConfig, UlipConfig, AiConfig, WhatsappConfig, EmailConfig ... (28-Oct-2026)
require('./models/Notification');
require('./models/User');
require('./models/UserProfile');
require('./models/UserSettings');
require('./models/EmployeeMaster');
require('./models/AttendanceLog');
require('./models/LeaveRequest');
require('./models/HRAuditLog');
require('./models/FieldAgent');
require('./models/FieldAgentLocation');
require('./models/MasterAWB');
require('./models/AwbLog');
require('./models/ExportFinalDoc');
require('./models/HouseAWB');
require('./models/SpecialHandlingCode');
require('./models/AwbStock');
require('./models/HawbStock');
const Party = require('./models/Party');
const HawbStock = require('./models/HawbStock');
HawbStock.belongsTo(Party, { foreignKey: 'partyId', as: 'party' });
require('./models/AwbRateLine');
require('./models/AwbOtherCharge');
require('./models/Tariff');
require('./models/IataAgent');
require('./models/Master');
require('./models/Airport');
require('./models/Airline');
require('./models/Currency');
require('./models/Country');
require('./models/Charge');
require('./models/Party');
require('./models/PartyDocument');
require('./models/PartyBranch');
require('./models/PartyADCode');
require('./models/PartyDrawbackAccount');
require('./models/ChaMaster');
require('./models/JobSequence');
require('./models/CompanyBranch');
const FinancialYear = require('./models/FinancialYear');
const FinancialPeriod = require('./models/FinancialPeriod');
FinancialYear.hasMany(FinancialPeriod, { foreignKey: 'financialYearId', as: 'periods', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
FinancialPeriod.belongsTo(FinancialYear, { foreignKey: 'financialYearId' });
const User = require('./models/User');
const UserPermission = require('./models/UserPermission');
const AeoMaster = require('./models/AeoMaster');
const Airwaybill = require('./models/Airwaybill');  // â† The model actually used by awb routes
require('./models/MasterAWB');
require('./models/AwbLog');                        // keep for table sync, but not used in routes
const SpecialHandlingCode = require('./models/SpecialHandlingCode');
const ExportJob = require('./models/ExportJob');
const ExportInvoice = require('./models/ExportInvoice');
const ExportItem = require('./models/ExportItem');
const ExportContainer = require('./models/ExportContainer');
const ExportDocument = require('./models/ExportDocument');
const ExportDrawback = require('./models/ExportDrawback');
const ExportLicense = require('./models/ExportLicense');
const ImportJob = require('./models/ImportJob');
const ImportInvoice = require('./models/ImportInvoice');
const ImportItem = require('./models/ImportItem');
const ImportContainer = require('./models/ImportContainer');
const AwbOci = require('./models/AwbOci');
const AwbDimension = require('./models/AwbDimension');
const AwbRateLine = require('./models/AwbRateLine');
const AwbOtherCharge = require('./models/AwbOtherCharge');
require('./models/AwbStock');
require('./models/HawbStock');
require('./models/IcegateProfile'); // Multi-ICEGATE support

// Define Airwaybill Relationships (MAWB)
Airwaybill.hasMany(SpecialHandlingCode, { foreignKey: 'awbId', scope: { awbType: ['AWB', 'MAWB'] }, constraints: false });
Airwaybill.hasMany(AwbOci,             { foreignKey: 'awbId', scope: { awbType: ['AWB', 'MAWB'] }, constraints: false });
Airwaybill.hasMany(AwbDimension,       { foreignKey: 'awbId', scope: { awbType: ['AWB', 'MAWB'] }, constraints: false });
Airwaybill.hasMany(AwbRateLine,        { foreignKey: 'awbId', scope: { awbType: ['AWB', 'MAWB'] }, constraints: false });
Airwaybill.hasMany(AwbOtherCharge,     { foreignKey: 'awbId', scope: { awbType: ['AWB', 'MAWB'] }, constraints: false });

// HouseAWB relationships (were missing: XFHL/XFZB got no rate lines, charges, OCI or SPH for houses)
const HouseAWBModel = require('./models/HouseAWB');
HouseAWBModel.hasMany(SpecialHandlingCode, { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });
HouseAWBModel.hasMany(AwbOci,             { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });
HouseAWBModel.hasMany(AwbDimension,       { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });
HouseAWBModel.hasMany(AwbRateLine,        { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });
HouseAWBModel.hasMany(AwbOtherCharge,     { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });


// Define HouseAWB Relationships
const AccountGroup = require('./models/AccountGroup');
const AccountLedger = require('./models/AccountLedger');
const Currency = require('./models/Currency');
const TdsNature = require('./models/TdsNature');
const Voucher = require('./models/Voucher');
const VoucherDetail = require('./models/VoucherDetail');
const Invoice = require('./models/Invoice');
const InvoiceItem = require('./models/InvoiceItem');
const VoucherType = require('./models/VoucherType');
const CostCategory = require('./models/CostCategory');
const CostCentre = require('./models/CostCentre');

// voucher attachments - the Voucher Entry screen's supporting documents (30-Oct-2026)
const VoucherDocument = require('./models/VoucherDocument');
// bill-wise knock-off on receipts / payments - before this every outstanding figure was FIFO only (30-Oct-2026)
const Budget = require('./models/Budget');
const LorryReceipt = require('./models/LorryReceipt');
const FreightEvent = require('./models/FreightEvent');
const Lead = require('./models/Lead');
const Quotation = require('./models/Quotation');
const QuotationCharge = require('./models/QuotationCharge');
Lead.hasMany(Quotation, { as: 'quotations', foreignKey: 'leadId' });
Quotation.belongsTo(Lead, { as: 'lead', foreignKey: 'leadId' });
Quotation.hasMany(QuotationCharge, { as: 'charges', foreignKey: 'quotationId' });
QuotationCharge.belongsTo(Quotation, { as: 'quotation', foreignKey: 'quotationId' });
const VoucherAllocation = require('./models/VoucherAllocation');
Voucher.hasMany(VoucherAllocation, { as: 'allocations', foreignKey: 'voucherId' });
VoucherAllocation.belongsTo(Voucher, { as: 'voucher', foreignKey: 'voucherId' });
VoucherAllocation.belongsTo(Voucher, { as: 'againstVoucher', foreignKey: 'againstVoucherId' });
VoucherAllocation.belongsTo(AccountLedger, { as: 'ledger', foreignKey: 'ledgerId' });
const CreditFollowUp = require('./models/CreditFollowUp');
const CreditPolicy = require('./models/CreditPolicy');
AccountLedger.hasMany(CreditFollowUp, { as: 'creditFollowUps', foreignKey: 'ledgerId' });
CreditFollowUp.belongsTo(AccountLedger, { as: 'ledger', foreignKey: 'ledgerId' });
AccountLedger.hasOne(CreditPolicy, { as: 'creditPolicy', foreignKey: 'ledgerId' });
CreditPolicy.belongsTo(AccountLedger, { as: 'ledger', foreignKey: 'ledgerId' });
Voucher.hasMany(VoucherDocument, { as: 'documents', foreignKey: 'voucherId' });
VoucherDocument.belongsTo(Voucher, { foreignKey: 'voucherId' });
CostCentre.hasMany(VoucherDetail, { as: 'voucherLines', foreignKey: 'costCentreId' });
VoucherDetail.belongsTo(CostCentre, { as: 'costCentre', foreignKey: 'costCentreId' });

CostCategory.hasMany(CostCentre, { as: 'costCentres', foreignKey: 'categoryId' });
CostCentre.belongsTo(CostCategory, { as: 'category', foreignKey: 'categoryId' });

CostCentre.hasMany(CostCentre, { as: 'subCentres', foreignKey: 'parentId' });
CostCentre.belongsTo(CostCentre, { as: 'parentCentre', foreignKey: 'parentId' });


// --- INVENTORY MASTERS ---
const InventoryGroup = require('./models/InventoryGroup');
const InventoryCategory = require('./models/InventoryCategory');
const UnitOfMeasure = require('./models/UnitOfMeasure');
const Godown = require('./models/Godown');
const StockItem = require('./models/StockItem');

// Inventory Associations
InventoryGroup.hasMany(InventoryGroup, { as: 'subGroups', foreignKey: 'parentId' });
InventoryGroup.belongsTo(InventoryGroup, { as: 'parentGroup', foreignKey: 'parentId' });

InventoryCategory.hasMany(InventoryCategory, { as: 'subCategories', foreignKey: 'parentId' });
InventoryCategory.belongsTo(InventoryCategory, { as: 'parentCategory', foreignKey: 'parentId' });

Godown.hasMany(Godown, { as: 'subGodowns', foreignKey: 'parentId' });
Godown.belongsTo(Godown, { as: 'parentGodown', foreignKey: 'parentId' });

StockItem.belongsTo(InventoryGroup, { as: 'group', foreignKey: 'groupId' });
StockItem.belongsTo(InventoryCategory, { as: 'category', foreignKey: 'categoryId' });
StockItem.belongsTo(UnitOfMeasure, { as: 'uom', foreignKey: 'uomId' });

AccountGroup.hasMany(AccountGroup, { as: 'subGroups', foreignKey: 'parentId' });
AccountGroup.belongsTo(AccountGroup, { as: 'parentGroup', foreignKey: 'parentId' });
AccountGroup.hasMany(AccountLedger, { as: 'ledgers', foreignKey: 'groupId' });
AccountLedger.belongsTo(AccountGroup, { as: 'group', foreignKey: 'groupId' });

const HouseAWB = require('./models/HouseAWB');
HouseAWB.hasMany(SpecialHandlingCode, { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });
HouseAWB.hasMany(AwbOci, { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });
HouseAWB.hasMany(AwbDimension, { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });
HouseAWB.hasMany(AwbRateLine, { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });
HouseAWB.hasMany(AwbOtherCharge, { foreignKey: 'awbId', scope: { awbType: 'HAWB' }, constraints: false });

User.hasMany(UserPermission, { foreignKey: 'userId', as: 'permissions' });

ExportJob.hasMany(ExportInvoice, { foreignKey: 'exportJobId', as: 'invoices', onDelete: 'CASCADE' });
ExportInvoice.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

ExportInvoice.hasMany(ExportItem, { foreignKey: 'exportInvoiceId', as: 'items', onDelete: 'CASCADE' });
ExportItem.belongsTo(ExportInvoice, { foreignKey: 'exportInvoiceId' });

ExportJob.hasMany(ExportContainer, { foreignKey: 'exportJobId', as: 'containers', onDelete: 'CASCADE' });
ExportContainer.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

ExportJob.hasMany(ExportDocument, { foreignKey: 'exportJobId', as: 'docs', onDelete: 'CASCADE' });
ExportDocument.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

ExportJob.hasMany(ExportDrawback, { foreignKey: 'exportJobId', as: 'dbkItems', onDelete: 'CASCADE' });
ExportDrawback.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

ExportJob.hasMany(ExportLicense, { foreignKey: 'exportJobId', as: 'licenseItems', onDelete: 'CASCADE' });
ExportLicense.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

ImportJob.hasMany(ImportInvoice, { foreignKey: 'importJobId', as: 'invoices', onDelete: 'CASCADE' });
ImportInvoice.belongsTo(ImportJob, { foreignKey: 'importJobId' });

ImportInvoice.hasMany(ImportItem, { foreignKey: 'importInvoiceId', as: 'items', onDelete: 'CASCADE' });
ImportItem.belongsTo(ImportInvoice, { foreignKey: 'importInvoiceId' });

ImportJob.hasMany(ImportContainer, { foreignKey: 'importJobId', as: 'containers', onDelete: 'CASCADE' });
ImportContainer.belongsTo(ImportJob, { foreignKey: 'importJobId' });

ImportJob.belongsTo(ImportJob, { foreignKey: 'inBondJobId', as: 'warehouseJob' });

UserPermission.belongsTo(User, { foreignKey: 'userId' });
Voucher.belongsTo(VoucherType, { foreignKey: 'voucherTypeId', as: 'voucherType' });
Voucher.hasMany(VoucherDetail, { foreignKey: 'voucherId', as: 'details' });
VoucherDetail.belongsTo(Voucher, { foreignKey: 'voucherId' });
VoucherDetail.belongsTo(AccountLedger, { foreignKey: 'ledgerId', as: 'ledger' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });
Invoice.belongsTo(AccountLedger, { foreignKey: 'partyId', as: 'party' });
InvoiceItem.belongsTo(AccountLedger, { foreignKey: 'chargeLedgerId', as: 'chargeLedger' });


// any /api path no route answered: a clear 404 (29-Oct-2026; before, it hung or got the web page)
app.use('/api', (req, res) => res.status(404).json({ success: false, error: `API not found: ${req.method} ${req.originalUrl.split('?')[0]}. If it was just added, restart the backend.` }));

// 14-Nov-2026: an error thrown in a route (or a bad / too big body) - a JSON answer, never the stack trace page
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err && (err.status || err.statusCode)) || 500;
  if (status >= 500) {
    const ref = Date.now().toString(36).toUpperCase();
    console.error(`[API ${ref}] ${req.method} ${String(req.originalUrl || '').split('?')[0]} ->`, err && (err.stack || err.message || err));
    return res.status(status).json({ success: false, error: `Server error (ref ${ref}). Please try again; if it repeats, tell the admin this reference.` });
  }
  return res.status(status).json({ success: false, error: status === 413 ? 'The data sent is too large.' : (err && err.expose !== false && err.message) || 'Bad request' });
});

// â”€â”€ Serve React production build â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FRONTEND_BUILD = path.join(__dirname, 'public');
if (fs.existsSync(FRONTEND_BUILD)) {
  // Field Boy PWA App - served from dedicated folder (safe from vite build)
  const FIELD_APP_DIR = path.join(__dirname, 'field-app-src');
  // 14-Nov-2026: only the address without the slash is redirected (Express also matched '/field-app/' here: endless redirect)
  app.get('/field-app', (req, res, next) => (req.originalUrl.split('?')[0] === '/field-app' ? res.redirect('/field-app/') : next()));
  app.get('/field-app/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(FIELD_APP_DIR, 'index.html'));
  });
  app.use('/field-app', express.static(FIELD_APP_DIR, { maxAge: '1h' }));

  app.use(express.static(FRONTEND_BUILD, { setHeaders: (res, filePath) => { if (filePath.endsWith('.html')) { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); } } }));
  app.get('/{*splat}', (req, res) => {
    // Don't intercept API calls, uploads, socket.io, or field-app
    // 29-Oct-2026: an unknown API path got no answer at all (the request hung until the browser gave up)
    if (req.path.startsWith('/api')) return res.status(404).json({ success: false, error: `API not found: ${req.method} ${req.path}. If it was just added, restart the backend.` });
    if (req.path.startsWith('/uploads') || req.path.startsWith('/socket.io') || req.path.startsWith('/field-app')) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0'); res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
  });
  console.log('[Production] Serving frontend from:', FRONTEND_BUILD);
  console.log('[Field App] PWA available at: /field-app/');
}

// Register every model before sync so missing tables get created (28-Oct-2026)
for (const f of require('fs').readdirSync(path.join(__dirname, 'models'))) {
  if (!f.endsWith('.js') || f === 'awbColumns.js' || f === 'index.js') continue;
  try { require('./models/' + f); } catch (e) { console.warn('[DB] model load failed:', f, e.message); }
}
sequelize.sync().then(async () => {
  console.log('Database synced successfully');
  // Settings tables: copy the old AppSetting values in once (28-Oct-2026)
  require('./utils/settingsStore').ready().then(() => console.log('[Settings] tables ready')).catch(e => console.warn('[Settings] migrate warning:', e.message));
  // add-only column sync (28-Oct-2026): replaces sync({ alter: true }), which rebuilds SQLite tables on every start
  const { ensureColumns } = require('./utils/ensureColumns');
  // Add any AWB columns the tables are missing (safe: add-only)
  try {
    for (const model of Object.values(sequelize.models)) { try { await ensureColumns(model); } catch (e) { console.warn('[DB] ensureColumns', model.name, e.message); } }
    // Import / Export form fields: create the known ones, then load every extra column into its model (28-Oct-2026)
    try {
      const { ensureFieldColumns, registerDbColumns } = require('./utils/dynamicColumns');
      const known = require('./utils/formFieldColumns');
      for (const [name, fields] of Object.entries(known)) if (sequelize.models[name]) await ensureFieldColumns(sequelize.models[name], Object.fromEntries(fields.map(f => [f, ''])));
      for (const name of ['ImportJob', 'ImportInvoice', 'ImportItem', 'ImportContainer', 'ExportJob', 'ExportInvoice', 'ExportItem', 'ExportContainer', 'ExportDocument', 'ExportDrawback', 'ExportLicense'])
        if (sequelize.models[name]) await registerDbColumns(sequelize.models[name]);
    } catch (e) { console.warn('[DB] form field columns:', e.message); }
  } catch (e) { console.warn('[DB] ensureColumns warning:', e.message); }
  // BE No / dates: extendedData JSON -> columns (30-Oct-2026), idempotent
  try { await require('./utils/beFieldsMigrate').migrateBeFields(); } catch (e) { console.warn('[DB] BE fields:', e.message); }
  // Job table indexes + SQLite housekeeping (29-Oct-2026): idempotent, runs after the columns exist
  try {
    const dbx = require('./utils/dbIndexes');
    await dbx.ensureJobIndexes();
    await dbx.optimizeDb();
    setInterval(() => { dbx.checkpointDb().then(() => dbx.optimizeDb()); }, 6 * 60 * 60 * 1000).unref();
  } catch (e) { console.warn('[DB] indexes warning:', e.message); }
  // Sync new WhatsApp queue table
  const WhatsappNotificationQueue = require('./models/WhatsappNotificationQueue');
  WhatsappNotificationQueue.sync().then(() => ensureColumns(WhatsappNotificationQueue)).catch(e => console.warn('[WA Queue] Sync warning:', e.message));

  // Sync new ICEGATE tracking fields
  const ImportJob = require('./models/ImportJob');
  const ExportJob = require('./models/ExportJob');
  ImportJob.sync().then(() => ensureColumns(ImportJob)).catch(e => console.warn('[ImportJob] Sync warning:', e.message));
  ExportJob.sync().then(() => ensureColumns(ExportJob)).catch(e => console.warn('[ExportJob] Sync warning:', e.message));

  // Sync Field Tracking tables
  const FieldAgent = require('./models/FieldAgent');
  const FieldAgentLocation = require('./models/FieldAgentLocation');
  FieldAgent.sync().then(() => ensureColumns(FieldAgent)).catch(e => console.warn('[FieldAgent] Sync warning:', e.message));
  FieldAgentLocation.sync().then(() => ensureColumns(FieldAgentLocation)).catch(e => console.warn('[FieldAgentLocation] Sync warning:', e.message));
  // Offline Agent Alert -- every 2 min check
  const { Op } = require('sequelize');
  setInterval(async () => {
    try {
      const FA = require('./models/FieldAgent');
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const stale = await FA.findAll({
        where: { isActive: true, status: { [Op.ne]: 'Offline' }, lastSeen: { [Op.lt]: fiveMinAgo } }
      });
      const io = app.get('io');
      // 09-Nov-2026: alert once and mark the agent Offline (before, the same alert went out every 2 minutes for ever and
      // the agent stayed "In Transit"); the next location from the phone sets the status again
      for (const a of stale) {
        const mins = Math.round((Date.now() - new Date(a.lastSeen).getTime()) / 60000);
        if (io && mins < 24 * 60) liveBus.toField(io, 'agent_offline_alert', { agentId: a.id, agentName: a.name, minutesSince: mins, lastSeen: a.lastSeen });
        await a.update({ status: 'Offline' }, { silent: true });
        if (io) liveBus.toField(io, 'agent_status_updated', { agentId: a.id, status: 'Offline' });
      }
    } catch(e) { console.warn('[OfflineAlert]', e.message); }
  }, 2 * 60 * 1000);
  console.log('[OfflineAlert] Monitoring started -- alerts every 2 min');


  server.on('error', (err) => { if (err && err.code === 'EADDRINUSE') portBusy(err.port || PORT); else { console.error('[Server]', err.message || err); process.exit(1); } });
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Start FSU auto-tracking polling (every 5 min as per Descartes FAQ Q23)
    const { startFsuPolling } = require('./utils/FsuService');
    startFsuPolling(5 * 60 * 1000); // 5 minutes

    const { runEmailListener } = require('./services/EmailListener');
    runEmailListener();

    // Start WhatsApp notification scheduler
    const { startScheduler } = require('./utils/WhatsappScheduler');
    startScheduler().catch(e => console.warn('[WA Scheduler] Start warning:', e.message));

    // 29-Oct-2026: CBIC customs exchange rates from ICEGATE into the Currency master - checked 1 min after start and
    // every 6 hours; a new notification (1st / 3rd Thursday) is applied on its own. Off with setting cbic_exrate_auto = 0.
    require('./utils/cbicExchangeRates').startAutoSync(6 * 60 * 60 * 1000);

    // 17-Nov-2026: new CBIC customs notifications / circulars mailed with the PDF (Settings > Email > CBIC customs updates)
    require('./utils/cbicCustomsWatch').start(30 * 60 * 1000);

    // 29-Oct-2026: ICEGATE acknowledgement of BEs filed through the API - every 10 min for 3 days after filing
    const icegateRoutes = require('./routes/icegate');
    require('./utils/icegateAck').startAckPolling({ getIcegateConfig: icegateRoutes.getIcegateConfig, getAuthToken: icegateRoutes.getAuthToken }, 10 * 60 * 1000);
  });
}).catch(err => {
  console.error('Failed to sync database:', err);
});
