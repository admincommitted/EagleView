import { Op } from 'sequelize';
import { ApiError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../core/http/index.js';
import { POItem, PurchaseOrder, Vendor } from '../../../models/index.js';
import { ensureColumns } from '../../../utils/db/ensureColumns.js';
import { sendMail } from '../../../utils/integrations/mailer.js';
import { sendMessage as sendWhatsappMessage } from '../../../utils/integrations/WhatsappWebService.js';
import {
  LEGACY_LINKS_VALID_UNTIL,
  actionSignature,
  approvalLinkBase,
  directorEmail,
  directorPhone,
  frontendOriginOf,
  networkAddressOf,
  signatureMatches,
} from './shared/approvalLinks.js';
import {
  FIRST_TIME_BUY_HTML,
  actionResultPage,
  alreadyDecidedText,
  approvalItemRowHtml,
  approvalItemsTableHtml,
  approvalMailHtml,
  approvalWhatsappItemLine,
  approvalWhatsappText,
  lastPurchaseHtml,
  resendItemsTableHtml,
  resendMailHtml,
  resendWhatsappItemLine,
  resendWhatsappText,
} from './shared/approvalMessages.js';
import { quoteFileUrl } from './shared/quoteUpload.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DECIDED_STATUSES = ['Approved', 'Rejected'];
const PORTAL_DECISIONS = ['Approved', 'Rejected', 'Hold'];
const APPROVER_ROLES = ['admin', 'director'];
const LINK_ACTIONS = {
  Approve: { status: 'Approved', remarksPrefix: 'APPROVED BY: ' },
  Reject: { status: 'Rejected', remarksPrefix: 'REJECTED BY: ' },
  Hold: { status: 'Hold', remarksPrefix: 'ON HOLD BY: ' },
};
const MAX_REMARKS_LENGTH = 500;
const MIN_SEARCH_LENGTH = 2;
const HISTORY_ROWS = 50;
const HISTORY_SUGGESTIONS = 8;
const HTTP_GONE = 410;
const NO_DIRECTOR_PHONE = 'Director WhatsApp number not set (DIRECTOR_PHONE in .env or App Setting PO_DIRECTOR_PHONE)';

const errorBody = (message) => ({ body: { error: message } });
const mailFrom = () => `"EagleView ERP" <${process.env.SMTP_USER}>`;
const round2 = (value) => Math.round(value * 100) / 100;

async function syncAddOnly(model) {
  try {
    await model.sync();
    await ensureColumns(model);
  } catch (error) {
    console.warn('[PO] sync warning:', error.message);
  }
}

/** Startup: creates the vendor / PO tables and adds missing columns (add-only, never rebuilds a table). */
export function initPurchaseOrderTables() {
  return Promise.all([Vendor, PurchaseOrder, POItem].map(syncAddOnly));
}

export const listPurchaseOrders = () =>
  PurchaseOrder.findAll({
    include: [Vendor, { model: POItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
  });

function lineAmounts(item) {
  const base = Number(item.quantity) * Number(item.unitPrice);
  const gstAmount = base * (Number(item.gstRate || 0) / 100);
  return { base, gstAmount, lineTotal: base + gstAmount };
}

const grandTotalOf = (items) => items.reduce((total, item) => total + lineAmounts(item).lineTotal, 0);

/** PO-<year>-0001, following the last PO when it is of this year. */
async function nextPoNumber() {
  const year = new Date().getFullYear();
  const lastPo = await PurchaseOrder.findOne({ order: [['id', 'DESC']] });
  let serial = 1;
  if (lastPo && lastPo.poNumber) {
    const parts = lastPo.poNumber.split('-');
    if (parts.length === 3 && Number(parts[1]) === year) serial = parseInt(parts[2], 10) + 1;
  }
  return `PO-${year}-${String(serial).padStart(4, '0')}`;
}

async function lastPurchaseText(itemName) {
  const lastPurchase = await POItem.findOne({
    where: { itemName },
    include: [{ model: PurchaseOrder, attributes: ['createdAt', 'poNumber'] }],
    order: [['createdAt', 'DESC']],
  });
  return lastPurchase && lastPurchase.PurchaseOrder ? lastPurchaseHtml(lastPurchase) : FIRST_TIME_BUY_HTML;
}

async function approvalItemsHtml(items, po) {
  let rowsHtml = '';
  for (const [index, item] of items.entries()) {
    rowsHtml += approvalItemRowHtml({
      item,
      lastPurchaseText: await lastPurchaseText(item.itemName),
      rowBackground: index % 2 === 0 ? '#ffffff' : '#f8fafc',
      lineTotal: lineAmounts(item).lineTotal,
    });
  }
  return approvalItemsTableHtml(rowsHtml, po);
}

/** Sends the mail and says whether it went (the screen shows it). */
async function mailNoteAfterSending(mail, to) {
  try {
    await sendMail(mail);
    return 'e-mail sent to ' + to;
  } catch (error) {
    console.error('Email error:', error);
    return 'e-mail to ' + to + ' FAILED: ' + error.message;
  }
}

async function requireDirectorPhone() {
  const phone = await directorPhone();
  if (!phone) throw new Error(NO_DIRECTOR_PHONE);
  return phone;
}

async function approvalLinkContext(requestInfo) {
  const networkAddress = networkAddressOf(requestInfo.hostname);
  const origin = frontendOriginOf(requestInfo.origin, networkAddress);
  const linkBase = await approvalLinkBase(requestInfo.localPort, networkAddress);
  return { origin, linkBase };
}

async function sendApprovalWhatsapp({ po, vendor, items, backendUrl }) {
  try {
    const phone = await requireDirectorPhone();
    const itemsString = items.map(approvalWhatsappItemLine).join('\n');
    const message = approvalWhatsappText({ po, vendor, itemsString, backendUrl, directorPhone: phone });
    const waStatus = await sendWhatsappMessage(phone, message);
    return { note: 'WhatsApp sent to ' + phone, waStatus };
  } catch (error) {
    console.error('WhatsApp block error:', error);
    return { note: 'WhatsApp NOT sent: ' + error.message };
  }
}

async function createItems(poId, items) {
  for (const item of items) {
    await POItem.create({
      PO_ID: poId,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: item.gstRate || 0,
      gstAmount: lineAmounts(item).gstAmount,
    });
  }
}

/**
 * A new purchase order (Pending Approval) with its items; the director gets the approval request by e-mail and
 * WhatsApp with signed Approve / Reject (/ Hold) links.
 */
export async function createPurchaseOrder(form, quoteFile, requestInfo) {
  const { vendorId, justification, branch, category, priority, items } = form;
  const parsedItems = JSON.parse(items);
  const grandTotal = grandTotalOf(parsedItems);
  const po = await PurchaseOrder.create({
    poNumber: await nextPoNumber(),
    date: new Date(),
    VendorID: vendorId,
    totalAmount: grandTotal,
    status: 'Pending Approval',
    submittedAt: new Date(),
    justification,
    branch,
    category,
    priority,
    quoteFilePath: quoteFileUrl(quoteFile),
  });
  await createItems(po.id, parsedItems);

  const vendor = await Vendor.findByPk(vendorId);
  const mailTo = await directorEmail();
  const { origin, linkBase: backendUrl } = await approvalLinkContext(requestInfo);
  const frontendUrl = `${origin}/po-approval/${po.id}`;
  const itemsHtml = await approvalItemsHtml(parsedItems, po);
  const mailNote = await mailNoteAfterSending(
    {
      from: mailFrom(),
      to: mailTo,
      subject: `Approval Request: Purchase Order ${po.poNumber}`,
      html: approvalMailHtml({ po, vendor, itemsHtml, backendUrl, directorEmail: mailTo, frontendUrl }),
    },
    mailTo,
  );
  const whatsapp = await sendApprovalWhatsapp({ po, vendor, items: parsedItems, backendUrl });
  const message = 'PO ' + po.poNumber + ' sent for approval: ' + mailNote + '; ' + whatsapp.note;
  return { success: true, message, waStatus: whatsapp.waStatus };
}

function approvedOrdersOfYear(yearValue) {
  const year = parseInt(yearValue, 10) || new Date().getFullYear();
  return PurchaseOrder.findAll({
    where: { status: 'Approved', date: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } },
    attributes: ['date', 'category', 'totalAmount'],
  });
}

/** Approved PO spend of the year, month by month (Admin dashboard chart). */
export async function monthWiseExpenses(yearValue) {
  const sums = Array.from({ length: 12 }, () => 0);
  for (const order of await approvedOrdersOfYear(yearValue)) {
    const month = new Date(order.date).getMonth();
    if (month >= 0) sums[month] += Number(order.totalAmount) || 0;
  }
  return MONTHS.map((month, index) => ({ month, expense: round2(sums[index]) }));
}

/** Approved PO spend of the year by category, largest first (Admin dashboard chart). */
export async function categoryWiseExpenses(yearValue) {
  const sums = {};
  for (const order of await approvedOrdersOfYear(yearValue)) {
    const category = order.category || 'Other';
    sums[category] = (sums[category] || 0) + (Number(order.totalAmount) || 0);
  }
  return Object.entries(sums)
    .map(([category, expense]) => ({ category, expense: round2(expense) }))
    .sort((a, b) => b.expense - a.expense);
}

/** Marks a PO item as received into stock (Asset Management > Inward). */
export async function receiveItem(itemId) {
  const item = await POItem.findByPk(itemId, { include: [{ model: PurchaseOrder }] });
  if (!item) throw new NotFoundError('PO item not found', errorBody('PO item not found'));
  if (item.PurchaseOrder && item.PurchaseOrder.status !== 'Approved') {
    throw new BadRequestError('PO is not approved', errorBody('PO is not approved'));
  }
  if (item.isReceived) throw new ConflictError('Item already received', errorBody('Item already received'));
  await item.update({ isReceived: true, receivedAt: new Date() });
  return { success: true, item };
}

/** Item name suggestions with the last purchase (one per name, newest first). */
export async function searchItemHistory(searchValue) {
  const search = String(searchValue || '').trim();
  if (search.length < MIN_SEARCH_LENGTH) return [];
  const rows = await POItem.findAll({
    where: { itemName: { [Op.like]: `%${search}%` } },
    include: [{ model: PurchaseOrder, attributes: ['poNumber', 'createdAt'] }],
    order: [['createdAt', 'DESC']],
    limit: HISTORY_ROWS,
  });
  const seen = new Set();
  const suggestions = [];
  for (const row of rows) {
    const key = row.itemName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      itemName: row.itemName,
      unitPrice: row.unitPrice,
      gstRate: row.gstRate,
      lastPurchased: row.PurchaseOrder ? row.PurchaseOrder.createdAt : row.createdAt,
      poNumber: row.PurchaseOrder ? row.PurchaseOrder.poNumber : '',
    });
    if (suggestions.length >= HISTORY_SUGGESTIONS) break;
  }
  return suggestions;
}

