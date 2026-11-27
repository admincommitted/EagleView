import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { NotFoundError } from '../../../core/http/index.js';
import {
  AccountGroup,
  AccountLedger,
  Voucher,
  VoucherAllocation,
  VoucherDetail,
  VoucherType,
} from '../../../models/index.js';
import { checkAllocations, checkLines } from '../../../utils/common/ledgerGuard.js';
import * as numberSeries from '../../../utils/common/numberSeries.js';
import { heldBills, isJobClosed, isMonthClosed } from '../hub/hub.service.js';

const SALES = 'Sales';
const PAYMENT = 'Payment';
const AUTOMATIC_NUMBERING = 'Automatic';
const BALANCE_TOLERANCE = 0.01;
const ALLOCATION_TYPES = ['AGAINST', 'ADVANCE', 'ON_ACCOUNT'];
const MAX_REMARKS_LENGTH = 300;
const MAX_REF_LENGTH = 80;
const CURRENCY_CODE_LENGTH = 3;
const RCM_RATE = 0.05;
const RCM_INPUT_LEDGER = 'RCM Input Tax A/c';
const RCM_PAYABLE_LEDGER = 'RCM Tax Payable A/c';
const DEFAULT_APPROVER_ID = 1;
const LEDGER_MISSING = 'Every line needs a ledger - pick one from the list';

const voucherNotFound = () => new NotFoundError('Voucher not found', { body: { error: 'Voucher not found' } });

const selectRows = (sql, replacements, transaction) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    ...(transaction ? { transaction } : {}),
  });

const numberOrNull = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasSeriesForBranch = async (doc, branchCode) =>
  (await selectRows('SELECT 1 FROM NumberSeries WHERE docType = ? AND branchCode = ? LIMIT 1', [doc, branchCode]))
    .length > 0;

/** With a Number Series (iCAFFE) for the branch the number is only shown here; it is given on Save. */
async function iCaffeNextNumber(type, query) {
  await numberSeries.ensure();
  if (type.baseType === SALES) return null;
  const ownBranch = String(query.branch || '').toUpperCase() || (await numberSeries.defaultBranch());
  const division = numberSeries.divOf(query.division || query.jobNo);
  const doc = await numberSeries.voucherDoc(
    type.baseType,
    String(query.ledgers || '')
      .split(',')
      .filter(Boolean),
  );
  if (!(await hasSeriesForBranch(doc, ownBranch))) return null;
  const number = division ? await numberSeries.peek(doc, { branchCode: ownBranch, division, date: query.date }) : null;
  return {
    success: true,
    isAuto: true,
    icaffe: true,
    nextNumber: number ? number + ' (on Save)' : '',
    note: division ? '' : 'Choose the division - the number is given on Save',
  };
}

export async function nextVoucherNumber(typeId, query) {
  const type = await VoucherType.findByPk(typeId);
  if (!type) throw new NotFoundError('Voucher type not found', { body: { error: 'Voucher type not found' } });
  try {
    const iCaffeAnswer = await iCaffeNextNumber(type, query);
    if (iCaffeAnswer) return iCaffeAnswer;
  } catch {
    // the voucher type's own numbering below still answers
  }
  if (type.numberingMethod !== AUTOMATIC_NUMBERING) return { success: true, isAuto: false, nextNumber: '' };
  const count = await Voucher.count({ where: { voucherTypeId: type.id } });
  const seq = (type.startingNumber || 1) + count;
  const nextNumber = `${type.prefix || ''}${seq}${type.suffix || ''}`;
  return {
    success: true,
    isAuto: true,
    nextNumber,
    seq,
  };
}

const heldBillLabel = (bill) =>
  (bill.billNo || bill.voucherNumber) + (bill.holdReason ? ' (' + bill.holdReason + ')' : '');

/**
 * No payment may be set against a bill on hold (Trade Invoice "Hold Payment"). Answers the refusal text, or null.
 * The check never stops a voucher for its own errors.
 */
