import { current as currentBranchScope } from '../../../../middlewares/branchScope.middleware.js';
import { firstIssueMessage } from '../../shared/firstIssue.js';
import {
  DELETED_INVOICES_TABLE_SQL,
  badRequest,
  ensureInvoiceTables,
  invoiceNotFound,
  nowIso,
  parseJsonList,
  round2,
  runSql,
  selectRows,
  startTransaction,
  toNumber,
} from '../shared/invoiceDb.js';
import {
  CREDIT_NOTE,
  FOREIGN_POS,
  ICAFFE_VIEW_ONLY_MESSAGE,
  KINDS,
  VOID,
  fromIcaffe,
  realRemark,
} from '../shared/invoiceKinds.js';
import { divisionOfInvoice, invoiceNumberFor } from '../shared/invoiceNumbering.js';
import { ourGst } from '../shared/ourCompany.js';
import { partyLedgerOrRefuse } from '../shared/partyLedger.js';
import { icaffeView } from './icaffeView.service.js';
import { computeInvoice, postingLines, writeVoucherDetails } from './invoicePosting.service.js';
import { salesInvoiceSchema } from './salesInvoice.validation.js';

const SEARCH_LIMIT = 500;
const MAX_NARRATION_LENGTH = 500;
const AMOUNT_TOLERANCE = 0.01;
const SET_OFF_EPSILON = 0.009;
const APPROVED = 'Approved';
const ICAFFE_USER = 'iCAFFE';

const HEAD_KEYS = [
  'kind',
  'date',
  'branchCode',
  'partyType',
  'partyName',
  'partyId',
  'partyBranchId',
  'address',
  'gstin',
  'stateName',
  'stateCode',
  'pos',
  'posName',
  'sez',
  'paymentOption',
  'countryCode',
  'currency',
  'exRate',
  'costCentre',
  'roundOff',
  'gstExempt',
  'hideExRate',
  'rcm',
  'withOut',
  'prevInvoiceId',
  'prevInvoiceNo',
  'prevInvoiceDate',
  'reason',
  'docketBy',
  'jobNo',
  'hawbNo',
  'mawbNo',
  'quotationNo',
  'email',
  'advance',
  'remarks',
  'bulk',
  'dockets',
  'division',
];

const invoiceKindLabel = (kind) => (KINDS[kind] || {}).label || kind;
const lastValue = (value) => (Array.isArray(value) ? value[value.length - 1] : value);
const isWithoutPayment = (row) => /without/i.test(row.paymentOption || '');

function supplyTypeOf(row) {
  if (row.sez) return isWithoutPayment(row) ? 'SEZWOP' : 'SEZWP';
  if (row.pos === FOREIGN_POS) return isWithoutPayment(row) ? 'EXPWOP' : 'EXPWP';
  return row.gstin ? 'B2B' : 'B2C';
}

/** The filters of the iCAFFE Search tab, as SQL conditions and their values. */
function searchConditions(filters) {
  const conditions = ['1 = 1'];
  const values = [];
  const add = (condition, ...conditionValues) => {
    conditions.push(condition);
    values.push(...conditionValues);
  };
  if (filters.kind) add('i.kind = ?', filters.kind);
  if (filters.from) add('i.date >= ?', filters.from);
  if (filters.to) add('i.date <= ?', filters.to);
  if (filters.partyType) add('i.partyType = ?', filters.partyType);
  if (filters.party) add('i.partyName LIKE ?', '%' + filters.party + '%');
  if (filters.no) {
    if (filters.by === 'docket')
      add('(i.jobNo LIKE ? OR i.dockets LIKE ?)', '%' + filters.no + '%', '%' + filters.no + '%');
    else add((filters.by === 'hawb' ? 'i.hawbNo' : 'i.invoiceNo') + ' LIKE ?', '%' + filters.no + '%');
  }
  if (filters.status === 'Void') add("i.status = 'Void'");
  else if (filters.status === 'Approved') add("coalesce(i.status, '') <> 'Void'");
  if (filters.remarks)
    add("i.remarks LIKE ? AND i.remarks NOT LIKE 'Loaded from iCAFFE%'", '%' + filters.remarks + '%');
  if (filters.branch) add("(i.branchCode = ? OR coalesce(i.branchCode, '') = '')", filters.branch);
  // the search keeps to the branch picked in the top bar (ALL = the user's branches); a bill saved with no branch
  // counts as the default branch, as in the vouchers
  const scope = currentBranchScope();
  if (scope && scope.list) {
    add(
      `coalesce(nullif(upper(trim(i.branchCode)), ''), ?) IN (${scope.list.map(() => '?').join(', ')})`,
      scope.def,
      ...scope.list,
    );
  }
  return { conditions, values };
}