export async function getPurchaseOrder(poId) {
  const po = await PurchaseOrder.findByPk(poId, { include: [{ model: POItem, as: 'items' }, { model: Vendor }] });
  if (!po) throw new NotFoundError('PO not found', errorBody('PO not found'));
  return po;
}

export async function deletePurchaseOrder(poId) {
  const po = await PurchaseOrder.findByPk(poId);
  if (!po) throw new NotFoundError('PO not found', errorBody('PO not found'));
  await po.destroy();
  return { success: true, message: 'PO deleted successfully' };
}

function assertLinkIsGenuine(poId, query) {
  const signature = String(query.sig || '');
  const expiresAt = parseInt(query.exp, 10) || 0;
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    throw new ApiError(HTTP_GONE, 'This approval link has expired. Please open the PO in EagleView ERP.');
  }
  if (!expiresAt && Date.now() > LEGACY_LINKS_VALID_UNTIL) {
    throw new ApiError(HTTP_GONE, 'This approval link is too old. Please open the PO in EagleView ERP.');
  }
  const expected = actionSignature(poId, query.action, expiresAt, String(query.by || ''));
  if (!signatureMatches(signature, expected)) {
    throw new ForbiddenError('This approval link is not valid. Please open the PO in EagleView ERP.');
  }
}