export async function heldBillRefusal(body) {
  try {
    const allocations = Array.isArray(body && body.allocations) ? body.allocations : [];
    const billIds = allocations.map((allocation) => allocation && allocation.againstVoucherId).filter(Boolean);
    if (!billIds.length) return null;
    const type = await VoucherType.findByPk(body.voucherTypeId);
    if (!type || type.baseType !== PAYMENT) return null;
    const held = await heldBills(billIds);
    if (!held.length) return null;
    return 'Payment is on hold for bill ' + held.map(heldBillLabel).join(', ') + ' - release it in the bill first';
  } catch {
    return null;
  }
}

async function checkPeriodIsOpen(date, jobNo) {
  if (await isMonthClosed(date)) {
    throw new Error(
      'Month ' + String(date).slice(0, 7) + ' is closed (Accounts > Month Closing). Re-open it to post this voucher.',
    );
  }
  if (jobNo && (await isJobClosed(jobNo))) {
    throw new Error('Job ' + jobNo + ' is closed (Accounts > Job Closing). Re-open the job to post this voucher.');
  }
}

function balancedTotal(details) {
  let totalDr = 0;
  let totalCr = 0;
  details.forEach((line) => {
    if (line.dc === 'Dr') totalDr += parseFloat(line.amount || 0);
    if (line.dc === 'Cr') totalCr += parseFloat(line.amount || 0);
  });
  if (Math.abs(totalDr - totalCr) > BALANCE_TOLERANCE) throw new Error('Total Debit must equal Total Credit');
  if (totalDr <= 0) throw new Error('Voucher must have a non-zero amount');
  return totalDr;
}

// every line an active ledger; a bill set-off only for this voucher's party, against a bill of that same party
async function guardLedgers(details, allocations, transaction) {
  const lineLedgerIds = (details || []).map((line) => line.ledgerId);
  if (lineLedgerIds.some((id) => !id)) throw new Error(LEDGER_MISSING);
  await checkLines(lineLedgerIds, transaction);
  if (Array.isArray(allocations) && allocations.length) {
    const withAmount = allocations.filter((allocation) => parseFloat(allocation && allocation.amount) || 0);
    await checkAllocations(withAmount, lineLedgerIds, null, transaction);
  }
}

/**
 * iCAFFE numbering: bank book BA/NDL/AE/15931, cash book CA/NDL/AE/814, everything else JN/NDL/AE/10527, from
 * Settings > Number Series (iCAFFE) for our branch + division + year, given on Save. Sales vouchers and branches
 * without a series keep the number typed on the screen.
 */
async function voucherNumberOnSave(body, transaction) {
  const { voucherTypeId, voucherNumber, jobNo, date, details } = body;
  const type = await VoucherType.findByPk(voucherTypeId, { transaction });
  const baseType = type ? type.baseType : '';
  if (!baseType || baseType === SALES) return { number: voucherNumber, division: null };
  await numberSeries.ensure();
  const ownBranch =
    String(body.ownBranch || '')
      .trim()
      .toUpperCase() || (await numberSeries.defaultBranch(transaction));
  const division = numberSeries.divOf(body.division) || numberSeries.divOf(jobNo) || null;
  const doc = await numberSeries.voucherDoc(
    baseType,
    (details || []).map((line) => line.ledgerId),
    transaction,
  );
  const activeSeries = await selectRows(
    'SELECT division FROM NumberSeries WHERE docType = ? AND branchCode = ? AND coalesce(isActive, 1) = 1',
    [doc, ownBranch],
    transaction,
  );
  if (!activeSeries.length) return { number: voucherNumber, division };
  if (!division) {
    throw new Error(
      "Choose the Division (AE / AI / SE / SI) - the voucher no comes from that division's series, as in iCAFFE",
    );
  }
  if (!activeSeries.some((series) => series.division === division || series.division === '')) {
    throw new Error(
      'Number series not set for ' +
        doc +
        ', branch ' +
        ownBranch +
        ', division ' +
        division +
        ' - set it in Settings > Number Series (iCAFFE)',
    );
  }
  const number = await numberSeries.take(doc, { branchCode: ownBranch, division, date }, transaction);
  return { number, division };
}

