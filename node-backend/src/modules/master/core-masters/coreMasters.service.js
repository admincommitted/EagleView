import { Op } from 'sequelize';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import {
  AeoMaster,
  Airline,
  Airport,
  Bond,
  Charge,
  City,
  Country,
  Currency,
  Drawback,
  ESanchit,
  ExportPolicy,
  IataAgent,
  ItemTemplate,
  License,
  Party,
  Port,
  Rodtep,
  Rosctl,
  RspAbatement,
  SchemeCode,
  ShippingLine,
  SpecialHandlingCode,
  State,
  TariffDutyComponent,
  Transporter,
  Uqc,
  Vessel,
  Warehouse,
} from '../../../models/index.js';
import { ensureColumns } from '../../../utils/db/ensureColumns.js';
import { cleanBody } from '../shared/cleanBody.js';
import { partyIncludes, replacePartyChildren } from '../party/party.service.js';

/** IATA special handling codes (the GET /:category fallback list). */
export const SPH_CODES = [
  { code: 'ACT', description: 'Active Temperature Controlled System' },
  { code: 'AOG', description: 'Aircraft on Ground' },
  { code: 'ATT', description: 'Goods Attached to Air Waybill' },
  { code: 'AVI', description: 'Live Animal' },
  { code: 'BIG', description: 'Outsized Cargo' },
  { code: 'BUP', description: 'Bulk Unitization Programme' },
  { code: 'CAO', description: 'Cargo Aircraft Only' },
  { code: 'CAT', description: 'Cargo Attendant Accompanying' },
  { code: 'COL', description: 'Cool Goods' },
  { code: 'COM', description: 'Company Mail' },
  { code: 'CRT', description: 'Control Room Temperature' },
  { code: 'DGD', description: 'Dangerous Goods Declaration' },
  { code: 'DIP', description: 'Diplomatic Mail' },
  { code: 'EAP', description: 'e-Freight with Paper Documents' },
  { code: 'EAT', description: 'Foodstuffs' },
  { code: 'EAW', description: 'e-Freight without Paper Documents' },
  { code: 'FIL', description: 'Undeveloped Film' },
  { code: 'FRI', description: 'Freezing Cargo' },
  { code: 'GEN', description: 'General Cargo' },
  { code: 'HEG', description: 'Hatching Eggs' },
  { code: 'HUM', description: 'Human Remains' },
  { code: 'LHO', description: 'Living Human Organs' },
  { code: 'MAG', description: 'Magnetized Material' },
  { code: 'MUW', description: 'Munitions of War' },
  { code: 'OBX', description: 'Obnoxious Cargo' },
  { code: 'OHG', description: 'Overhang Cargo' },
  { code: 'PAC', description: 'Passenger and Cargo' },
  { code: 'PEF', description: 'Flowers' },
  { code: 'PEM', description: 'Meat' },
  { code: 'PER', description: 'Perishable Cargo' },
  { code: 'PES', description: 'Seafood' },
  { code: 'PIL', description: 'Pharmaceuticals' },
  { code: 'QTA', description: 'High Risk Cargo' },
  { code: 'RAC', description: 'Reserved Air Cargo' },
  { code: 'RDS', description: 'Radioactive Material' },
  { code: 'SAL', description: 'Surface Mail' },
  { code: 'SEC', description: 'Security Cargo' },
  { code: 'SHL', description: 'Save Human Life' },
  { code: 'SOC', description: 'Shipper Owned Container' },
  { code: 'SPX', description: 'Secure for Passenger & Cargo' },
  { code: 'VAL', description: 'Valuable Cargo' },
  { code: 'VOL', description: 'Volume Cargo' },
  { code: 'VUN', description: 'Vulnerable Cargo' },
  { code: 'WET', description: 'Wet Cargo' },
];