/**
 * The Approve / Reject / Hold link from the e-mail / WhatsApp (opened without login). Returns the page to show;
 * a refused link throws an ApiError whose message is the text to show.
 */
export async function applyLinkAction(poId, query) {
  assertLinkIsGenuine(poId, query);
  const po = await PurchaseOrder.findByPk(poId);
  if (!po) throw new NotFoundError('Purchase Order not found');
  if (DECIDED_STATUSES.includes(po.status)) return alreadyDecidedText(po);
  const decidedBy = query.by ? decodeURIComponent(query.by) : 'DIRECT LINK';
  const isKnownAction = typeof query.action === 'string' && Object.hasOwn(LINK_ACTIONS, query.action);
  if (!isKnownAction) throw new BadRequestError('Invalid action');
  const linkAction = LINK_ACTIONS[query.action];
  po.status = linkAction.status;
  po.directorRemarks = linkAction.remarksPrefix + decidedBy;
  po.actionAt = new Date();
  await po.save();
  return actionResultPage(po, query.action);
}

/** Approve / reject / hold from the PO Approval page (a logged-in admin or director). */
export async function decideFromPortal(poId, body, { role, actorName }) {
  if (!APPROVER_ROLES.includes(role)) {
    throw new ForbiddenError(
      'Only an admin or director can approve purchase orders',
      errorBody('Only an admin or director can approve purchase orders'),
    );
  }
  const { status, remarks } = body || {};
  if (!PORTAL_DECISIONS.includes(status)) {
    throw new BadRequestError(
      'status must be Approved, Rejected or Hold',
      errorBody('status must be Approved, Rejected or Hold'),
    );
  }
  const po = await PurchaseOrder.findByPk(poId);
  if (!po) throw new NotFoundError('PO not found', errorBody('PO not found'));
  // same rule as the e-mail links: an approved or rejected PO is final; a draft was not sent for approval
  if (DECIDED_STATUSES.includes(po.status)) {
    const message = `PO ${po.poNumber} is already ${po.status}`;
    throw new ConflictError(message, errorBody(message));
  }
  if (po.status === 'Draft') {
    const message = `PO ${po.poNumber} is a draft - it was not sent for approval`;
    throw new ConflictError(message, errorBody(message));
  }
  const note = String(remarks || '')
    .trim()
    .slice(0, MAX_REMARKS_LENGTH);
  po.status = status;
  po.directorRemarks = `${status.toUpperCase()} BY: ${actorName}${note ? ' - ' + note : ''}`;
  po.actionAt = new Date();
  await po.save();
  return { success: true, status: po.status };
}

