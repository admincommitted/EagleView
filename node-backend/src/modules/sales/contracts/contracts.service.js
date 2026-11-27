import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../core/http/index.js';
import {
  ContractCharge,
  ContractFreightRate,
  ContractTransportRate,
  CustomerContract,
  Party,
} from '../../../models/index.js';

/**
 * Customer Contract & Quotation master. A contract = header (party, validity, currency, status, terms) + freight rate
 * rows + charge rules + transport rates. Save replaces the rows of the contract in one transaction. Status flow:
 * Draft -> Pending Approval -> Active (admin approves) or back to Draft (admin rejects). An Active contract can only be
 * changed by an admin; changing it sends it back to Pending Approval. Contract numbers: CONT/<YY>/<0001>.
 */

const STATUSES = ['Draft', 'Pending Approval', 'Active', 'Rejected'];
const SERVICE_TYPES = ['General', 'Valuable', 'Perishable', 'DGR', 'Re-Import', 'Re-Export'];
export const BASIS = [
  'Flat',
  'Per KG (ChW)',
  'Per KG (GrW)',
  'Per Shipment',
  'Per Package',
  'Per Container',
  'Per Document',
  '% of Freight',
  '% of Value',
  'Actuals',
];
const CHARGE_TYPES = ['Taxable', 'Non-Taxable', 'Reimbursement'];
const APPLIES_TO = ['ALL', 'AE', 'AI', 'SE', 'SI'];
const FREIGHT_SLABS = ['min', 'normal', 'plus45', 'plus100', 'plus300', 'plus500', 'plus1000'];
const CONTRACT_MODELS = [CustomerContract, ContractFreightRate, ContractCharge, ContractTransportRate];
const WITH_ROWS = [
  { model: ContractFreightRate, as: 'freightRates' },
  { model: ContractCharge, as: 'charges' },
  { model: ContractTransportRate, as: 'transportRates' },
];
const MAX_RATE = 1e10;
const LIST_LIMIT = 500;
const AIRPORT_CODE_RE = /^[A-Z]{3}$/;
const CURRENCY_CODE_RE = /^[A-Z]{3}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sqliteColumnType(attribute) {
  const typeKey = String((attribute.type && attribute.type.key) || '');
  if (/DECIMAL|FLOAT|DOUBLE|REAL/.test(typeKey)) return 'REAL';
  if (/INTEGER|BOOLEAN/.test(typeKey)) return 'INTEGER';
  return 'TEXT';
}

function sqliteDefault(attribute) {
  const value = attribute.defaultValue;
  if (value === undefined || typeof value === 'object' || typeof value === 'function') return '';
  if (typeof value === 'string') return ` DEFAULT '${value.replace(/'/g, "''")}'`;
  if (value === true) return ' DEFAULT 1';
  if (value === false) return ' DEFAULT 0';
  return ` DEFAULT ${value}`;
}

