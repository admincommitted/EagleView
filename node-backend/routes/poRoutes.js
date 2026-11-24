const os = require('os');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Vendor = require('../models/Vendor');
const PurchaseOrder = require('../models/PurchaseOrder');
const POItem = require('../models/POItem');
const nodemailer = require('nodemailer');
const WhatsappWebService = require('../utils/WhatsappWebService');

const uploadDir = path.join(__dirname, '../uploads/po');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
// 14-Nov-2026: quotation file - documents and pictures only, 20 MB
const upload = multer({ storage: storage, limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(/\.(pdf|jpe?g|png|webp|gif|bmp|tiff?|docx?|xlsx?|csv|txt|zip|msg|eml)$/i.test(file.originalname || '') ? null : Object.assign(new Error('Only PDF, picture, Word, Excel, CSV, text or ZIP files can be attached'), { status: 400 }), true) });

// SMTP from Settings > Email, .env as fallback (utils/mailer.js). 28-Oct-2026
const transporter = require('../utils/mailer').lazyTransport();

// Sync
// add-only sync (28-Oct-2026): sync({ alter: true }) rebuilt these SQLite tables on every start
const { ensureColumns } = require('../utils/ensureColumns');
for (const M of [Vendor, PurchaseOrder, POItem]) M.sync().then(() => ensureColumns(M)).catch(e => console.warn('[PO] sync warning:', e.message));