async function writeVoucherLines(voucherId, details, transaction) {
  for (const line of details) {
    if (!line.ledgerId) throw new Error(LEDGER_MISSING);
    await VoucherDetail.create(
      {
        voucherId,
        ledgerId: line.ledgerId,
        dc: line.dc,
        amount: parseFloat(line.amount || 0),
        costCentreId: line.costCentreId || null,
        currency: line.currency ? String(line.currency).toUpperCase().slice(0, CURRENCY_CODE_LENGTH) : null,
        roe: numberOrNull(line.roe),
        amountFcy: numberOrNull(line.amountFcy),
        remarks: line.remarks ? String(line.remarks).slice(0, MAX_REMARKS_LENGTH) : null,
      },
      { transaction },
    );
  }
}

function allocationType(allocation) {
  const refType = String(allocation.refType || 'AGAINST').toUpperCase();
  if (!ALLOCATION_TYPES.includes(refType)) throw new Error('Allocation type must be AGAINST, ADVANCE or ON_ACCOUNT');
  if (refType === 'AGAINST' && !allocation.againstVoucherId && !allocation.refNo) {
    throw new Error('An "against bill" allocation needs the bill it is set against');
  }
  return refType;
}

/**
 * Bill-wise knock-off rows make the outstanding exact; amounts nobody allocates still go through FIFO.
 */
async function writeAllocations(voucherId, allocations, voucherTotal, transaction) {
  if (!Array.isArray(allocations) || !allocations.length) return;
  const allocatedTotal = allocations.reduce((sum, allocation) => sum + (parseFloat(allocation.amount) || 0), 0);
  if (allocatedTotal - voucherTotal > BALANCE_TOLERANCE) {
    throw new Error(
      'Allocated ' +
        allocatedTotal.toFixed(2) +
        ' but the voucher is only ' +
        voucherTotal.toFixed(2) +
        ' - allocation cannot exceed the voucher',
    );
  }
  for (const allocation of allocations) {
    const amount = parseFloat(allocation.amount) || 0;
    if (!amount) continue;
    if (!allocation.ledgerId) throw new Error('Every allocation row needs the party ledger');
    const refType = allocationType(allocation);
    await VoucherAllocation.create(
      {
        voucherId,
        ledgerId: allocation.ledgerId,
        againstVoucherId: refType === 'AGAINST' ? allocation.againstVoucherId || null : null,
        refNo: allocation.refNo ? String(allocation.refNo).slice(0, MAX_REF_LENGTH) : null,
        refType,
        amount,
        amountFcy:
          allocation.amountFcy != null && allocation.amountFcy !== '' ? parseFloat(allocation.amountFcy) : null,
      },
      { transaction },
    );
  }
}

async function rcmLedger(name, taxGroup, balanceType, transaction) {
  const existing = await AccountLedger.findOne({ where: { name } });
  if (existing) return existing;
  return AccountLedger.create({ name, groupId: taxGroup.id, balanceType }, { transaction });
}

/**
 * Reverse charge: a journal of 5% of the voucher (the usual GTA rate), Dr RCM Input Tax, Cr RCM Tax Payable.
 * Missing RCM ledgers are made under 'Duties & Taxes'.
 */
