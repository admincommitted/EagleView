import { invoiceLinks } from '../../../../utils/common/invoiceLinks.js';
import { runSql, selectRows, selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { nowIso, todayIso } from '../shared/hubFormat.service.js';
import { ensurePurchaseInfoTable } from '../shared/hubTables.service.js';
import { loadGroupTree } from '../shared/groupTree.service.js';
import { findFinancialYear } from '../shared/financialYear.service.js';
import { badRequest, notFound } from '../shared/hubHttp.js';

const LIST_LIMIT = 500;

export const listVoucherTypes = () =>
  selectRows('SELECT id, name, baseType, prefix, numberingMethod FROM VoucherTypes ORDER BY id');

const like = (text) => '%' + text + '%';

function jobConditionOf(job) {
  if (job === 'yes') return "coalesce(v.jobNo, '') <> ''";
  if (job === 'no') return "coalesce(v.jobNo, '') = ''";
  return '';
}

// a voucher saved with the branch left blank belongs to the default branch
async function branchCondition(branch) {
  const defaultBranch = (
    await selectRowsOrEmpty('SELECT branchCode FROM CompanyBranches WHERE isDefault = 1 LIMIT 1')
  )[0];
  const isDefault =
    defaultBranch && String(defaultBranch.branchCode).toLowerCase().includes(String(branch).trim().toLowerCase());
  return isDefault ? "(v.branchCode LIKE ? OR coalesce(v.branchCode, '') = '')" : 'v.branchCode LIKE ?';
}

// Trade / Non Trade / RCM desks share the Purchase type - the desk saved with the bill tells them apart; a bill saved
// without a desk is an RCM bill when it has an RCM ledger
async function deskCondition(desk, jobCondition) {
  await ensurePurchaseInfoTable();
  const isRcmDesk = String(desk).endsWith('rcm');
  return `(EXISTS (SELECT 1 FROM AccPurchaseInfo pi WHERE pi.voucherId = v.id AND pi.desk = ?) OR (NOT EXISTS (SELECT 1 FROM AccPurchaseInfo pi2 WHERE pi2.voucherId = v.id AND coalesce(pi2.desk, '') <> '')
        AND ${isRcmDesk ? '' : 'NOT '}EXISTS (SELECT 1 FROM VoucherDetails d5 JOIN AccountLedgers l5 ON l5.id = d5.ledgerId WHERE d5.voucherId = v.id AND lower(l5.name) LIKE '%rcm%')${jobCondition ? ' AND ' + jobCondition : ''}))`;
}

// the register on the left of a voucher desk and the Search tab (iCAFFE): account, voucher no, ref / cheque no, job,
// branch, amount, status, narration
async function voucherListFilter(query, year) {
  const baseTypes = String(query.base || '')
    .split(',')
    .filter(Boolean);
  const where = ['v.date >= ?', 'v.date <= ?'];
  const replacements = [query.from || year.startDate, query.to || todayIso()];
  if (baseTypes.length) {
    where.push(`t.baseType IN (${baseTypes.map(() => '?').join(',')})`);
    replacements.push(...baseTypes);
  }
  const jobCondition = jobConditionOf(query.job);
  if (jobCondition && !query.desk) where.push(jobCondition);
  if (query.fcy === '1')
    where.push(
      "EXISTS (SELECT 1 FROM VoucherDetails d3 WHERE d3.voucherId = v.id AND coalesce(d3.currency, 'INR') <> 'INR')",
    );
  const text = String(query.q || '').trim();
  if (text) {
    where.push(
      '(v.voucherNumber LIKE ? OR v.refNo LIKE ? OR v.jobNo LIKE ? OR v.narration LIKE ? OR EXISTS (SELECT 1 FROM VoucherDetails d2 JOIN AccountLedgers l2 ON l2.id = d2.ledgerId WHERE d2.voucherId = v.id AND l2.name LIKE ?))',
    );
    replacements.push(like(text), like(text), like(text), like(text), like(text));
  }
  if (query.ledgerId) {
    where.push('EXISTS (SELECT 1 FROM VoucherDetails d4 WHERE d4.voucherId = v.id AND d4.ledgerId = ?)');
    replacements.push(Number(query.ledgerId));
  }
  if (query.vno) {
    where.push('v.voucherNumber LIKE ?');
    replacements.push(like(query.vno));
  }
  if (query.refNo) {
    where.push('v.refNo LIKE ?');
    replacements.push(like(query.refNo));
  }
  if (query.jobNo) {
    where.push('v.jobNo LIKE ?');
    replacements.push(like(query.jobNo));
  }
  if (query.branch) {
    where.push(await branchCondition(query.branch));
    replacements.push(like(query.branch));
  }
  if (query.desk) {
    where.push(await deskCondition(query.desk, jobCondition));
    replacements.push(String(query.desk));
  }
  if (query.narration) {
    where.push('v.narration LIKE ?');
    replacements.push(like(query.narration));
  }
  if (query.amount && isFinite(Number(query.amount))) {
    where.push('abs(v.totalAmount - ?) < 0.01');
    replacements.push(Number(query.amount));
  }
  if (query.status === 'Pending')
    where.push("coalesce(v.status, 'Pending') NOT IN ('Approved', 'Rejected', 'Returned')");
  else if (query.status) {
    where.push('v.status = ?');
    replacements.push(query.status);
  }
  return { where, replacements };
}

/** Vouchers of the filter, latest first, at most 500 (hasMore when there are more). */
export async function listVouchers(query) {
  const year = await findFinancialYear(query.fyId);
  const { where, replacements } = await voucherListFilter(query, year);
  const rows = await selectRows(
    `SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, v.narration, v.totalAmount, v.status, v.branchCode, v.createdByName, v.updatedAt, t.name typeName, t.baseType,
        (SELECT l.name FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = v.id AND d.dc = (CASE WHEN t.baseType IN ('Receipt', 'Purchase', 'Credit Note') THEN 'Cr' ELSE 'Dr' END) ORDER BY d.amount DESC LIMIT 1) party,
        (SELECT group_concat(l.name || '~' || d.dc || '~' || d.amount, '|') FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = v.id) accounts
        FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${where.join(' AND ')} ORDER BY v.date DESC, v.id DESC LIMIT ${LIST_LIMIT + 1}`,
    replacements,
  );
  const hasMore = rows.length > LIST_LIMIT;
  if (hasMore) rows.length = LIST_LIMIT;
  return { rows, hasMore };
}

async function addPurchaseDetails(voucher) {
  try {
    await ensurePurchaseInfoTable();
    voucher.purchase =
      (
        await selectRows(
          `SELECT p.*, b.voucherNumber againstNo, b.date againstDate FROM AccPurchaseInfo p LEFT JOIN Vouchers b ON b.id = p.againstVoucherId WHERE p.voucherId = ?`,
          [voucher.id],
        )
      )[0] || null;
    voucher.creditNotes = await selectRows(
      `SELECT v2.id, v2.voucherNumber, v2.date, v2.totalAmount, p.billNo FROM AccPurchaseInfo p JOIN Vouchers v2 ON v2.id = p.voucherId WHERE p.kind = 'cn' AND p.againstVoucherId = ?`,
      [voucher.id],
    );
  } catch {
    voucher.purchase = null;
    voucher.creditNotes = [];
  }
}

// the GST invoice behind this voucher, if any (for the Voucher Details side panel)
async function addGstInvoice(voucher) {
  try {
    voucher.gst = (await invoiceLinks([voucher.id])).get(Number(voucher.id)) || null;
  } catch {
    voucher.gst = null;
  }
}

/** A voucher with its lines, set-offs, purchase details, credit notes and GST invoice. */
export async function getVoucherDetails(voucherId) {
  const voucher = (
    await selectRows(
      `SELECT v.*, t.name typeName, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE v.id = ?`,
      [voucherId],
    )
  )[0];
  if (!voucher) throw notFound('Voucher not found');
  voucher.lines = await selectRows(
    `SELECT d.*, l.name ledgerName, g.name groupName FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE d.voucherId = ? ORDER BY d.id`,
    [voucher.id],
  );
  voucher.allocations = await selectRowsOrEmpty(
    `SELECT a.*, b.voucherNumber againstNo, b.date againstDate FROM VoucherAllocations a LEFT JOIN Vouchers b ON b.id = a.againstVoucherId WHERE a.voucherId = ?`,
    [voucher.id],
  );
  await addPurchaseDetails(voucher);
  await addGstInvoice(voucher);
  return voucher;
}

// standard GST / TDS / RCM ledgers under Duties & Taxes (created when missing) - used by the purchase bill desk
const TAX_LEDGERS = {
  inputIgst: ['Input IGST', 'Dr'],
  inputCgst: ['Input CGST', 'Dr'],
  inputSgst: ['Input SGST', 'Dr'],
  outputIgst: ['Output IGST', 'Cr'],
  outputCgst: ['Output CGST', 'Cr'],
  outputSgst: ['Output SGST', 'Cr'],
  rcmInput: ['RCM Input Tax A/c', 'Dr'],
  rcmPayable: ['RCM Tax Payable A/c', 'Cr'],
  tdsPayable: ['TDS Payable', 'Cr'],
  roundOff: ['Round Off', 'Dr'],
};

const findLedgerNamed = async (name) =>
  (await selectRows('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?)', [name]))[0];

async function createLedgerIfMissing(name, groupId, balanceType) {
  const existing = await findLedgerNamed(name);
  if (existing) return existing.id;
  const stamp = nowIso();
  try {
    await runSql(
      'INSERT INTO AccountLedgers (name, groupId, openingBalance, balanceType, createdAt, updatedAt) VALUES (?,?,0,?,?,?)',
      [name, groupId, balanceType, stamp, stamp],
    );
  } catch {
    // made by a request running alongside
  }
  return (await findLedgerNamed(name)).id;
}

/** Ids of the standard tax ledgers by key ({ inputIgst, ..., roundOff }). */
export async function ensureTaxLedgers() {
  const { groups } = await loadGroupTree();
  const dutiesAndTaxes =
    groups.find((group) => group.name.toLowerCase().trim() === 'duties & taxes') ||
    groups.find((group) => group.nature === 'Liabilities');
  const indirectExpenses =
    groups.find((group) => group.name.toLowerCase().trim() === 'indirect expenses') || dutiesAndTaxes;
  if (!dutiesAndTaxes) throw badRequest("Account group 'Duties & Taxes' not found");
  const ledgerIds = {};
  for (const [key, [name, balanceType]] of Object.entries(TAX_LEDGERS)) {
    const groupId = key === 'roundOff' ? indirectExpenses.id : dutiesAndTaxes.id;
    ledgerIds[key] = await createLedgerIfMissing(name, groupId, balanceType);
  }
  return ledgerIds;
}

/** Ledgers of some groups (bank / cash, debtors, creditors ...) or natures; every ledger when none is named. */
export async function listLedgersInGroups(query) {
  const { groups, descendants } = await loadGroupTree();
  const groupNames = String(query.groups || '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const natures = String(query.nature || '')
    .split(',')
    .filter(Boolean);
  const rootIds = groups
    .filter(
      (group) =>
        groupNames.includes(group.name.toLowerCase().trim()) || (natures.includes(group.nature) && !group.parentId),
    )
    .map((group) => group.id);
  const groupIds = descendants(rootIds);
  const ledgers = await selectRows(
    'SELECT l.id, l.name, l.groupId, l.gstin, l.state, l.creditDays, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId ORDER BY l.name',
  );
  return rootIds.length ? ledgers.filter((ledger) => groupIds.has(ledger.groupId)) : ledgers;
}