// ---- Approval links in e-mail / WhatsApp (28-Oct-2026) ----
// The director opens them without logging in, so each link carries a signature; a guessed or edited link is refused.
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');
// 14-Nov-2026 (security check): a link is valid 14 days and its "by" name is signed too; links sent before this
// (no exp) are taken until 01-Dec-2026
const LINK_DAYS = 14;
const LEGACY_LINKS_UNTIL = Date.parse('2026-12-01T00:00:00+05:30');
const actionSig = (id, action, exp, by) => crypto.createHmac('sha256', JWT_SECRET).update(exp ? `po:${id}:${action}:${exp}:${by || ''}` : `po:${id}:${action}`).digest('hex').slice(0, 32);
const actionLink = (base, id, action, by) => { const exp = Math.floor(Date.now() / 1000) + LINK_DAYS * 86400; return `${base}/api/po/${id}/action?action=${action}&by=${encodeURIComponent(by)}&exp=${exp}&sig=${actionSig(id, action, exp, by)}`; };
// Director's WhatsApp number: DIRECTOR_PHONE in .env, else App Setting 'PO_DIRECTOR_PHONE'. No number = no WhatsApp.
// 09-Nov-2026: who gets the approval request is set in Settings > Email > "Purchase Order approval"
// (App Settings PO_DIRECTOR_EMAIL / PO_DIRECTOR_PHONE / PO_APPROVAL_LINK_BASE). Before, the e-mail went to an address
// written here and the WhatsApp number had no screen, so no WhatsApp went out.
const appSetting = async (key) => { try { const AppSetting = require('../models/AppSetting'); const row = await AppSetting.findOne({ where: { key } }); return row && row.value ? String(row.value).trim() : ''; } catch (e) { return ''; } };
// WhatsApp: the setting, else DIRECTOR_PHONE in .env, else the "Purchase" number in Settings > WhatsApp
async function getDirectorPhone() {
    const s = await appSetting('PO_DIRECTOR_PHONE'); if (s) return s;
    if (process.env.DIRECTOR_PHONE) return process.env.DIRECTOR_PHONE;
    try {
        const M = require('../utils/settingsStore').models.WhatsappModuleNumber;
        const rows = M ? await M.findAll() : [];
        const r = rows.find(x => /purchase/i.test(x.moduleName || '')) || rows.find(x => /director/i.test(x.moduleName || ''));
        return r ? r.phoneNumber : null;
    } catch (e) { return null; }
}
// e-mail: the setting (one or more, comma separated), else DIRECTOR_EMAIL in .env, else the old address
async function getDirectorEmail() {
    const s = await appSetting('PO_DIRECTOR_EMAIL');
    const list = String(s || process.env.DIRECTOR_EMAIL || 'hr1@committedgroup.com').split(/[,;]/).map(x => x.trim()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
    return list.length ? list.join(', ') : 'hr1@committedgroup.com';
}
// where the Approve / Reject links point. The links went to port 5000, where this server does not run (it runs on
// 5001; 5000 is another program on this PC), so a click gave "access denied". Now: the setting, else this PC's
// network address with the port this server is really listening on.
async function linkBase(req, networkIP) {
    const s = (await appSetting('PO_APPROVAL_LINK_BASE')).replace(/\/+$/, '');
    if (/^https?:\/\//.test(s)) return s;
    // 14-Nov-2026: EagleView's public address (Settings > Security) when set
    try { const pub = await require('../utils/settingsStore').get('app_public_url'); if (/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(String(pub || '').replace(/\/+$/, ''))) return String(pub).replace(/\/+$/, ''); } catch (e) { /* not set */ }
    // the internet address while start_field_internet.bat runs, so the director can approve from his phone on mobile data
    try { const u = require('fs').readFileSync(require('path').join(__dirname, '..', 'FIELD_PUBLIC_URL.txt'), 'utf8').trim(); if (/^https:\/\/[a-z0-9.-]+$/i.test(u)) return u; } catch (e) { /* not running */ }
    const port = (req.socket && req.socket.localPort) || process.env.PORT || 5001;
    return 'http://' + networkIP + ':' + port;
}

// VENDORS
router.get('/vendors', async (req, res) => {
    try {
        const vendors = await Vendor.findAll();
        res.json(vendors);
    } catch(err) { console.error('PO_CREATE_ERROR:', err); res.status(500).json({error: err.message}); }
});
// 22-Nov-2026: vendor add / edit / delete from the Vendor Master screen. Only the five vendor fields are taken; a blank
// name or a name another vendor already has is refused; a vendor that a purchase order uses cannot be deleted.
const vendorBody = (b) => { const s = (v) => String(v == null ? '' : v).trim(); return { vendorName: s(b.vendorName), gstNumber: s(b.gstNumber).toUpperCase(), contactEmail: s(b.contactEmail), phone: s(b.phone), address: s(b.address) }; };
async function vendorProblem(v, exceptId) {
    if (!v.vendorName) return 'Vendor name is required';
    if (v.gstNumber && !/^[0-9]{2}[A-Z0-9]{13}$/.test(v.gstNumber)) return 'GST number must be 15 characters (2 digits, then 13 letters / digits)';
    const twin = (await Vendor.findAll({ attributes: ['id', 'vendorName'] })).find(x => String(x.id) !== String(exceptId || '') && String(x.vendorName || '').trim().toUpperCase() === v.vendorName.toUpperCase());
    return twin ? 'A vendor named ' + twin.vendorName + ' is already there' : '';
}
router.post('/vendors', async (req, res) => {
    try {
        const body = vendorBody(req.body || {});
        const bad = await vendorProblem(body, null);
        if (bad) return res.status(400).json({ error: bad });
        const v = await Vendor.create(body);
        res.json(v);
    } catch(err) { console.error('PO_CREATE_ERROR:', err); res.status(500).json({error: err.message}); }
});
router.put('/vendors/:id', async (req, res) => {
    try {
        const row = await Vendor.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'Vendor not found' });
        const body = vendorBody(req.body || {});
        const bad = await vendorProblem(body, row.id);
        if (bad) return res.status(400).json({ error: bad });
        await row.update(body);
        res.json(row);
    } catch(err) { console.error('VENDOR_UPDATE_ERROR:', err); res.status(500).json({error: err.message}); }
});
router.delete('/vendors/:id', async (req, res) => {
    try {
        const row = await Vendor.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'Vendor not found' });
        const used = await PurchaseOrder.count({ where: { VendorID: row.id } });
        if (used) return res.status(409).json({ error: row.vendorName + ' is used in ' + used + ' purchase order(s) - it cannot be deleted' });
        await row.destroy();
        res.json({ success: true });
    } catch(err) { console.error('VENDOR_DELETE_ERROR:', err); res.status(500).json({error: err.message}); }
});

// POs
router.get('/', async (req, res) => {
    try {
        const pos = await PurchaseOrder.findAll({ include: [Vendor, {model: POItem, as: 'items'}], order: [['createdAt', 'DESC']] });
        res.json(pos);
    } catch(err) { console.error('PO_CREATE_ERROR:', err); res.status(500).json({error: err.message}); }
});