async function postRcmJournal(voucher, { voucherTypeId, voucherNumber, date }, voucherTotal, transaction) {
  const journalType = await VoucherType.findOne({ where: { baseType: 'Journal' } });
  const taxGroup =
    (await AccountGroup.findOne({ where: { name: 'Duties & Taxes' } })) ||
    (await AccountGroup.findOne({ where: { nature: 'Liabilities' } }));
  if (!taxGroup)
    throw new Error("Account group 'Duties & Taxes' not found. Open Accounts once to create the default groups.");
  const inputLedger = await rcmLedger(RCM_INPUT_LEDGER, taxGroup, 'Dr', transaction);
  const payableLedger = await rcmLedger(RCM_PAYABLE_LEDGER, taxGroup, 'Cr', transaction);
  const rcmTaxAmount = parseFloat((voucherTotal * RCM_RATE).toFixed(2));
  if (rcmTaxAmount <= 0) return;
  const rcmVoucher = await Voucher.create(
    {
      voucherTypeId: journalType ? journalType.id : voucherTypeId,
      voucherNumber: voucherNumber ? `RCM-${voucherNumber}` : `RCM-AUTO-${voucher.id}`,
      date,
      narration: `Auto-generated RCM Liability for Voucher: ${voucherNumber || voucher.id}`,
      totalAmount: rcmTaxAmount,
    },
    { transaction },
  );
  await VoucherDetail.create(
    { voucherId: rcmVoucher.id, ledgerId: inputLedger.id, dc: 'Dr', amount: rcmTaxAmount },
    { transaction },
  );
  await VoucherDetail.create(
    { voucherId: rcmVoucher.id, ledgerId: payableLedger.id, dc: 'Cr', amount: rcmTaxAmount },
    { transaction },
  );
}

/** Saves a voucher with its lines, bill allocations and (for RCM) the reverse-charge journal, in one transaction. */
export async function createVoucher(body, user) {
  const transaction = await sequelize.transaction();
  try {
    const { voucherTypeId, date, narration, details, jobNo, branchCode, refNo, allocations } = body;
    await checkPeriodIsOpen(date, jobNo);
    const voucherTotal = balancedTotal(details);
    await guardLedgers(details, allocations, transaction);
    const { number, division } = await voucherNumberOnSave(body, transaction);
    const voucher = await Voucher.create(
      {
        voucherTypeId,
        voucherNumber: number,
        date,
        narration,
        totalAmount: voucherTotal,
        jobNo: jobNo || null,
        branchCode: branchCode || null,
        refNo: refNo || null,
        createdBy: user.id,
        createdByName: user.name,
      },
      { transaction },
    );
    await writeVoucherLines(voucher.id, details, transaction);
    await writeAllocations(voucher.id, allocations, voucherTotal, transaction);
    if (body.isRcm) await postRcmJournal(voucher, body, voucherTotal, transaction);
    if (division) {
      await sequelize.query('UPDATE Vouchers SET division = ? WHERE id = ?', {
        replacements: [division, voucher.id],
        transaction,
      });
    }
    await transaction.commit();
    return { success: true, data: voucher };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

const VOUCHER_INCLUDES = [
  { model: VoucherType, as: 'voucherType', attributes: ['name', 'baseType'] },
  { model: VoucherDetail, as: 'details', include: [{ model: AccountLedger, as: 'ledger', attributes: ['name'] }] },
];
const RECENT_VOUCHER_LIMIT = 50;

export async function recentVouchers() {
  const vouchers = await Voucher.findAll({
    include: VOUCHER_INCLUDES,
    order: [
      ['date', 'DESC'],
      ['createdAt', 'DESC'],
    ],
    limit: RECENT_VOUCHER_LIMIT,
  });
  return { success: true, data: vouchers };
}

export async function vouchersInDayBook(where) {
  const vouchers = await Voucher.findAll({
    where,
    include: VOUCHER_INCLUDES,
    order: [
      ['date', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });
  return { success: true, data: vouchers };
}

export async function pendingApprovals() {
  const vouchers = await Voucher.findAll({
    where: { status: 'Pending' },
    include: VOUCHER_INCLUDES,
    order: [['createdAt', 'DESC']],
  });
  return { success: true, data: vouchers };
}

/** Approve / reject / return a voucher. */
export async function updateVoucherStatus(id, { status, rejectionReason, userId }) {
  const voucher = await Voucher.findByPk(id);
  if (!voucher) throw voucherNotFound();
  voucher.status = status;
  if (status === 'Rejected' || status === 'Returned') voucher.rejectionReason = rejectionReason;
  if (status === 'Approved') voucher.approvedBy = userId || DEFAULT_APPROVER_ID;
  await voucher.save();
  return { success: true, data: voucher };
}