const searchRowView = (row) => ({
  ...row,
  remarks: realRemark(row.remarks),
  kindLabel: invoiceKindLabel(row.kind),
  prevKind: row.prevKind ? KINDS[row.prevKind].label : '',
  supplyType: supplyTypeOf(row),
});

/** Search (iCAFFE Search tab): at most 500 rows; `more` tells that there were more. */
export async function searchInvoices(query) {
  await ensureInvoiceTables();
  const filters = Object.fromEntries(Object.entries(query).map(([key, value]) => [key, lastValue(value)]));
  const { conditions, values } = searchConditions(filters);
  const rows = await selectRows(
    `SELECT i.id, i.kind, i.invoiceNo, i.date, i.prevInvoiceNo, i.status, i.partyName, i.gstin, i.jobNo, i.hawbNo, i.total, i.currency,
      i.totalFcy, i.createdBy, i.createdAt, i.modifiedBy, i.updatedAt, i.costCentre, i.remarks, i.voucherId, i.sez, i.pos,
      i.paymentOption, i.bulk, i.dockets, i.irn, i.irnStatus, i.ackNo, (SELECT k.kind FROM AccSalesInvoices k WHERE k.id = i.prevInvoiceId) prevKind
      FROM AccSalesInvoices i WHERE ${conditions.join(' AND ')} ORDER BY i.date DESC, i.id DESC LIMIT ${SEARCH_LIMIT + 1}`,
    values,
  );
  return { more: rows.length > SEARCH_LIMIT, rows: rows.slice(0, SEARCH_LIMIT).map(searchRowView) };
}

/** One invoice with its lines, what has been received against it and its credit / debit notes. */
async function loadInvoice(where, replacements) {
  await ensureInvoiceTables();
  const row = (await selectRows(`SELECT * FROM AccSalesInvoices WHERE ${where} LIMIT 1`, replacements))[0];
  if (!row) return null;
  const received = row.voucherId
    ? (
        await selectRows('SELECT coalesce(sum(amount), 0) a FROM VoucherAllocations WHERE againstVoucherId = ?', [
          row.voucherId,
        ]).catch(() => [{ a: 0 }])
      )[0].a
    : 0;
  const notes = await selectRows(
    "SELECT id, kind, invoiceNo, date, total FROM AccSalesInvoices WHERE prevInvoiceId = ? AND coalesce(status, '') <> 'Void'",
    [row.id],
  );
  const invoice = {
    ...row,
    remarks: realRemark(row.remarks),
    lines: parseJsonList(row.linesJson),
    linesJson: undefined,
    dockets: row.dockets ? JSON.parse(row.dockets) : [],
    mailLog: row.mailLog ? JSON.parse(row.mailLog) : [],
    received: round2(received),
    notes,
    kindLabel: (KINDS[row.kind] || {}).label,
  };
  return row.createdBy === ICAFFE_USER ? icaffeView(invoice) : invoice;
}

export const invoiceByVoucher = (voucherId) => loadInvoice('voucherId = ?', [voucherId]);
export const invoiceByNumber = (invoiceNo) =>
  loadInvoice('upper(invoiceNo) = upper(?)', [String(invoiceNo || '').trim()]);

export async function invoiceById(id) {
  const invoice = await loadInvoice('id = ?', [id]);
  if (!invoice) throw invoiceNotFound();
  return invoice;
}

const ledgerNames = async (posting, transaction) => {
  if (!posting.length) return new Map();
  const ledgers = await selectRows(
    `SELECT id, name FROM AccountLedgers WHERE id IN (${posting.map((line) => line.ledgerId).join(',')})`,
    [],
    transaction,
  );
  return new Map(ledgers.map((ledger) => [ledger.id, ledger.name]));
};

