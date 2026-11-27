import { VALID_VOUCHER, selectRows, selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { round2, toNumber } from '../shared/hubFormat.service.js';
import { groupIdsNamed, loadGroupTree } from '../shared/groupTree.service.js';
import { ensurePurchaseInfoTable } from '../shared/hubTables.service.js';
import { jobKey, loadJobDetails } from './jobDetails.service.js';

const ID_BATCH = 800;
const DEFAULT_LATEST_COUNT = 100;
const MAX_LATEST_COUNT = 5000;

const baseTypeMarks = (baseTypes) => baseTypes.map(() => '?').join(',');

/** Parties = ledgers under Sundry Debtors / Creditors; taxes = ledgers under Duties & Taxes. */
function partyAndTaxGroups({ groups, descendants }) {
  return {
    partyGroups: descendants([
      ...groupIdsNamed(groups, 'sundry debtors'),
      ...groupIdsNamed(groups, 'sundry creditors'),
    ]),
    taxGroups: descendants(groupIdsNamed(groups, 'duties & taxes')),
  };
}

async function selectInBatches(ids, buildSql, { orEmpty = false } = {}) {
  const rows = [];
  for (let index = 0; index < ids.length; index += ID_BATCH) {
    const sql = buildSql(ids.slice(index, index + ID_BATCH).join(','));
    rows.push(...(orEmpty ? await selectRowsOrEmpty(sql) : await selectRows(sql)));
  }
  return rows;
}

/** Voucher register of one or more base types with party, taxable value, GST / TDS split and foreign currency. */
export async function voucherRegister(baseTypes, from, to, options = {}) {
  const { partyGroups, taxGroups } = partyAndTaxGroups(await loadGroupTree());
  const vouchers = await selectRows(
    `SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, v.narration, v.totalAmount, v.status, t.name typeName, t.baseType
      FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE ${VALID_VOUCHER} AND t.baseType IN (${baseTypeMarks(baseTypes)}) AND v.date >= ? AND v.date <= ? ORDER BY v.date, v.id`,
    [...baseTypes, from, to],
  );
  if (!vouchers.length) return [];
  const ids = vouchers.map((voucher) => voucher.id);
  const details =
    await selectRows(`SELECT d.voucherId, d.dc, d.amount, d.currency, d.amountFcy, d.roe, l.id ledgerId, l.name ledgerName, l.groupId, l.gstin
      FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId IN (${ids.join(',')})`);
  const linesByVoucher = groupLinesByVoucher(details, (line) => line);
  return vouchers.map((voucher) => {
    const lines = linesByVoucher.get(voucher.id) || [];
    const party = lines.find((line) => partyGroups.has(line.groupId)) || null;
    const tax = lines.filter((line) => taxGroups.has(line.groupId));
    const taxAmount = (pattern) =>
      round2(tax.filter((line) => pattern.test(line.ledgerName)).reduce((sum, line) => sum + toNumber(line.amount), 0));
    const gross = party ? toNumber(party.amount) : toNumber(voucher.totalAmount);
    const foreign = lines.find((line) => line.currency && line.currency !== 'INR' && line.amountFcy);
    const taxable = round2(
      lines
        .filter((line) => line !== party && !taxGroups.has(line.groupId))
        .reduce((sum, line) => sum + toNumber(line.amount), 0),
    );
    return {
      ...voucher,
      partyId: party && party.ledgerId,
      partyName: party ? party.ledgerName : '',
      gstin: party ? party.gstin : '',
      taxable,
      igst: taxAmount(/igst|integrated/i),
      cgst: taxAmount(/cgst|central/i),
      sgst: taxAmount(/sgst|utgst|state/i),
      tds: taxAmount(/tds/i),
      total: round2(gross),
      currency: foreign ? foreign.currency : 'INR',
      amountFcy: foreign ? round2(foreign.amountFcy) : null,
      roe: foreign ? toNumber(foreign.roe) : null,
      lines: options.lines ? lines : undefined,
    };
  });
}

function groupLinesByVoucher(details, shape) {
  const byVoucher = new Map();
  for (const line of details) {
    if (!byVoucher.has(line.voucherId)) byVoucher.set(line.voucherId, []);
    byVoucher.get(line.voucherId).push(shape(line));
  }
  return byVoucher;
}

// search in SQL (party name, any text) and "latest N only", so a register need not load the whole year
async function voucherFilter(baseTypes, from, to, options) {
  const where = [VALID_VOUCHER, `t.baseType IN (${baseTypeMarks(baseTypes)})`, 'v.date >= ?', 'v.date <= ?'];
  const replacements = [...baseTypes, from, to];
  if (options.jobNo) {
    where.push('v.jobNo LIKE ?');
    replacements.push('%' + options.jobNo + '%');
  }
  if (options.party) {
    where.push(
      'EXISTS (SELECT 1 FROM VoucherDetails dp JOIN AccountLedgers lp ON lp.id = dp.ledgerId WHERE dp.voucherId = v.id AND lower(lp.name) LIKE ?)',
    );
    replacements.push('%' + String(options.party).toLowerCase() + '%');
  }
  if (options.q) {
    const { condition, values } = await textSearchCondition(options);
    where.push(condition);
    replacements.push(...values);
  }
  return { where, replacements };
}

async function textSearchCondition(options) {
  const text = '%' + String(options.q).trim().toLowerCase() + '%';
  const amount = Number(String(options.q).replace(/,/g, ''));
  const alternatives = [
    'lower(v.voucherNumber) LIKE ?',
    "lower(coalesce(v.refNo, '')) LIKE ?",
    "lower(coalesce(v.jobNo, '')) LIKE ?",
    "lower(coalesce(v.narration, '')) LIKE ?",
    'EXISTS (SELECT 1 FROM VoucherDetails dq JOIN AccountLedgers lq ON lq.id = dq.ledgerId WHERE dq.voucherId = v.id AND lower(lq.name) LIKE ?)',
  ];
  const values = [text, text, text, text, text];
  if (options.purchaseInfo) {
    await ensurePurchaseInfoTable();
    alternatives.push(
      "EXISTS (SELECT 1 FROM AccPurchaseInfo pq WHERE pq.voucherId = v.id AND (lower(coalesce(pq.billNo, '')) LIKE ? OR lower(coalesce(pq.hblNo, '')) LIKE ? OR lower(coalesce(pq.mblNo, '')) LIKE ?))",
    );
    values.push(text, text, text);
  }
  if (isFinite(amount) && amount > 0) {
    alternatives.push('abs(v.totalAmount - ?) < 0.01');
    values.push(amount);
  }
  return { condition: '(' + alternatives.join(' OR ') + ')', values };
}

async function purchaseInfoByVoucher(ids) {
  await ensurePurchaseInfoTable();
  const rows = await selectInBatches(ids, (list) => `SELECT * FROM AccPurchaseInfo WHERE voucherId IN (${list})`);
  return new Map(rows.map((row) => [row.voucherId, row]));
}

async function documentCountByVoucher(ids) {
  const rows = await selectInBatches(
    ids,
    (list) => `SELECT voucherId, count(*) n FROM VoucherDocuments WHERE voucherId IN (${list}) GROUP BY voucherId`,
    { orEmpty: true },
  );
  return new Map(rows.map((row) => [row.voucherId, row.n]));
}

/**
 * One entry per voucher with every line split into party / tax / other ledgers - the base of the iCAFFE registers.
 * Options: jobNo, party, q (text search), limit (latest N, oldest first), purchaseInfo, docs, partySide(voucher).
 * Answers { vs: [{ v, ds, party, tax, other, fcy, job, info, docs }], partyGroups, taxGroups, path, total }.
 */
export async function voucherLines(baseTypes, from, to, options = {}) {
  const groupTree = await loadGroupTree();
  const { partyGroups, taxGroups } = partyAndTaxGroups(groupTree);
  const { path } = groupTree;
  const { where, replacements } = await voucherFilter(baseTypes, from, to, options);
  let total = null;
  if (options.limit)
    total = (
      await selectRows(
        `SELECT count(*) n FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${where.join(' AND ')}`,
        replacements,
      )
    )[0].n;
  const order = options.limit
    ? 'v.date DESC, v.id DESC LIMIT ' +
      Math.max(1, Math.min(MAX_LATEST_COUNT, Number(options.limit) || DEFAULT_LATEST_COUNT))
    : 'v.date, v.id';
  let vouchers = await selectRows(
    `SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, v.narration, v.totalAmount, v.status, v.branchCode, t.name typeName, t.baseType
      FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${where.join(' AND ')} ORDER BY ${order}`,
    replacements,
  );
  if (options.limit) vouchers = vouchers.reverse();
  if (!vouchers.length) return { vs: [], partyGroups, taxGroups, path, total };
  const ids = vouchers.map((voucher) => voucher.id);
  const details = await selectInBatches(
    ids,
    (
      list,
    ) => `SELECT d.voucherId, d.dc, d.amount, d.currency, d.amountFcy, d.roe, d.remarks, l.id ledgerId, l.name ledgerName, l.groupId, l.gstin
      FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId IN (${list}) ORDER BY d.id`,
  );
  const linesByVoucher = groupLinesByVoucher(details, (line) => ({ ...line, amount: toNumber(line.amount) }));
  const jobs = await loadJobDetails(vouchers.map((voucher) => voucher.jobNo));
  const purchaseInfo = options.purchaseInfo ? await purchaseInfoByVoucher(ids) : new Map();
  const documents = options.docs ? await documentCountByVoucher(ids) : new Map();
  const entries = vouchers.map((voucher) => {
    const lines = linesByVoucher.get(voucher.id) || [];
    const party =
      lines.find(
        (line) => partyGroups.has(line.groupId) && (!options.partySide || line.dc === options.partySide(voucher)),
      ) ||
      lines.find((line) => partyGroups.has(line.groupId)) ||
      null;
    return {
      v: voucher,
      ds: lines,
      party,
      tax: lines.filter((line) => line !== party && taxGroups.has(line.groupId)),
      other: lines.filter((line) => line !== party && !taxGroups.has(line.groupId)),
      fcy: lines.find((line) => line.currency && line.currency !== 'INR' && line.amountFcy),
      job: jobs.get(jobKey(voucher.jobNo)),
      info: purchaseInfo.get(voucher.id),
      docs: documents.get(voucher.id) || 0,
    };
  });
  return { vs: entries, partyGroups, taxGroups, path, total };
}