async function sendResendWhatsapp(po, origin) {
  try {
    const phone = await requireDirectorPhone();
    const itemLines = po.items && po.items.length > 0 ? po.items.map(resendWhatsappItemLine).join('\n\n') : '';
    await sendWhatsappMessage(phone, resendWhatsappText({ po, itemLines, origin, directorPhone: phone }));
    return 'WhatsApp sent to ' + phone;
  } catch (error) {
    console.error('WhatsApp Resend Error:', error);
    return 'WhatsApp NOT sent: ' + error.message;
  }
}

/** Sends the approval request (e-mail and WhatsApp) for a PO again. */
export async function resendApprovalRequest(poId, requestInfo) {
  const po = await PurchaseOrder.findByPk(poId, {
    include: [
      { model: POItem, as: 'items' },
      { model: Vendor, as: 'Vendor' },
    ],
  });
  if (!po) throw new NotFoundError('PO not found', { body: { success: false, message: 'PO not found' } });
  const mailTo = await directorEmail();
  const { origin, linkBase } = await approvalLinkContext(requestInfo);
  const itemsHtml = resendItemsTableHtml(po.items);
  const mailNote = await mailNoteAfterSending(
    {
      from: mailFrom(),
      to: mailTo,
      subject: `[RESEND] Approval Request: Purchase Order ${po.poNumber}`,
      html: resendMailHtml({ po, itemsHtml, base: linkBase, directorEmail: mailTo }),
    },
    mailTo,
  );
  const whatsappNote = await sendResendWhatsapp(po, origin);
  return { success: true, message: 'PO ' + po.poNumber + ' resent: ' + mailNote + '; ' + whatsappNote };
}