// sync() does not add columns to a table that already exists, and these tables were first made by an older model
// (no rate / normal / +45... / amount columns): every model column the table lacks is added here
async function addMissingColumns(model) {
  const table = model.getTableName();
  const existing = new Set(
    (await sequelize.query(`PRAGMA table_info(${table})`, { type: QueryTypes.SELECT })).map((column) => column.name),
  );
  for (const [key, attribute] of Object.entries(model.rawAttributes)) {
    const column = attribute.field || key;
    if (existing.has(column)) continue;
    await sequelize.query(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${sqliteColumnType(attribute)}${sqliteDefault(attribute)}`,
    );
  }
}

let contractTablesReady = null;

/** Creates / widens the contract tables once, on first use. */
function ensureContractTables() {
  contractTablesReady =
    contractTablesReady ||
    (async () => {
      try {
        for (const model of CONTRACT_MODELS) await model.sync();
        for (const model of CONTRACT_MODELS) await addMissingColumns(model);
      } catch (error) {
        contractTablesReady = null;
        throw error;
      }
    })();
  return contractTablesReady;
}

/** The Accounts GST Charges a contract can use - a contract bills only these (name, SAC, GST rate). */
export async function listGstCharges() {
  try {
    return await sequelize.query(
      'SELECT id, chargeName name, sacCode sac, gstRate, coalesce(exempt, 0) exempt FROM AccGstCharges WHERE coalesce(isActive, 1) = 1 ORDER BY chargeName',
      { type: QueryTypes.SELECT },
    );
  } catch {
    return [];
  }
}

function amountOrNull(value, label, rowNumber) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > MAX_RATE) {
    throw new BadRequestError(`${label} in row ${rowNumber} must be a number 0 or more`);
  }
  return Math.round(number * 100) / 100;
}

const isoDateOrNull = (value) =>
  value && ISO_DATE_RE.test(String(value).slice(0, 10)) ? String(value).slice(0, 10) : null;

function currencyCode(value) {
  const code = String(value || 'INR')
    .trim()
    .toUpperCase();
  if (!CURRENCY_CODE_RE.test(code)) throw new BadRequestError('Currency must be a 3-letter code');
  return code;
}

async function loadParty(partyIdValue) {
  const partyId = parseInt(partyIdValue, 10);
  const party = Number.isInteger(partyId) ? await Party.findByPk(partyId, { attributes: ['id', 'name'] }) : null;
  if (!party) throw new BadRequestError('Choose the customer / party');
  return { partyId, party };
}

function contractHeader(body, { partyId, party }) {
  const validFrom = isoDateOrNull(body.validFrom);
  const validTo = isoDateOrNull(body.validTo);
  if (!validTo) throw new BadRequestError('Valid To date is required');
  if (validFrom && validFrom > validTo) throw new BadRequestError('Valid From must be before Valid To');
  return {
    partyId,
    partyName: party.name,
    validFrom,
    validTo,
    currency: currencyCode(body.currency),
    salesRep:
      String(body.salesRep || '')
        .trim()
        .slice(0, 100) || null,
    terms: String(body.terms || '').slice(0, 10000),
    splitInvoicing: !!body.splitInvoicing,
    consolidatedBilling: !!body.consolidatedBilling,
    autoEmailInvoices: body.autoEmailInvoices !== false,
    billingNotes: String(body.billingNotes || '').slice(0, 5000) || null,
  };
}

/** Returns a lookup giving a charge's name exactly as in the GST Charges master, or an error for the row. */
async function gstChargeNameLookup() {
  const namesByKey = new Map(
    (await listGstCharges()).map((charge) => [String(charge.name).trim().toUpperCase(), charge.name]),
  );
  return (value, section, index, required) => {
    const typed = String(value || '').trim();
    if (!typed) {
      if (required)
        throw new BadRequestError(`${section} row ${index + 1}: choose the charge from Accounts GST Charges`);
      return null;
    }
    const name = namesByKey.get(typed.toUpperCase());
    if (!name)
      throw new BadRequestError(
        `${section} row ${index + 1}: "${typed}" is not in Accounts GST Charges - pick one from the list`,
      );
    return name;
  };
}

const rowsOf = (list) => (Array.isArray(list) ? list : []);

function freightRow(row, index, chargeName) {
  const origin = String(row.origin || '')
    .trim()
    .toUpperCase();
  const destination = String(row.destination || '')
    .trim()
    .toUpperCase();
  if (!AIRPORT_CODE_RE.test(origin) || !AIRPORT_CODE_RE.test(destination)) {
    throw new BadRequestError(`Freight row ${index + 1}: origin and destination must be 3-letter airport codes`);
  }
  const freight = {
    origin,
    destination,
    serviceType: SERVICE_TYPES.includes(row.serviceType) ? row.serviceType : 'General',
    carrier:
      String(row.carrier || '')
        .trim()
        .toUpperCase()
        .slice(0, 10) || null,
    chargeName: chargeName(row.chargeName, 'Freight', index, false),
  };
  for (const slab of FREIGHT_SLABS) freight[slab] = amountOrNull(row[slab], slab, index + 1);
  if (freight.normal == null && freight.min == null) {
    throw new BadRequestError(`Freight row ${index + 1}: give at least the Min or Normal rate`);
  }
  return freight;
}

function assertNoDuplicateFreight(freightRows) {
  const seen = new Set();
  for (const freight of freightRows) {
    const key = [freight.origin, freight.destination, freight.serviceType, freight.carrier || ''].join('|');
    if (seen.has(key)) {
      throw new BadRequestError(
        `Freight rate ${freight.origin}-${freight.destination} ${freight.serviceType} ${freight.carrier || ''} is entered twice`,
      );
    }
    seen.add(key);
  }
}

function chargeRow(row, index, chargeName) {
  const name = chargeName(row.printName, 'Charge', index, true);
  const appliesTo = String(row.appliesTo || 'ALL').toUpperCase();
  const charge = {
    printName: name.slice(0, 200),
    systemLedger: null,
    appliesTo: APPLIES_TO.includes(appliesTo) ? appliesTo : 'ALL',
    basis:
      String(row.basis || 'Flat')
        .trim()
        .slice(0, 40) || 'Flat',
    rate: amountOrNull(row.rate, 'Rate', index + 1),
    minAmt: amountOrNull(row.minAmt, 'Min', index + 1),
    maxAmt: amountOrNull(row.maxAmt, 'Max', index + 1),
    currency: currencyCode(row.currency),
    mandatory: !!row.mandatory,
    type: CHARGE_TYPES.includes(row.type) ? row.type : 'Taxable',
  };
  if (charge.rate == null && charge.basis !== 'Actuals')
    throw new BadRequestError(`Charge row ${index + 1}: Rate is required`);
  if (charge.minAmt != null && charge.maxAmt != null && charge.minAmt > charge.maxAmt) {
    throw new BadRequestError(`Charge row ${index + 1}: Min is more than Max`);
  }
  return charge;
}

function transportRow(row, index, chargeName) {
  const fromLoc = String(row.fromLoc || '').trim();
  const toLoc = String(row.toLoc || '').trim();
  if (!fromLoc || !toLoc) throw new BadRequestError(`Transport row ${index + 1}: From and To are required`);
  const amount = amountOrNull(row.amount, 'Amount', index + 1);
  if (amount == null) throw new BadRequestError(`Transport row ${index + 1}: Amount is required`);
  return {
    fromLoc: fromLoc.slice(0, 100),
    toLoc: toLoc.slice(0, 100),
    vehicle: String(row.vehicle || '').slice(0, 40) || null,
    amount,
    currency: currencyCode(row.currency),
    chargeName: chargeName(row.chargeName, 'Transport', index, false),
  };
}

/** The contract from the form, checked: header and the freight / charge / transport rows. */
async function readContract(body) {
  const head = contractHeader(body, await loadParty(body.partyId));
  const chargeName = await gstChargeNameLookup();
  const freight = rowsOf(body.freightRates)
    .filter((row) => row && (row.origin || row.destination || row.normal || row.min))
    .map((row, index) => freightRow(row, index, chargeName));
  assertNoDuplicateFreight(freight);
  const charges = rowsOf(body.charges)
    .filter((row) => row && (row.printName || row.rate))
    .map((row, index) => chargeRow(row, index, chargeName));
  const transport = rowsOf(body.transportRates)
    .filter((row) => row && (row.fromLoc || row.toLoc || row.amount))
    .map((row, index) => transportRow(row, index, chargeName));
  return { head, freight, charges, transport };
}

const contractNumber = (yearSuffix, serial) => `CONT/${yearSuffix}/${String(serial).padStart(4, '0')}`;

async function nextContractNumber(transaction) {
  const yearSuffix = String(new Date().getFullYear()).slice(2);
  const last = await CustomerContract.findOne({
    where: { contractNo: { [Op.like]: `CONT/${yearSuffix}/%` } },
    order: [['id', 'DESC']],
    transaction,
  });
  let serial = last ? (parseInt(String(last.contractNo).split('/').pop(), 10) || 0) + 1 : 1;
  while (await CustomerContract.findOne({ where: { contractNo: contractNumber(yearSuffix, serial) }, transaction }))
    serial++;
  return contractNumber(yearSuffix, serial);
}

async function replaceContractRows(contractId, contract, transaction) {
  await ContractFreightRate.destroy({ where: { contractId }, transaction });
  await ContractCharge.destroy({ where: { contractId }, transaction });
  await ContractTransportRate.destroy({ where: { contractId }, transaction });
  const withContract = (rows) => rows.map((row) => ({ ...row, contractId }));
  if (contract.freight.length) await ContractFreightRate.bulkCreate(withContract(contract.freight), { transaction });
  if (contract.charges.length) await ContractCharge.bulkCreate(withContract(contract.charges), { transaction });
  if (contract.transport.length)
    await ContractTransportRate.bulkCreate(withContract(contract.transport), { transaction });
}

const contractWithRows = (contractId) => CustomerContract.findByPk(contractId, { include: WITH_ROWS });

async function findContract(contractId) {
  const contract = await CustomerContract.findByPk(contractId);
  if (!contract) throw new NotFoundError('Contract not found');
  return contract;
}

export async function listContracts(query) {
  await ensureContractTables();
  const where = {};
  if (query.partyId) where.partyId = parseInt(query.partyId, 10) || 0;
  if (query.status) where.status = String(query.status);
  const rows = await CustomerContract.findAll({
    where,
    attributes: { exclude: ['terms'] },
    order: [['id', 'DESC']],
    limit: LIST_LIMIT,
  });
  const today = new Date().toISOString().slice(0, 10);
  return { success: true, data: rows.map((row) => ({ ...row.toJSON(), expired: row.validTo < today })) };
}

export async function getContract(contractId) {
  await ensureContractTables();
  const contract = await contractWithRows(contractId);
  if (!contract) throw new NotFoundError('Contract not found');
  return { success: true, data: contract };
}

export async function createContract(body, actorName) {
  await ensureContractTables();
  const form = body || {};
  const contract = await readContract(form);
  const created = await sequelize.transaction(async (transaction) => {
    const header = await CustomerContract.create(
      {
        ...contract.head,
        contractNo: await nextContractNumber(transaction),
        status: form.submit ? 'Pending Approval' : 'Draft',
        createdBy: actorName,
      },
      { transaction },
    );
    await replaceContractRows(header.id, contract, transaction);
    return header;
  });
  return { success: true, data: await contractWithRows(created.id) };
}

// a changed Active contract goes back for approval; submit = send for approval
function statusAfterEdit(currentStatus, submit) {
  if (submit || currentStatus === 'Active') return 'Pending Approval';
  return currentStatus === 'Rejected' ? 'Draft' : currentStatus;
}

export async function updateContract(contractId, body, { isAdmin }) {
  await ensureContractTables();
  const existing = await findContract(contractId);
  if (existing.status === 'Active' && !isAdmin)
    throw new ForbiddenError('An Active contract can be changed only by an admin');
  const form = body || {};
  const contract = await readContract(form);
  const status = statusAfterEdit(existing.status, form.submit);
  await sequelize.transaction(async (transaction) => {
    const approval = status !== 'Active' ? { approvedBy: null, approvedAt: null } : {};
    await existing.update({ ...contract.head, status, ...approval }, { transaction });
    await replaceContractRows(existing.id, contract, transaction);
  });
  return { success: true, data: await contractWithRows(existing.id) };
}

/** Approve (Active) / reject / back to draft - admin only. */
export async function setContractStatus(contractId, body, { isAdmin, actorName }) {
  await ensureContractTables();
  const status = String((body && body.status) || '');
  if (!STATUSES.includes(status) || status === 'Pending Approval')
    throw new BadRequestError('Status must be Active, Rejected or Draft');
  if (!isAdmin) throw new ForbiddenError('Only an admin can approve or reject a contract');
  const contract = await findContract(contractId);
  if (status === 'Active' && contract.status !== 'Pending Approval') {
    throw new BadRequestError('Only a contract sent for approval can be approved');
  }
  const approved = status === 'Active';
  await contract.update({ status, approvedBy: approved ? actorName : null, approvedAt: approved ? new Date() : null });
  return { success: true, data: contract };
}

export async function deleteContract(contractId, { isAdmin }) {
  await ensureContractTables();
  const contract = await findContract(contractId);
  if (contract.status === 'Active' && !isAdmin)
    throw new ForbiddenError('An Active contract can be deleted only by an admin');
  await sequelize.transaction(async (transaction) => {
    await replaceContractRows(contract.id, { freight: [], charges: [], transport: [] }, transaction);
    await contract.destroy({ transaction });
  });
  return { success: true };
}