/** The generic masters of GET / POST / PUT / DELETE /api/masters/:category (category in lower case). */
const MODELS_BY_CATEGORY = {
  airports: Airport,
  airlines: Airline,
  iataagents: IataAgent,
  currencies: Currency,
  specialhandlingcodes: SpecialHandlingCode,
  countries: Country,
  charges: Charge,
  parties: Party,
  shippers: Party,
  consignees: Party,
  agents: Party,
  subagents: Party,
  ports: Port,
  vessels: Vessel,
  transporters: Transporter,
  itemtemplates: ItemTemplate,
  tariffdutycomponents: TariffDutyComponent,
  warehouses: Warehouse,
  states: State,
  cities: City,
  uqcs: Uqc,
  bonds: Bond,
  shippinglines: ShippingLine,
  licenses: License,
  aeomasters: AeoMaster,
  drawbacks: Drawback,
  rodteps: Rodtep,
  rosctls: Rosctl,
  exportpolicies: ExportPolicy,
  rspabatements: RspAbatement,
  esanchits: ESanchit,
  schemecodes: SchemeCode,
};

// party categories that are a filtered view of the Party master
const PARTY_ROLE_FLAGS = {
  shippers: 'isShipper',
  consignees: 'isConsignee',
  agents: 'isOverseasAgent',
  subagents: 'isSubAgent',
};

// masters switched off instead of deleted (isActive); job / AWB screens get the rows not switched off
const SWITCHABLE = {
  vessels: Vessel,
  transporters: Transporter,
  warehouses: Warehouse,
  iataagents: IataAgent,
  itemtemplates: ItemTemplate,
};

// job screens get active rows only; the master screens ask for ?all=1
const ACTIVE_ONLY_CATEGORIES = ['rodteps', 'rosctls', 'drawbacks', 'licenses', 'shippinglines'];

const IEC_PATTERN = /^[a-zA-Z0-9]{10}$/;
const IEC_LENGTH = 10;
const IEC_MESSAGE = 'IEC Number must be exactly 10 alphanumeric characters when IEC NO. REQD. is checked.';
// a party's KYC fields change only through KYC approval
const KYC_FIELDS = ['kycStatus', 'kycApproved', 'kycLastSentAt'];

const switchColumnChecks = {};

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { error: message } });

const getModel = (category) => {
  const key = category.toLowerCase();
  return Object.hasOwn(MODELS_BY_CATEGORY, key) ? MODELS_BY_CATEGORY[key] : null;
};

async function addSwitchColumn(Model) {
  try {
    await ensureColumns(Model);
  } catch {
    // checked again at the next start
  }
}

/** The isActive column of a switchable master is checked once, before its first read / write. */
function ensureSwitch(category) {
  if (!SWITCHABLE[category]) return Promise.resolve();
  if (!switchColumnChecks[category]) switchColumnChecks[category] = addSwitchColumn(SWITCHABLE[category]);
  return switchColumnChecks[category];
}

/** The model of a category (its switch column checked first); 404 when there is no such master. */
export async function modelOfCategory(category) {
  await ensureSwitch(category);
  const Model = getModel(category);
  if (!Model) throw failed(NotFoundError, 'Master category not found');
  return Model;
}

/** GET /api/masters/parties without ?type / ?q is the cached full list (see party.service.js). */
export const wantsFullPartyList = (category, query) => category === 'parties' && !query.type && !query.q;

function categoryWhere(category, query) {
  if (PARTY_ROLE_FLAGS[category]) return { [PARTY_ROLE_FLAGS[category]]: true };
  if (query.all) return null;
  if (ACTIVE_ONLY_CATEGORIES.includes(category)) return { isActive: true };
  // airlines marked INACTIVE (duplicate prefixes) are left out
  if (category === 'airlines') return { [Op.or]: [{ status: null }, { status: { [Op.ne]: 'INACTIVE' } }] };
  if (SWITCHABLE[category]) return { [Op.or]: [{ isActive: null }, { isActive: true }] };
  if (category === 'ports') return { isActive: true };
  return null;
}

/** The rows of a generic master; party categories come with their addresses and codes. */
export async function findCategoryRows(category, Model, query) {
  const include = Model.name === 'Party' ? partyIncludes() : [];
  const where = categoryWhere(category, query);
  if (PARTY_ROLE_FLAGS[category]) return Model.findAll({ where, include });
  if (where) return Model.findAll({ where });
  return Model.findAll({ include });
}