/** The same arithmetic and posting the save will do, without saving (everything is rolled back). */
export async function previewInvoice(body) {
  const transaction = await startTransaction();
  try {
    await ensureInvoiceTables();
    const invoice = body || {};
    const our = await ourGst();
    const computed = computeInvoice(invoice, our);
    let posting = [];
    if (computed.lines.length && (invoice.partyName || invoice.ledgerId)) {
      const partyLedgerId = await partyLedgerOrRefuse(transaction, invoice);
      posting = (await postingLines(transaction, invoice, computed, partyLedgerId)).lines;
    }
    const names = await ledgerNames(posting, transaction);
    await transaction.rollback();
    return {
      ...computed,
      our,
      posting: posting.map((line) => ({ ...line, ledger: names.get(line.ledgerId) || 'New ledger' })),
    };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

function checkInvoice(invoice) {
  const problem = firstIssueMessage(salesInvoiceSchema, invoice);
  if (problem) throw badRequest(problem);
}

const isMonthClosed = async (date) => {
  try {
    const rows = await selectRows('SELECT isClosed FROM AccMonthClosings WHERE month = ?', [String(date).slice(0, 7)]);
    return !!(rows[0] && rows[0].isClosed);
  } catch {
    return false;
  }
};

async function previousInvoice(invoice, transaction) {
  if (!invoice.prevInvoiceNo || invoice.withOut) return null;
  const previous = (
    await selectRows(
      "SELECT * FROM AccSalesInvoices WHERE upper(invoiceNo) = upper(?) AND coalesce(status, '') <> 'Void' LIMIT 1",
      [String(invoice.prevInvoiceNo).trim()],
      transaction,
    )
  )[0];
  if (!previous) throw badRequest('Previous invoice ' + invoice.prevInvoiceNo + ' not found');
  return previous;
}

async function checkCreditNoteFitsInvoice(previous, creditTotal, transaction) {
  const credited = (
    await selectRows(
      "SELECT coalesce(sum(total), 0) s FROM AccSalesInvoices WHERE prevInvoiceId = ? AND kind = 'creditnote' AND coalesce(status, '') <> 'Void'",
      [previous.id],
      transaction,
    )
  )[0].s;
  if (round2(toNumber(credited) + creditTotal) > round2(previous.total) + AMOUNT_TOLERANCE) {
    throw badRequest(
      'Credit notes would be more than invoice ' +
        previous.invoiceNo +
        ' (' +
        previous.total +
        ', already credited ' +
        round2(credited) +
        ')',
    );
  }
}

/** The header columns of an invoice row from the screen's values (booleans as 1 / 0, blanks as null). */
function headOf(invoice) {
  const head = {};
  for (const key of HEAD_KEYS) {
    let value = invoice[key];
    if (typeof value === 'boolean') value = value ? 1 : 0;
    head[key] = value === undefined || value === '' ? null : value;
  }
  if (head.gstin) head.gstin = String(head.gstin).toUpperCase().trim();
  head.bulk = toNumber(invoice.bulk) ? 1 : 0;
  head.dockets =
    head.bulk && Array.isArray(invoice.dockets)
      ? JSON.stringify(invoice.dockets.map((docket) => String(docket).toUpperCase().trim()).filter(Boolean))
      : null;
  if (head.bulk) head.jobNo = null;
  return head;
}

function headWithPrevious(invoice, previous) {
  const head = headOf(invoice);
  head.prevInvoiceId = previous ? previous.id : null;
  if (previous) head.prevInvoiceDate = previous.date;
  return head;
}

function voucherNarration(kindLabel, invoiceNo, invoice, previous) {
  let jobPart = '';
  if (toNumber(invoice.bulk)) jobPart = ' - Bulk, ' + (invoice.dockets || []).length + ' dockets';
  else if (invoice.jobNo) jobPart = ' - Job ' + invoice.jobNo;
  return (
    kindLabel +
    ' invoice ' +
    invoiceNo +
    jobPart +
    (previous ? ' against ' + previous.invoiceNo : '') +
    (invoice.remarks ? ' - ' + invoice.remarks : '')
  ).slice(0, MAX_NARRATION_LENGTH);
}

const voucherJobNo = (invoice) => (toNumber(invoice.bulk) ? null : invoice.jobNo || null);
const voucherRefNo = (invoice, previous) => (previous ? previous.invoiceNo : invoice.quotationNo || null);

const totalsOf = (computed) => ({
  linesJson: JSON.stringify(computed.lines),
  chargeTotal: computed.chargeTotal,
  grossInr: computed.grossInr,
  igst: computed.igst,
  cgst: computed.cgst,
  sgst: computed.sgst,
  roundOffAmt: computed.roundOffAmt,
  total: computed.total,
  totalFcy: computed.totalFcy,
  exRate: computed.exRate,
});

async function voucherTypeFor(kind, transaction) {
  const type = (
    await selectRows(
      'SELECT id FROM VoucherTypes WHERE baseType = ? ORDER BY id LIMIT 1',
      [KINDS[kind].base],
      transaction,
    )
  )[0];
  if (!type) throw badRequest('Voucher type "' + KINDS[kind].base + '" is missing');
  return type;
}

async function insertInvoiceVoucher({ invoice, invoiceNo, previous, posting, userName }, transaction) {
  const type = await voucherTypeFor(invoice.kind, transaction);
  const now = nowIso();
  await runSql(
    `INSERT INTO Vouchers (voucherTypeId, voucherNumber, date, narration, totalAmount, status, branchCode, refNo, jobNo, createdByName,
      createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      type.id,
      invoiceNo,
      invoice.date,
      voucherNarration(KINDS[invoice.kind].label, invoiceNo, invoice, previous),
      posting.amount,
      APPROVED,
      invoice.branchCode || null,
      voucherRefNo(invoice, previous),
      voucherJobNo(invoice),
      userName || null,
      now,
      now,
    ],
    transaction,
  );
  const voucherId = (
    await selectRows(
      'SELECT id FROM Vouchers WHERE voucherTypeId = ? AND voucherNumber = ? ORDER BY id DESC LIMIT 1',
      [type.id, invoiceNo],
      transaction,
    )
  )[0].id;
  await writeVoucherDetails(transaction, voucherId, posting.lines);
  return { voucherId, now };
}

async function insertInvoiceRow(row, transaction) {
  const keys = Object.keys(row);
  await runSql(
    `INSERT INTO AccSalesInvoices (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(',')})`,
    keys.map((key) => row[key]),
    transaction,
  );
}

/** Saves a new invoice: its number, its voucher (approved at once) and, for a credit note, the set-off. */
export async function createInvoice(body, userName) {
  const invoice = { ...body };
  let transaction;
  try {
    await ensureInvoiceTables();
    checkInvoice(invoice);
    if (await isMonthClosed(invoice.date)) throw badRequest('The month of ' + invoice.date + ' is closed for posting');
    const computed = computeInvoice(invoice, await ourGst());
    transaction = await startTransaction();
    const previous = await previousInvoice(invoice, transaction);
    if (previous && invoice.kind === CREDIT_NOTE)
      await checkCreditNoteFitsInvoice(previous, computed.total, transaction);
    const head = headWithPrevious(invoice, previous);
    invoice.division = divisionOfInvoice(invoice) || null;
    head.division = invoice.division;
    const invoiceNo = await invoiceNumberFor(
      invoice.kind,
      invoice.branchCode,
      invoice.date,
      transaction,
      invoice.division,
      true,
    );
    invoice.invoiceNo = invoiceNo;
    const partyLedgerId = await partyLedgerOrRefuse(transaction, invoice);
    const posting = await postingLines(transaction, invoice, computed, partyLedgerId);
    const { voucherId, now } = await insertInvoiceVoucher(
      {
        invoice,
        invoiceNo,
        previous,
        posting,
        userName,
      },
      transaction,
    );
    // a credit note sets itself off against the invoice it is for
    if (previous && invoice.kind === CREDIT_NOTE && previous.voucherId) {
      await runSql(
        'INSERT INTO VoucherAllocations (voucherId, ledgerId, againstVoucherId, amount, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
        [voucherId, partyLedgerId, previous.voucherId, computed.total, now, now],
        transaction,
      ).catch(() => null);
    }
    await insertInvoiceRow(
      {
        ...head,
        invoiceNo,
        voucherId,
        ledgerId: partyLedgerId,
        status: APPROVED,
        ...totalsOf(computed),
        createdBy: userName || null,
        createdAt: now,
        updatedAt: now,
      },
      transaction,
    );
    const id = (await selectRows('SELECT id FROM AccSalesInvoices WHERE invoiceNo = ?', [invoiceNo], transaction))[0]
      .id;
    await transaction.commit();
    return {
      id,
      invoiceNo,
      voucherId,
      total: computed.total,
    };
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    throw error;
  }
}

const invoiceRowById = async (id, transaction) =>
  (await selectRows('SELECT * FROM AccSalesInvoices WHERE id = ?', [id], transaction))[0];

async function setOffAgainst(voucherId, transaction) {
  if (!voucherId) return 0;
  return toNumber(
    (
      await selectRows(
        'SELECT coalesce(sum(amount), 0) a FROM VoucherAllocations WHERE againstVoucherId = ?',
        [voucherId],
        transaction,
      )
    )[0].a,
  );
}

// receipts / credit notes set off, leaving out those on rejected (void) vouchers
async function liveSetOffAgainst(voucherId) {
  if (!voucherId) return 0;
  return toNumber(
    (
      await selectRows(
        "SELECT coalesce(sum(a.amount), 0) a FROM VoucherAllocations a JOIN Vouchers v ON v.id = a.voucherId WHERE a.againstVoucherId = ? AND coalesce(v.status, '') <> 'Rejected'",
        [voucherId],
      )
    )[0].a,
  );
}

function checkCanBeModified(existing) {
  if (existing.status === VOID) throw badRequest('A void invoice cannot be modified');
  if (fromIcaffe(existing)) throw badRequest(ICAFFE_VIEW_ONLY_MESSAGE);
  if (existing.irn && existing.irnStatus !== 'Cancelled') {
    throw badRequest('This invoice has an IRN - it cannot be modified; issue a credit / debit note instead');
  }
}

async function rewriteInvoiceVoucher({ existing, invoice, previous, posting, partyLedgerId, total, now }, transaction) {
  if (!existing.voucherId) return;
  await runSql('DELETE FROM VoucherDetails WHERE voucherId = ?', [existing.voucherId], transaction);
  await runSql(
    'UPDATE Vouchers SET date = ?, narration = ?, totalAmount = ?, jobNo = ?, refNo = ?, branchCode = ?, updatedAt = ? WHERE id = ?',
    [
      invoice.date,
      voucherNarration(KINDS[existing.kind].label, existing.invoiceNo, invoice, previous),
      posting.amount,
      voucherJobNo(invoice),
      voucherRefNo(invoice, previous),
      invoice.branchCode || null,
      now,
      existing.voucherId,
    ],
    transaction,
  );
  await writeVoucherDetails(transaction, existing.voucherId, posting.lines);
  if (existing.kind === CREDIT_NOTE) {
    await runSql(
      'UPDATE VoucherAllocations SET amount = ?, ledgerId = ?, updatedAt = ? WHERE voucherId = ?',
      [total, partyLedgerId, now, existing.voucherId],
      transaction,
    ).catch(() => null);
  }
}

/** Modify: the same number, the voucher lines rewritten; refused when more is already set off than the new total. */
export async function updateInvoice(id, body, userName) {
  const invoice = { ...body };
  let transaction;
  try {
    await ensureInvoiceTables();
    const existing = await invoiceRowById(id);
    if (!existing) throw invoiceNotFound();
    checkCanBeModified(existing);
    invoice.kind = existing.kind;
    checkInvoice(invoice);
    if ((await isMonthClosed(existing.date)) || (await isMonthClosed(invoice.date)))
      throw badRequest('The month is closed for posting');
    const computed = computeInvoice(invoice, await ourGst());
    transaction = await startTransaction();
    const previous = await previousInvoice(invoice, transaction);
    const setOff = await setOffAgainst(existing.voucherId, transaction);
    if (setOff > computed.total + AMOUNT_TOLERANCE) {
      throw badRequest(
        'Receipts / credit notes of ' +
          round2(setOff) +
          ' are already set off against this invoice - the total cannot go below that',
      );
    }
    invoice.invoiceNo = existing.invoiceNo;
    const partyLedgerId = await partyLedgerOrRefuse(transaction, invoice);
    const posting = await postingLines(transaction, invoice, computed, partyLedgerId);
    const now = nowIso();
    await rewriteInvoiceVoucher(
      {
        existing,
        invoice,
        previous,
        posting,
        partyLedgerId,
        total: computed.total,
        now,
      },
      transaction,
    );
    const row = {
      ...headWithPrevious(invoice, previous),
      ledgerId: partyLedgerId,
      ...totalsOf(computed),
      modifiedBy: userName || null,
      updatedAt: now,
    };
    delete row.kind;
    const keys = Object.keys(row);
    await runSql(
      `UPDATE AccSalesInvoices SET ${keys.map((key) => key + ' = ?').join(', ')} WHERE id = ?`,
      [...keys.map((key) => row[key]), existing.id],
      transaction,
    );
    await transaction.commit();
    return {
      id: existing.id,
      invoiceNo: existing.invoiceNo,
      voucherId: existing.voucherId,
      total: computed.total,
    };
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function checkCanBeDeleted(existing) {
  if (fromIcaffe(existing)) throw badRequest(ICAFFE_VIEW_ONLY_MESSAGE);
  if (existing.irn && existing.irnStatus !== 'Cancelled')
    throw badRequest('This invoice has an IRN - cancel the IRN first');
  if (await isMonthClosed(existing.date)) throw badRequest('The month of the invoice is closed for posting');
  const notes = await selectRows(
    "SELECT invoiceNo FROM AccSalesInvoices WHERE prevInvoiceId = ? AND coalesce(status, '') <> 'Void'",
    [existing.id],
  );
  if (notes.length) {
    throw badRequest(
      'Credit / debit notes are made on it (' +
        notes.map((note) => note.invoiceNo).join(', ') +
        ') - delete or void them first',
    );
  }
  if ((await liveSetOffAgainst(existing.voucherId)) > SET_OFF_EPSILON) {
    throw badRequest('Receipts are set off against this invoice - remove them first');
  }
}

// a full copy of the invoice and its voucher is kept in AccSalesInvoiceDeleted
async function archiveDeletedInvoice(existing, userName, transaction) {
  const now = nowIso();
  await runSql(DELETED_INVOICES_TABLE_SQL, [], transaction);
  const voucherCopy = existing.voucherId
    ? {
        voucher:
          (await selectRows('SELECT * FROM Vouchers WHERE id = ?', [existing.voucherId], transaction))[0] || null,
        details: await selectRows(
          'SELECT * FROM VoucherDetails WHERE voucherId = ?',
          [existing.voucherId],
          transaction,
        ),
      }
    : null;
  await runSql(
    'INSERT INTO AccSalesInvoiceDeleted (invoiceId, invoiceNo, dataJson, voucherJson, deletedBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
    [
      existing.id,
      existing.invoiceNo,
      JSON.stringify(existing),
      JSON.stringify(voucherCopy),
      userName || null,
      now,
      now,
    ],
    transaction,
  );
}

/** Delete, only while nothing depends on it: no IRN, nothing set off, no credit / debit note on it, month open. */
export async function deleteInvoice(id, userName) {
  let transaction;
  try {
    await ensureInvoiceTables();
    const existing = await invoiceRowById(id);
    if (!existing) throw invoiceNotFound();
    await checkCanBeDeleted(existing);
    transaction = await startTransaction();
    await archiveDeletedInvoice(existing, userName, transaction);
    if (existing.voucherId) {
      await runSql('DELETE FROM VoucherAllocations WHERE voucherId = ?', [existing.voucherId], transaction).catch(
        () => null,
      );
      await runSql('DELETE FROM VoucherDetails WHERE voucherId = ?', [existing.voucherId], transaction);
      await runSql('DELETE FROM Vouchers WHERE id = ?', [existing.voucherId], transaction);
    }
    await runSql('DELETE FROM AccSalesInvoices WHERE id = ?', [existing.id], transaction);
    await transaction.commit();
    return { ok: true, invoiceNo: existing.invoiceNo };
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function checkCanBeVoided(existing) {
  if (existing.status === VOID) throw badRequest('Already void');
  if (fromIcaffe(existing)) throw badRequest(ICAFFE_VIEW_ONLY_MESSAGE);
  if (existing.irn && existing.irnStatus !== 'Cancelled')
    throw badRequest('This invoice has an IRN - cancel the IRN first (Cancel IRN)');
  if (await isMonthClosed(existing.date)) throw badRequest('The month of the invoice is closed for posting');
  if ((await liveSetOffAgainst(existing.voucherId)) > SET_OFF_EPSILON) {
    throw badRequest('Receipts / credit notes are set off against this invoice - remove them first');
  }
}

/** Void (iCAFFE): the number stays; the invoice and its voucher drop out of the books. */
export async function voidInvoice(id, body, userName) {
  let transaction;
  try {
    await ensureInvoiceTables();
    const reason = String((body || {}).reason || '').trim();
    if (!reason) throw badRequest('Give the reason for void');
    const existing = await invoiceRowById(id);
    if (!existing) throw invoiceNotFound();
    await checkCanBeVoided(existing);
    transaction = await startTransaction();
    const now = nowIso();
    if (existing.voucherId) {
      await runSql(
        "UPDATE Vouchers SET status = 'Rejected', narration = coalesce(narration, '') || ?, updatedAt = ? WHERE id = ?",
        [' [VOID: ' + reason + ']', now, existing.voucherId],
        transaction,
      );
      await runSql('DELETE FROM VoucherAllocations WHERE voucherId = ?', [existing.voucherId], transaction).catch(
        () => null,
      );
    }
    await runSql(
      "UPDATE AccSalesInvoices SET status = 'Void', voidReason = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?",
      [reason, userName || null, now, existing.id],
      transaction,
    );
    await transaction.commit();
    return { ok: true };
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    throw error;
  }
}