router.post('/', upload.single('quote'), async (req, res) => {
    try {
        const { vendorId, justification, branch, category, priority, items } = req.body;
        const parsedItems = JSON.parse(items);
        
        let grandTotal = 0;
        parsedItems.forEach(i => { 
            const base = Number(i.quantity) * Number(i.unitPrice);
            const gst = base * (Number(i.gstRate || 0) / 100);
            grandTotal += (base + gst); 
        });

        const year = new Date().getFullYear();
        const lastPo = await PurchaseOrder.findOne({ order: [['id', 'DESC']] });
        let nextSeq = 1;
        if (lastPo && lastPo.poNumber) {
            const parts = lastPo.poNumber.split('-');
            if (parts.length === 3 && parts[1] == year) {
                nextSeq = parseInt(parts[2], 10) + 1;
            }
        }
        const generatedPoNumber = `PO-${year}-${String(nextSeq).padStart(4, '0')}`;

        const po = await PurchaseOrder.create({
            poNumber: generatedPoNumber,
            date: new Date(),
            VendorID: vendorId,
            totalAmount: grandTotal,
            status: 'Pending Approval',
            submittedAt: new Date(),
            justification,
            branch,
            category,
            priority,
            quoteFilePath: req.file ? '/uploads/po/' + req.file.filename : null
        });

        for(let i of parsedItems) {
            const base = Number(i.quantity) * Number(i.unitPrice);
            const gstAmount = base * (Number(i.gstRate || 0) / 100);
            await POItem.create({
                PO_ID: po.id,
                itemName: i.itemName,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                gstRate: i.gstRate || 0,
                gstAmount: gstAmount
            });
        }

        // Send Email Alert
        const vendor = await Vendor.findByPk(vendorId);
        const directorEmail = await getDirectorEmail();
        
        
        // Dynamically get the actual network IP so emails work across devices
        let networkIP = req.hostname;
        if (networkIP === 'localhost' || networkIP === '127.0.0.1') {
            const interfaces = os.networkInterfaces();
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        networkIP = iface.address;
                    }
                }
            }
        }
        
        const origin = req.headers.origin || `http://${networkIP}:5173`;
        const frontendUrl = `${origin}/po-approval/${po.id}`;
        // Use the network IP for the backend URL in emails
        const backendUrl = await linkBase(req, networkIP);

        let itemsHtml = `
            <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: left;">Item Name</th>
                          <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: left;">Last Purchase</th>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: center;">Qty</th>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: right;">Unit Price (Rs)</th>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: center;">GST %</th>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: right;">Total (Rs)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        let rowIndex = 0;
        for (const i of parsedItems) {
            // Find last purchase history
            const lastPurchase = await POItem.findOne({
                where: { itemName: i.itemName },
                include: [{ model: PurchaseOrder, attributes: ['createdAt', 'poNumber'] }],
                order: [['createdAt', 'DESC']]
            });
            let lastPurchaseText = '<span style="color: #94a3b8; font-size: 11px;">First Time Buy</span>';
            if (lastPurchase && lastPurchase.PurchaseOrder) {
                lastPurchaseText = `<span style="color: #475569; font-size: 11px;">Rs.${lastPurchase.unitPrice} on ${new Date(lastPurchase.PurchaseOrder.createdAt).toLocaleDateString()}<br/>(${lastPurchase.PurchaseOrder.poNumber})</span>`;
            }

            const base = Number(i.quantity) * Number(i.unitPrice);
            const gstAmt = base * (Number(i.gstRate || 0) / 100);
            const lineTotal = base + gstAmt;
            const bg = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
            rowIndex++;
            itemsHtml += `
                <tr style="background-color: ${bg};">
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a;">${i.itemName}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a;">${lastPurchaseText}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; text-align: center;">${i.quantity}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; text-align: right;">${Number(i.unitPrice).toFixed(2)}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; text-align: center;">${i.gstRate || 0}%</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; text-align: right;">${lineTotal.toFixed(2)}</td>
                </tr>
            `;
        }
        
        itemsHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" style="padding: 8px 10px; text-align: right; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #1e293b; background-color: #f1f5f9;">Grand Total:</td>
                        <td style="padding: 8px 10px; text-align: right; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #16a34a; background-color: #f1f5f9;">Rs. ${Number(po.totalAmount).toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
        
        // 09-Nov-2026: waited for, so the screen can say whether the e-mail went (before it always said "sent")
        let mailNote;
        await transporter.sendMail({
            from: `"EagleView ERP" <${process.env.SMTP_USER}>`,
            to: directorEmail,
            subject: `Approval Request: Purchase Order ${po.poNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #f1f5f9; padding: 30px 10px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <tr>
                            <td style="background-color: #1e3a8a; padding: 20px; border-bottom: 4px solid #3b82f6;">
                                <table width="100%">
                                    <tr>
                                        <td>
                                            <h2 style="margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 22px; color: #ffffff; letter-spacing: 0.5px;">Purchase Order Approval</h2>
                                            <p style="margin: 6px 0 0 0; font-size: 14px; color: #bfdbfe; font-family: 'Segoe UI', Arial, sans-serif;">Please review the following request.</p>
                                        </td>
                                        <td align="right" valign="middle">
                                            <table border="0" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center" bgcolor="#f59e0b" style="border-radius: 20px; padding: 6px 14px;">
                                                        <span style="color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: bold; letter-spacing: 1px;">PENDING</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 25px 25px 5px 25px;">
                                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; font-family: Arial, sans-serif; font-size: 13px; color: #334155; line-height: 1.6;">
                                    <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; text-transform: uppercase;">Issuing Company Details</h4>
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td width="100" valign="top"><strong>Name</strong></td>
                                            <td width="10" valign="top">:</td>
                                            <td valign="top"><strong>COMMITTED CARGO CARE LIMITED</strong></td>
                                        </tr>
                                        <tr>
                                            <td valign="top"><strong>Address</strong></td>
                                            <td valign="top">:</td>
                                            <td valign="top">A-406, ROAD NO-4, STREET NO. 8, MAHIPALPUR EXTN., New Delhi-110037</td>
                                        </tr>
                                        <tr>
                                            <td valign="top"><strong>GSTIN</strong></td>
                                            <td valign="top">:</td>
                                            <td valign="top">07AAACC6689E1ZJ</td>
                                        </tr>
                                        <tr>
                                            <td valign="top"><strong>State</strong></td>
                                            <td valign="top">:</td>
                                            <td valign="top">Delhi <span style="margin-left: 20px;"><strong>State Code :</strong> 07</span></td>
                                        </tr>
                                    </table>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 25px 25px 25px;">
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 6px;">
                                    <tr>
                                        <td width="50%" valign="top" style="padding: 15px; border-right: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.8;">
                                            <strong style="color: #0f172a;">PO Number:</strong> ${po.poNumber}<br>
                                            <strong style="color: #0f172a;">Date:</strong> ${new Date().toLocaleDateString()}<br>
                                            <strong style="color: #0f172a;">Branch:</strong> ${po.branch}<br>
                                        </td>
                                        <td width="50%" valign="top" style="padding: 15px; font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.8;">
                                            <strong style="color: #0f172a;">Vendor:</strong> ${vendor ? vendor.vendorName : 'N/A'}<br>
                                            <strong style="color: #0f172a;">Category:</strong> ${po.category}<br>
                                            <strong style="color: #0f172a;">Priority:</strong> <span style="color: ${po.priority === 'High' ? '#ef4444' : '#3b82f6'}; font-weight: bold;">${po.priority || 'Normal'}</span><br>
                                        </td>
                                    </tr>
                                </table>

                                <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 25px; border-radius: 4px; font-family: Arial, sans-serif; font-size: 13px; color: #92400e;">
                                    <strong style="display: block; margin-bottom: 4px; color: #b45309;">Remarks:</strong> 
                                    ${po.justification || 'No remarks provided.'}
                                    
                                </div>

                                <h3 style="font-family: Arial, sans-serif; font-size: 15px; color: #0f172a; margin-top: 0; margin-bottom: 10px;">Itemized Details</h3>
                                ${itemsHtml}

                                
                                <div style="margin-top: 25px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #ffffff; font-family: Arial, sans-serif; font-size: 12px; color: #475569; line-height: 1.6;">
                                    <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 14px;">TERMS & CONDITIONS</h4>
                                    <ul style="margin: 0; padding-left: 20px;">
                                        <li style="margin-bottom: 6px;"><strong>GST & INVOICING:</strong> VALID GSTIN AND PROPER HSN/SAC CODES ARE MANDATORY ON THE FINAL INVOICE.</li>
                                        <li style="margin-bottom: 6px;"><strong>DELIVERY:</strong> MATERIALS MUST BE DELIVERED TO THE COMMITTED CARGO CARE LIMITED, MAHIPALPUR OFFICE DURING STANDARD WORKING HOURS.</li>
                                        <li style="margin-bottom: 6px;"><strong>PAYMENT TERMS:</strong> PAYMENT WILL BE PROCESSED UPON SUCCESSFUL MATERIAL VERIFICATION AND INVOICE SUBMISSION, SUBJECT TO AGREED CREDIT TERMS.</li>
                                        <li><strong>REJECTIONS:</strong> DEFECTIVE OR NON-COMPLIANT ITEMS WILL BE REJECTED; RETURN FREIGHT WILL BE BORNE BY THE VENDOR.</li>
                                    </ul>
                                    <div style="font-size: 11px; color: #64748b; margin-top: 15px; font-style: italic; font-weight: bold; text-transform: uppercase;">* NOTE: ALL DISPUTES ARE SUBJECT TO DELHI JURISDICTION ONLY.</div>
                                </div>

                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 25px 15px; text-align: center;">
                                    <tr>
                                        <td style="font-family: Arial, sans-serif; padding-bottom: 15px;">
                                            <strong style="font-size: 15px; color: #0f172a;">Take Action</strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center">
                                            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                                                <tr>
                                                    <td align="center" bgcolor="#10b981" style="border-radius: 6px; padding: 12px 28px;">
                                                        <a href="${actionLink(backendUrl, po.id, 'Approve', directorEmail)}" target="_blank" style="font-size: 15px; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; text-decoration: none; display: block; font-weight: bold;"><font color="#ffffff">Approve</font></a>
                                                    </td>
                                                    <td width="15" style="width: 15px;">&nbsp;</td>
                                                    <td align="center" bgcolor="#ef4444" style="border-radius: 6px; padding: 12px 28px;">
                                                        <a href="${actionLink(backendUrl, po.id, 'Reject', directorEmail)}" target="_blank" style="font-size: 15px; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; text-decoration: none; display: block; font-weight: bold;"><font color="#ffffff">Reject</font></a>
                                                    </td>
                                                    <td width="15" style="width: 15px;">&nbsp;</td>
                                                    <td align="center" bgcolor="#f59e0b" style="border-radius: 6px; padding: 12px 28px;">
                                                        <a href="${actionLink(backendUrl, po.id, 'Hold', directorEmail)}" target="_blank" style="font-size: 15px; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; text-decoration: none; display: block; font-weight: bold;"><font color="#ffffff">Hold</font></a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <div style="margin-top: 25px; text-align: center; font-family: Arial, sans-serif; font-size: 13px;">
                                    <a href="${frontendUrl}" style="color: #2563eb; text-decoration: none; font-weight: bold;">View PO in EagleView ERP Portal &rarr;</a>
                                </div>
                            </td>
                        </tr>
                    </table>
                    <p style="text-align: center; font-family: Arial, sans-serif; font-size: 11px; color: #94a3b8; margin-top: 15px;">
                        This is an automated message from EagleView ERP. Please do not reply.
                    </p>
                </div>
            `
        }).then(() => { mailNote = 'e-mail sent to ' + directorEmail; }).catch(e => { console.error('Email error:', e); mailNote = 'e-mail to ' + directorEmail + ' FAILED: ' + e.message; });

        try {
            const directorPhone = await getDirectorPhone();
            if (!directorPhone) throw new Error('Director WhatsApp number not set (DIRECTOR_PHONE in .env or App Setting PO_DIRECTOR_PHONE)'); 
            
            // Build item list
            let itemLines = '';
            if (po.items && po.items.length > 0) {
                itemLines = po.items.map(item => `\uD83D\uDCE6 *${item.itemName}*\n  + Qty: ${item.quantity} | Rate: \u20B9${Number(item.unitPrice).toFixed(2)}`).join('\n\n');
            } else {
                itemLines = '- No items listed';
            }

            let itemsTextList = [];
            parsedItems.forEach((item, index) => {
                itemsTextList.push(`▫️ *${item.itemName}* (Qty: ${item.quantity} @ ₹${Number(item.unitPrice).toFixed(2)})`);
            });
            const itemsString = itemsTextList.join('\n');

            const waMessage = `*⚠️ PURCHASE ORDER APPROVAL ⚠️*\n\n*📌 PO Number:* ${po.poNumber}\n*🏢 Vendor:* ${vendor ? vendor.vendorName : 'N/A'}\n*💰 Total Amount:* ₹${Number(po.totalAmount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n*📝 Remarks:* ${po.justification || 'N/A'}\n\n*📦 ORDER ITEMS:*\n${itemsString}\n\n--------------------------------------\n*⚡ ACTION REQUIRED*\n\n✅ *To APPROVE this PO:*\n👉 ${actionLink(backendUrl, po.id, 'Approve', directorPhone)}\n\n❌ *To REJECT this PO:*\n👉 ${actionLink(backendUrl, po.id, 'Reject', directorPhone)}\n--------------------------------------`;
            
            const waStatus = await require('../utils/WhatsappWebService').sendMessage(directorPhone, waMessage);
            res.json({ success: true, message: 'PO ' + po.poNumber + ' sent for approval: ' + mailNote + '; WhatsApp sent to ' + directorPhone, waStatus });
        } catch(err) {
            console.error('WhatsApp block error:', err);
            res.json({ success: true, message: 'PO ' + po.poNumber + ' sent for approval: ' + mailNote + '; WhatsApp NOT sent: ' + err.message });
        }
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});



// Admin dashboard charts: approved PO spend, current year (AdminDashboard.jsx) - 28-Oct-2026
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
async function approvedThisYear(req) {
    const { Op } = require('sequelize');
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    return PurchaseOrder.findAll({ where: { status: 'Approved', date: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } }, attributes: ['date', 'category', 'totalAmount'] });
}
router.get('/dashboard/month-wise-expenses', async (req, res) => {
    try {
        const sums = new Array(12).fill(0);
        for (const p of await approvedThisYear(req)) { const m = new Date(p.date).getMonth(); if (m >= 0) sums[m] += Number(p.totalAmount) || 0; }
        res.json(MONTHS.map((month, i) => ({ month, expense: Math.round(sums[i] * 100) / 100 })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/dashboard/category-wise-expenses', async (req, res) => {
    try {
        const sums = {};
        for (const p of await approvedThisYear(req)) { const c = p.category || 'Other'; sums[c] = (sums[c] || 0) + (Number(p.totalAmount) || 0); }
        res.json(Object.entries(sums).map(([category, expense]) => ({ category, expense: Math.round(expense * 100) / 100 })).sort((a, b) => b.expense - a.expense));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark a PO item as received into stock (Asset Management → Inward) - 28-Oct-2026
router.put('/items/:id/receive', async (req, res) => {
    try {
        const item = await POItem.findByPk(req.params.id, { include: [{ model: PurchaseOrder }] });
        if (!item) return res.status(404).json({ error: 'PO item not found' });
        if (item.PurchaseOrder && item.PurchaseOrder.status !== 'Approved') return res.status(400).json({ error: 'PO is not approved' });
        if (item.isReceived) return res.status(409).json({ error: 'Item already received' });
        await item.update({ isReceived: true, receivedAt: new Date() });
        res.json({ success: true, item });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Item name suggestions with the last purchase (AdvancedPO form) - 28-Oct-2026
router.get('/item-history/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (q.length < 2) return res.json([]);
        const { Op } = require('sequelize');
        const rows = await POItem.findAll({ where: { itemName: { [Op.like]: `%${q}%` } }, include: [{ model: PurchaseOrder, attributes: ['poNumber', 'createdAt'] }], order: [['createdAt', 'DESC']], limit: 50 });
        const seen = new Set(); const out = [];
        for (const r of rows) {
            const k = r.itemName.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
            out.push({ itemName: r.itemName, unitPrice: r.unitPrice, gstRate: r.gstRate, lastPurchased: r.PurchaseOrder ? r.PurchaseOrder.createdAt : r.createdAt, poNumber: r.PurchaseOrder ? r.PurchaseOrder.poNumber : '' });
            if (out.length >= 8) break;
        }
        res.json(out);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single PO
router.get('/:id', async (req, res) => {
    try {
        const po = await PurchaseOrder.findByPk(req.params.id, {
            include: [{ model: POItem, as: 'items' }, { model: Vendor }]
        });
        if (!po) return res.status(404).json({ error: 'PO not found' });
        res.json(po);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE PO
router.delete('/:id', async (req, res) => {
    try {
        const po = await PurchaseOrder.findByPk(req.params.id);
        if (!po) return res.status(404).json({ error: 'PO not found' });
        await po.destroy();
        res.json({ success: true, message: 'PO deleted successfully' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ACTION GET (For WhatsApp/Email Approval Links)
async function publicAction(req, res) {
    try {
        const action = req.query.action;
        const sig = String(req.query.sig || '');
        const exp = parseInt(req.query.exp, 10) || 0;
        if (exp && exp * 1000 < Date.now()) return res.status(410).send('This approval link has expired. Please open the PO in EagleView ERP.');
        if (!exp && Date.now() > LEGACY_LINKS_UNTIL) return res.status(410).send('This approval link is too old. Please open the PO in EagleView ERP.');
        const good = actionSig(req.params.id, action, exp, String(req.query.by || ''));
        if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return res.status(403).send('This approval link is not valid. Please open the PO in EagleView ERP.');
        const po = await PurchaseOrder.findByPk(req.params.id);
        if (!po) return res.status(404).send('Purchase Order not found');
        if (['Approved', 'Rejected'].includes(po.status)) return res.send(`PO ${po.poNumber} is already ${po.status}. No change made.`);
        
        const byWhom = req.query.by ? decodeURIComponent(req.query.by) : 'DIRECT LINK';
        if (action === 'Approve') { po.status = 'Approved'; po.directorRemarks = 'APPROVED BY: ' + byWhom; po.actionAt = new Date(); }
        else if (action === 'Reject') { po.status = 'Rejected'; po.directorRemarks = 'REJECTED BY: ' + byWhom; po.actionAt = new Date(); }
        else if (action === 'Hold') { po.status = 'Hold'; po.directorRemarks = 'ON HOLD BY: ' + byWhom; po.actionAt = new Date(); }
    
        else return res.status(400).send('Invalid action');
        
        await po.save();
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PO ${po.status}</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f3f4f6; height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); text-align: center; max-width: 400px; width: 90%; margin: 20px; }
        .icon-container { width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .success { background-color: #dcfce7; color: #15803d; border: 4px solid #bbf7d0; }
        .error { background-color: #fee2e2; color: #b91c1c; border: 4px solid #fecaca; }
        .icon { font-size: 45px; font-weight: bold; }
        h1 { margin: 0 0 12px 0; color: #111827; font-size: 26px; }
        p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
        .po-badge { display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; padding: 8px 16px; border-radius: 30px; font-weight: 700; font-size: 15px; margin-bottom: 24px; letter-spacing: 0.5px; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02); }
        .footer-text { font-size: 14px; color: #9ca3af; margin-bottom: 0; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-container ${action === 'Approve' ? 'success' : 'error'} pulse">
            <span class="icon">${action === 'Approve' ? '?' : '?'}</span>
        </div>
        <h1>PO ${po.status}</h1>
        <div class="po-badge">${po.poNumber}</div>
        <p>Your action has been <b>successfully</b> recorded in the EagleView ERP system. The procurement team has been notified.</p>
        <p class="footer-text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M9 12l2 2 4-4"></path></svg>
            You can safely close this window
        </p>
    </div>
</body>
</html>
`);
    } catch(err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
}
router.get('/:id/action', publicAction);

// Approve / reject / hold from the portal (logged-in user) - used by the PO Approval page (28-Oct-2026)
router.put('/:id/action', async (req, res) => {
    try {
        const role = String((req.user && req.user.role) || '').toLowerCase();
        if (!['admin', 'director'].includes(role)) return res.status(403).json({ error: 'Only an admin or director can approve purchase orders' });
        const { status, remarks } = req.body || {};
        if (!['Approved', 'Rejected', 'Hold'].includes(status)) return res.status(400).json({ error: 'status must be Approved, Rejected or Hold' });
        const po = await PurchaseOrder.findByPk(req.params.id);
        if (!po) return res.status(404).json({ error: 'PO not found' });
        // 16-Nov-2026: same rule as the e-mail links - an approved or rejected PO is final; a draft was not sent for approval
        if (['Approved', 'Rejected'].includes(po.status)) return res.status(409).json({ error: `PO ${po.poNumber} is already ${po.status}` });
        if (po.status === 'Draft') return res.status(409).json({ error: `PO ${po.poNumber} is a draft - it was not sent for approval` });
        const note = String(remarks || '').trim().slice(0, 500);
        po.status = status;
        po.directorRemarks = `${status.toUpperCase()} BY: ${(req.user && (req.user.username || req.user.email)) || 'USER'}${note ? ' - ' + note : ''}`;
        po.actionAt = new Date();
        await po.save();
        res.json({ success: true, status: po.status });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});




// RESEND PO EMAIL & WHATSAPP
router.post('/:id/resend', async (req, res) => {
    try {
        const po = await PurchaseOrder.findByPk(req.params.id, {
            include: [{ model: POItem, as: 'items' }, { model: Vendor, as: 'Vendor' }]
        });
        if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

        const directorEmail = await getDirectorEmail();
        const os = require('os');
        let networkIP = req.hostname;
        if (networkIP === 'localhost' || networkIP === '127.0.0.1') {
            const interfaces = os.networkInterfaces();
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        networkIP = iface.address;
                    }
                }
            }
        }
        
        const origin = req.headers.origin || `http://${networkIP}:5173`;
        const frontendUrl = `${origin}/po-approval/${po.id}`;
        const base = await linkBase(req, networkIP); // 09-Nov-2026: the resend mail carries the same signed links

        // Send Email (Simplified for resend, or reuse full logic)
        let itemsHtml = `<table width="100%" border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
            <tr><th>Item Name</th><th>Qty</th><th>Unit Price (Rs)</th><th>Total (Rs)</th></tr>`;
        for (const i of po.items) {
            itemsHtml += `<tr><td>${i.itemName}</td><td>${i.quantity}</td><td>${i.unitPrice}</td><td>${(Number(i.quantity) * Number(i.unitPrice) + Number(i.gstAmount || 0)).toFixed(2)}</td></tr>`;
        }
        itemsHtml += `</table>`;

        const transporter = require('../utils/mailer').lazyTransport();
        let mailNote, waNote;

        await transporter.sendMail({
            from: `"EagleView ERP" <${process.env.SMTP_USER}>`,
            to: directorEmail,
            subject: `[RESEND] Approval Request: Purchase Order ${po.poNumber}`,
            html: `<h3>Purchase Order Approval (RESEND)</h3>
                   <p><strong>PO Number:</strong> ${po.poNumber}</p>
                   <p><strong>Vendor:</strong> ${po.Vendor ? po.Vendor.vendorName : 'N/A'}</p>
                   <p><strong>Total Amount:</strong> Rs. ${po.totalAmount}</p>
                   ${itemsHtml}
                   <br/>
                   <p>
                   <a href="${actionLink(base, po.id, 'Approve', directorEmail)}" style="padding: 10px 15px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin-right: 8px;">Approve</a>
                   <a href="${actionLink(base, po.id, 'Reject', directorEmail)}" style="padding: 10px 15px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin-right: 8px;">Reject</a>
                   <a href="${actionLink(base, po.id, 'Hold', directorEmail)}" style="padding: 10px 15px; background: #d97706; color: white; text-decoration: none; border-radius: 5px;">Hold</a>
                   </p>`
        }).then(() => { mailNote = 'e-mail sent to ' + directorEmail; }).catch(e => { console.error('Email error:', e); mailNote = 'e-mail to ' + directorEmail + ' FAILED: ' + e.message; });

        // WhatsApp
        try {
            const directorPhone = await getDirectorPhone();
            if (!directorPhone) throw new Error('Director WhatsApp number not set (DIRECTOR_PHONE in .env or App Setting PO_DIRECTOR_PHONE)');

            let itemLines = '';
            if (po.items && po.items.length > 0) {
                itemLines = po.items.map(item => `\uD83D\uDCE6 *${item.itemName}*\n  + Qty: ${item.quantity} | Rate: \u20B9${Number(item.unitPrice).toFixed(2)}`).join('\n\n');
            }

            const waMessage = `\uD83D\uDEA8 *[RESEND] PURCHASE ORDER APPROVAL* \uD83D\uDEA8\n\n\uD83D\uDCCC *PO Number:* ${po.poNumber}\n\uD83C\uDFE2 *Vendor:* ${po.Vendor ? po.Vendor.vendorName : 'N/A'}\n\uD83D\uDCB0 *Total Amount:* \u20B9${Number(po.totalAmount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n\n*\uD83D\uDCE6 Items Requested:*\n${itemLines}\n\n--------------------------------------\n*\u26A1 ACTION REQUIRED*\n\n\u2705 *To APPROVE this PO:*\n\uD83D\uDC49 ${origin}/api/po/${po.id}/action?action=Approve&by=${encodeURIComponent(directorPhone)}\n\n\u274C *To REJECT this PO:*\n\uD83D\uDC49 ${origin}/api/po/${po.id}/action?action=Reject&by=${encodeURIComponent(directorPhone)}\n--------------------------------------`;

            await require('../utils/WhatsappWebService').sendMessage(directorPhone, waMessage);
            waNote = 'WhatsApp sent to ' + directorPhone;
        } catch (waErr) {
            console.error('WhatsApp Resend Error:', waErr);
            waNote = 'WhatsApp NOT sent: ' + waErr.message;
        }

        res.json({ success: true, message: 'PO ' + po.poNumber + ' resent: ' + mailNote + '; ' + waNote });
    } catch (e) {
        console.error('Resend Error:', e);
        res.status(500).json({ success: false, message: 'Internal server error during resend' });
    }
});



module.exports = router;
module.exports.publicAction = publicAction;
