import { Op } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { ApiError, BadRequestError, NotFoundError } from '../../../core/http/index.js';
import {
  AccountLedger,
  LorryReceipt,
  Transporter,
  Voucher,
  VoucherDetail,
  VoucherType,
} from '../../../models/index.js';

/** Fleet & Transport: lorry receipts / trip sheets and the driver advance voucher. */
const STATUSES = ['PENDING_DISPATCH', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
const FREIGHT_BASES = ['Per Ton', 'Per Trip', 'Per Km', 'Flat'];
const MAX_LIST_ROWS = 500;
const FIRST_FINANCIAL_MONTH = 3; // April (0-based)

const round2 = (value) => Math.round((value || 0) * 100) / 100;
const failure =
  (ErrorClass) =>
  (message, extra = {}) =>
    new ErrorClass(message, { body: { success: false, error: message, ...extra } });
const badRequest = failure(BadRequestError);
const notFound = failure(NotFoundError);
const lrNotFound = () => notFound('Lorry receipt not found');
const userFullName = (user) => (user && (user.fullName || user.username)) || null;

/** LR/<financial year yy>/<4-digit serial>, one series per financial year. */
export async function nextLrNo() {
  const now = new Date();
  const startYear = now.getMonth() < FIRST_FINANCIAL_MONTH ? now.getFullYear() - 1 : now.getFullYear();
  const yearCode = String(startYear % 100);
  const rows = await LorryReceipt.findAll({
    where: { lrNo: { [Op.like]: 'LR/' + yearCode + '/%' } },
    attributes: ['lrNo'],
  });
  let highest = 0;
  rows.forEach((row) => {
    const match = /\/(\d+)$/.exec(String(row.lrNo || ''));
    if (match) highest = Math.max(highest, parseInt(match[1], 10));
  });
  return 'LR/' + yearCode + '/' + String(highest + 1).padStart(4, '0');
}

/** The freight comes from the rate and its basis, so a rate per ton cannot silently become the whole freight. */
function freightOf(trip) {
  const rate = parseFloat(trip.freightRate) || 0;
  const basis = String(trip.freightBasis || 'Per Trip');
  if (!rate) return 0;
  if (basis === 'Per Ton') return round2(rate * (parseFloat(trip.chargedWeight) || parseFloat(trip.actualWeight) || 0));
  if (basis === 'Per Km') return round2(rate * (parseFloat(trip.distanceKm) || 0));
  return round2(rate); // Per Trip / Flat
}

// Indian plates: 2 letters, 1-2 digits, 1-3 letters, 4 digits - spaces and dashes allowed
const VEHICLE_PLATE = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{1,4}$/i;

function fieldProblems(body, existing) {
  const errors = [];
  const valueOf = (key) => (body[key] !== undefined ? body[key] : existing ? existing[key] : undefined);
  const date = String(valueOf('date') || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Give the LR date');
  const basis = String(valueOf('freightBasis') || 'Per Trip');
  if (!FREIGHT_BASES.includes(basis)) errors.push('Freight basis must be one of ' + FREIGHT_BASES.join(', '));
  const hasRate = (parseFloat(valueOf('freightRate')) || 0) > 0;
  if (
    basis === 'Per Ton' &&
    hasRate &&
    !(parseFloat(valueOf('chargedWeight')) || parseFloat(valueOf('actualWeight')))
  ) {
    errors.push('A per-ton rate needs the weight, otherwise the freight cannot be worked out');
  }
  if (basis === 'Per Km' && hasRate && !(parseFloat(valueOf('distanceKm')) || 0))
    errors.push('A per-km rate needs the distance');
  const vehicleNo = String(valueOf('vehicleNo') || '').trim();
  if (vehicleNo && !VEHICLE_PLATE.test(vehicleNo)) {
    errors.push('Vehicle number does not look like a plate (e.g. HR38X4455 or HR 38 X 4455)');
  }
  const phone = String(valueOf('driverPhone') || '').trim();
  if (phone && !/^[0-9+\-()\s]{6,20}$/.test(phone)) errors.push('Driver phone looks wrong');
  const ewayBill = String(valueOf('ewayBill') || '').trim();
  if (ewayBill && !/^\d{12}$/.test(ewayBill)) errors.push('An e-way bill number is 12 digits');
  const advance = parseFloat(valueOf('advanceToDriver')) || 0;
  const freight = freightOf({
    freightBasis: basis,
    freightRate: valueOf('freightRate'),
    chargedWeight: valueOf('chargedWeight'),
    actualWeight: valueOf('actualWeight'),
    distanceKm: valueOf('distanceKm'),
  });
  if (advance && freight && advance > freight) {
    errors.push('The driver advance (' + advance + ') is more than the whole freight (' + freight + ')');
  }
  if (body.status !== undefined && !STATUSES.includes(String(body.status).toUpperCase())) {
    errors.push('Status must be one of ' + STATUSES.join(', '));
  }
  return errors;
}

/** Every problem of the lorry receipt at once (an existing LR fills what the screen did not send). */
async function assertValidLorryReceipt(body, existing) {
  const errors = fieldProblems(body, existing);
  if (body.transporterId && !(await Transporter.findByPk(body.transporterId)))
    errors.push('That transporter does not exist');
  if (body.billingLedgerId && !(await AccountLedger.findByPk(body.billingLedgerId)))
    errors.push('That billing ledger does not exist');
  if (errors.length) throw badRequest(errors.join('; '), { errors });
}

function listWhereOf(query) {
  const where = {};
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.q) {
    const like = { [Op.like]: '%' + String(query.q) + '%' };
    where[Op.or] = ['lrNo', 'vehicleNo', 'driverName', 'consignor', 'consignee', 'origin', 'destination', 'jobNo'].map(
      (field) => ({ [field]: like }),
    );
  }
  return where;
}

function listRowOf(lorryReceipt) {
  const row = lorryReceipt.toJSON();
  const freight = round2(parseFloat(row.freightAmount) || 0);
  const advance = round2(parseFloat(row.advanceToDriver) || 0);
  return {
    ...row,
    freightAmount: freight,
    advanceToDriver: advance,
    balance: round2(freight - advance),
    advancePosted: !!row.advanceVoucherId,
  };
}

export async function listLorryReceipts(query) {
  const rows = await LorryReceipt.findAll({
    where: listWhereOf(query),
    order: [
      ['date', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: MAX_LIST_ROWS,
  });
  const data = rows.map(listRowOf);
  return {
    success: true,
    data,
    counts: STATUSES.reduce(
      (counts, status) => ({ ...counts, [status]: data.filter((row) => row.status === status).length }),
      {},
    ),
    totals: {
      freight: round2(data.reduce((sum, row) => sum + row.freightAmount, 0)),
      advance: round2(data.reduce((sum, row) => sum + row.advanceToDriver, 0)),
      advancesNotPosted: data.filter((row) => row.advanceToDriver > 0 && !row.advanceVoucherId).length,
    },
    nextLrNo: await nextLrNo(),
    note: data.length
      ? 'Freight is computed from the rate and its basis. An advance only shows as posted when a voucher was actually created for it.'
      : 'No lorry receipt yet. Use "New Trip / Lorry Receipt" to raise the first one.',
  };
}

/** The pickable masters of the lorry receipt form. */
export async function formMasters() {
  const [transporters, ledgers, voucherTypes] = await Promise.all([
    Transporter.findAll({ order: [['transporterName', 'ASC']] }),
    AccountLedger.findAll({ order: [['name', 'ASC']] }),
    VoucherType.findAll({ where: { baseType: 'Payment' } }),
  ]);
  return {
    success: true,
    transporters: transporters.map((transporter) => ({
      id: transporter.id,
      name: transporter.transporterName,
      gstin: transporter.gstin,
      vehicleType: transporter.vehicleType,
    })),
    ledgers: ledgers.map((ledger) => ({ id: ledger.id, name: ledger.name })),
    paymentVoucherTypes: voucherTypes.map((voucherType) => ({ id: voucherType.id, name: voucherType.name })),
  };
}

const numberOrNull = (value) => (value === '' || value == null ? null : parseFloat(value));
const wholeNumberOrNull = (value) => (value === '' || value == null ? null : parseInt(value, 10));

export async function createLorryReceipt(body, user) {
  try {
    await assertValidLorryReceipt(body, null);
    const freightAmount = freightOf(body);
    const row = await LorryReceipt.create({
      lrNo: String(body.lrNo || '').trim() || (await nextLrNo()),
      date: String(body.date).slice(0, 10),
      jobNo: body.jobNo || null,
      consignor: body.consignor || null,
      consignee: body.consignee || null,
      billingParty: body.billingParty || null,
      billingLedgerId: body.billingLedgerId || null,
      transporterId: body.transporterId || null,
      origin: body.origin || null,
      destination: body.destination || null,
      distanceKm: numberOrNull(body.distanceKm),
      vehicleNo: body.vehicleNo ? String(body.vehicleNo).toUpperCase().trim() : null,
      vehicleType: body.vehicleType || null,
      driverName: body.driverName || null,
      driverPhone: body.driverPhone || null,
      dlNumber: body.dlNumber ? String(body.dlNumber).toUpperCase() : null,
      ewayBill: body.ewayBill || null,
      invoiceValue: numberOrNull(body.invoiceValue),
      packages: wholeNumberOrNull(body.packages),
      actualWeight: numberOrNull(body.actualWeight),
      chargedWeight: numberOrNull(body.chargedWeight),
      commodity: body.commodity || null,
      freightBasis: body.freightBasis || 'Per Trip',
      freightRate: numberOrNull(body.freightRate),
      freightAmount,
      advanceToDriver: numberOrNull(body.advanceToDriver),
      paymentType: body.paymentType || 'To Pay',
      status: 'PENDING_DISPATCH',
      remarks: body.remarks || null,
      createdByName: userFullName(user),
    });
    return {
      success: true,
      data: {
        ...row.toJSON(),
        freightAmount,
        balance: round2(freightAmount - (parseFloat(body.advanceToDriver) || 0)),
      },
    };
  } catch (error) {
    if (!(error instanceof ApiError) && String(error.message).includes('unique'))
      throw badRequest('That LR number already exists');
    throw error;
  }
}

const TEXT_FIELDS = [
  'consignor',
  'consignee',
  'billingParty',
  'origin',
  'destination',
  'vehicleType',
  'driverName',
  'driverPhone',
  'commodity',
  'freightBasis',
  'paymentType',
  'remarks',
  'jobNo',
  'ewayBill',
];
const NUMBER_FIELDS = ['distanceKm', 'invoiceValue', 'actualWeight', 'chargedWeight', 'freightRate', 'advanceToDriver'];
const FREIGHT_INPUTS = ['freightBasis', 'freightRate', 'chargedWeight', 'actualWeight', 'distanceKm'];

/** Only the fields the screen sent change; '' clears a field. */
function changedFieldsOf(body) {
  const changes = {};
  TEXT_FIELDS.forEach((key) => {
    if (body[key] !== undefined) changes[key] = body[key] === '' ? null : body[key];
  });
  NUMBER_FIELDS.forEach((key) => {
    if (body[key] !== undefined) changes[key] = numberOrNull(body[key]);
  });
  if (body.vehicleNo !== undefined)
    changes.vehicleNo = body.vehicleNo ? String(body.vehicleNo).toUpperCase().trim() : null;
  if (body.dlNumber !== undefined) changes.dlNumber = body.dlNumber ? String(body.dlNumber).toUpperCase() : null;
  if (body.packages !== undefined) changes.packages = wholeNumberOrNull(body.packages);
  if (body.transporterId !== undefined) changes.transporterId = body.transporterId || null;
  if (body.billingLedgerId !== undefined) changes.billingLedgerId = body.billingLedgerId || null;
  if (body.podReceived !== undefined) changes.podReceived = !!body.podReceived;
  return changes;
}

/** "Update Status": a delivered trip never goes back to pending; in transit needs a vehicle number. */
function applyStatusChange(row, body, changes) {
  if (body.status === undefined) return;
  const status = String(body.status).toUpperCase();
  if (row.status === 'DELIVERED' && status === 'PENDING_DISPATCH')
    throw badRequest('A delivered trip cannot go back to pending dispatch');
  if (status === 'IN_TRANSIT' && !String(body.vehicleNo || row.vehicleNo || '').trim()) {
    throw badRequest('A trip cannot be in transit without a vehicle number');
  }
  changes.status = status;
  if (status === 'IN_TRANSIT' && !row.dispatchedAt) changes.dispatchedAt = new Date();
  if (status === 'DELIVERED' && !row.deliveredAt) changes.deliveredAt = new Date();
}

export async function updateLorryReceipt(lrId, body) {
  const row = await LorryReceipt.findByPk(lrId);
  if (!row) throw lrNotFound();
  await assertValidLorryReceipt(body, row.toJSON());
  const changes = changedFieldsOf(body);
  applyStatusChange(row, body, changes);
  // the freight is worked out again whenever anything it depends on moved
  if (FREIGHT_INPUTS.some((key) => changes[key] !== undefined))
    changes.freightAmount = freightOf({ ...row.toJSON(), ...changes });
  await row.update(changes);
  const saved = row.toJSON();
  return {
    success: true,
    data: {
      ...saved,
      balance: round2((parseFloat(saved.freightAmount) || 0) - (parseFloat(saved.advanceToDriver) || 0)),
    },
  };
}

async function loadAdvancePostingParts(row, body) {
  if (row.advanceVoucherId)
    throw badRequest('The advance for this LR is already posted (voucher ' + row.advanceVoucherId + ')');
  const amount = parseFloat(row.advanceToDriver) || 0;
  if (amount <= 0) throw badRequest('There is no driver advance on this LR to post');
  const { voucherTypeId, debitLedgerId, creditLedgerId } = body;
  if (!voucherTypeId || !debitLedgerId || !creditLedgerId) {
    throw badRequest(
      'Posting an advance touches the ledger, so it needs the voucher type, the ledger to debit (the transporter / driver advance account) and the bank or cash ledger to credit. Nothing is guessed here.',
    );
  }
  const [voucherType, debitLedger, creditLedger] = await Promise.all([
    VoucherType.findByPk(voucherTypeId),
    AccountLedger.findByPk(debitLedgerId),
    AccountLedger.findByPk(creditLedgerId),
  ]);
  if (!voucherType || !debitLedger || !creditLedger)
    throw badRequest('The voucher type or one of the ledgers does not exist');
  if (String(debitLedgerId) === String(creditLedgerId))
    throw badRequest('The debit and credit ledgers cannot be the same');
  return { amount, voucherType, debitLedger, creditLedger };
}

async function nextVoucherNumber(voucherType, typedNumber) {
  const count = await Voucher.count({ where: { voucherTypeId: voucherType.id } });
  return (
    String(typedNumber || '').trim() ||
    (voucherType.prefix || '') + ((voucherType.startingNumber || 1) + count) + (voucherType.suffix || '')
  );
}

/**
 * A real payment voucher for the driver advance. It touches the ledger, so it asks which ledgers to use rather than
 * inventing or creating them.
 */
export async function postDriverAdvance(lrId, body, user) {
  const transaction = await sequelize.transaction();
  try {
    const row = await LorryReceipt.findByPk(lrId);
    if (!row) throw lrNotFound();
    const { amount, voucherType, debitLedger, creditLedger } = await loadAdvancePostingParts(row, body);
    const voucherNumber = await nextVoucherNumber(voucherType, body.voucherNumber);
    const voucher = await Voucher.create(
      {
        voucherTypeId: voucherType.id,
        voucherNumber,
        date: body.date || row.date,
        narration:
          'Driver advance for ' +
          row.lrNo +
          (row.vehicleNo ? ' (' + row.vehicleNo + ')' : '') +
          (row.driverName ? ' - ' + row.driverName : ''),
        totalAmount: amount,
        refNo: row.lrNo,
        jobNo: row.jobNo || null,
        createdBy: (user && user.id) || null,
        createdByName: userFullName(user),
      },
      { transaction },
    );
    const remarks = 'Advance against ' + row.lrNo;
    await VoucherDetail.create(
      { voucherId: voucher.id, ledgerId: debitLedger.id, dc: 'Dr', amount, remarks },
      { transaction },
    );
    await VoucherDetail.create(
      { voucherId: voucher.id, ledgerId: creditLedger.id, dc: 'Cr', amount, remarks },
      { transaction },
    );
    await row.update({ advanceVoucherId: voucher.id }, { transaction });
    await transaction.commit();
    return {
      success: true,
      data: { lr: row, voucher },
      note: 'Posted ' + voucherNumber + ': ' + debitLedger.name + ' Dr, ' + creditLedger.name + ' Cr, ' + amount,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function deleteLorryReceipt(lrId) {
  const row = await LorryReceipt.findByPk(lrId);
  if (!row) throw lrNotFound();
  if (row.advanceVoucherId) {
    throw badRequest(
      'An advance voucher is posted against this LR - cancel the trip instead of deleting it, so the voucher keeps its reference',
    );
  }
  if (row.status === 'DELIVERED') throw badRequest('A delivered trip cannot be deleted');
  await row.destroy();
  return { success: true };
}