function checkPartyIec(category, body) {
  if (category !== 'parties') return;
  const iecRequired = body.iecNoReqd;
  if (iecRequired !== true && iecRequired !== 'true') return;
  const iec = body.taxId;
  if (!iec || iec.length !== IEC_LENGTH || !IEC_PATTERN.test(iec)) throw failed(BadRequestError, IEC_MESSAGE);
}

export async function createCategoryItem(category, body) {
  const Model = await modelOfCategory(category);
  checkPartyIec(category, body);
  const payload = cleanBody(Model, body);
  if (PARTY_ROLE_FLAGS[category]) payload[PARTY_ROLE_FLAGS[category]] = true;
  return Model.create(payload);
}

/** A party's address / AD code / drawback lists sent with the edit replace the saved ones. */
export async function updateCategoryItem(category, id, body) {
  const Model = await modelOfCategory(category);
  checkPartyIec(category, body);
  const primaryKey = Model.primaryKeyAttribute || 'id';
  const changes = cleanBody(Model, body, { keepPk: false });
  if (category === 'parties') for (const field of KYC_FIELDS) delete changes[field];
  const [updatedCount] = await Model.update(changes, { where: { [primaryKey]: id } });
  if (updatedCount === 0) throw failed(NotFoundError, 'Item not found');
  if (category === 'parties') await replacePartyChildren(id, body);
  return Model.findByPk(id, { include: category === 'parties' ? partyIncludes() : undefined });
}

export async function deleteCategoryItem(category, id) {
  const Model = await modelOfCategory(category);
  const primaryKey = Model.primaryKeyAttribute || 'id';
  const deletedCount = await Model.destroy({ where: { [primaryKey]: id } });
  if (!deletedCount) throw failed(NotFoundError, 'Item not found');
}

/** POST /seed: a few demo rows for a test database. */
export async function seedMasters() {
  await AeoMaster.bulkCreate(
    [
      { aeoCode: 'AEOIN12345678', aeoRole: 'EX', countryCode: 'IN', countryName: 'INDIA' },
      { aeoCode: 'AEOUS99999999', aeoRole: 'IM', countryCode: 'US', countryName: 'UNITED STATES' },
      { aeoCode: 'AEOGB11111111', aeoRole: 'CH', countryCode: 'GB', countryName: 'UNITED KINGDOM' },
    ],
    {},
  );
  await Airport.bulkCreate(
    [
      { code: 'DEL', name: 'Indira Gandhi International Airport', countryCode: 'IN' },
      { code: 'JFK', name: 'John F. Kennedy International Airport', countryCode: 'US' },
      { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj', countryCode: 'IN' },
    ],
    {},
  );
  await Airline.bulkCreate(
    [
      { code: 'AM', name: 'AEROMEXICO', prefix: '139' },
      { code: 'EK', name: 'EMIRATES', prefix: '176' },
    ],
    {},
  );
  await Currency.bulkCreate(
    [
      { code: 'INR', name: 'Indian Rupee' },
      { code: 'USD', name: 'US Dollar' },
    ],
    {},
  );
  await Country.bulkCreate(
    [
      { code: 'IN', name: 'India' },
      { code: 'US', name: 'United States' },
    ],
    {},
  );
  await Party.bulkCreate(
    [
      {
        partyType: 'SHIPPER',
        code: 'SHP001',
        name: 'COMMITTED EXPORTS',
        street: 'Phase 1',
        city: 'Delhi',
        state: 'DL',
        country: 'IN',
        zip: '110020',
      },
      {
        partyType: 'CONSIGNEE',
        code: 'CON001',
        name: 'GLOBAL IMPORTS INC',
        street: '5th Ave',
        city: 'New York',
        state: 'NY',
        country: 'US',
        zip: '10001',
      },
      { partyType: 'AGENT', code: 'AGT001', name: 'IATA FREIGHT AGENT', city: 'Delhi', country: 'IN' },
    ],
    {},
  );
  return { message: 'All dedicated Master data seeded successfully!' };
}
