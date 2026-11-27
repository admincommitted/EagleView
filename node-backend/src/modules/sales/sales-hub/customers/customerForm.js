import { BadRequestError } from '../../../../core/http/index.js';
import {
  today,
  clean,
  upper,
  numOrNull,
  listOf,
  csv,
  CUSTOMER_STATUS,
  CUSTOMER_TYPES,
  SEGMENTS,
  SERVICES,
  VOLUME_UNITS,
  INCOTERMS,
  CONTAINER_TYPES,
  CREDIT_TERMS,
  GSTIN_RE,
  PAN_RE,
  EMAIL_RE,
} from '../../../../utils/common/salesHub.js';

const MOBILE_RE = /^\+?[0-9 -]{10,15}$/;
const IEC_RE = /^[A-Z0-9]{10}$/;
const INDIAN_PIN_RE = /^\d{6}$/;
const LANE_STATUSES = ['OPEN', 'QUOTED', 'WON', 'LOST'];
const NON_NEGATIVE_CUSTOMER_FIELDS = [
  'potentialAirKg',
  'potentialSeaFclTeu',
  'potentialSeaLclCbm',
  'potentialCustomsJobs',
  'potentialTrucks',
  'potentialRevenue',
  'creditDaysAsked',
  'creditLimitAsked',
];
const NON_NEGATIVE_LANE_FIELDS = ['shipmentsPerMonth', 'volumePerShipment', 'currentRate', 'targetRate'];

const isSwitchedOff = (value) => value === false || value === 0;
const hasCode = (list, code) => list.some((entry) => entry[0] === code);

function readCustomerFields(body, current) {
  return {
    ledgerId: body.ledgerId !== undefined ? numOrNull(body.ledgerId) : (current.ledgerId ?? null),
    partyId: body.partyId !== undefined ? numOrNull(body.partyId) : (current.partyId ?? null),
    name: clean(body.name),
    status: upper(body.status) || 'PROSPECT',
    customerType: upper(body.customerType),
    industry: clean(body.industry),
    segment: upper(body.segment),
    source: clean(body.source),
    sourceDetail: clean(body.sourceDetail),
    kamId: numOrNull(body.kamId),
    secondaryIds: csv(
      listOf(body.secondaryIds)
        .map(Number)
        .filter((id) => id && id !== numOrNull(body.kamId)),
    ),
    branchCode: upper(body.branchCode),
    services: csv(listOf(body.services).map((service) => service.toUpperCase())),
    address: clean(body.address),
    city: clean(body.city),
    state: clean(body.state),
    country: upper(body.country),
    pinCode: clean(body.pinCode),
    gstin: upper(body.gstin),
    pan: upper(body.pan),
    iec: upper(body.iec),
    website: clean(body.website),
    phone: clean(body.phone),
    email: clean(body.email),
    turnoverBand: clean(body.turnoverBand),
    employees: clean(body.employees),
    potentialAirKg: numOrNull(body.potentialAirKg),
    potentialSeaFclTeu: numOrNull(body.potentialSeaFclTeu),
    potentialSeaLclCbm: numOrNull(body.potentialSeaLclCbm),
    potentialCustomsJobs: numOrNull(body.potentialCustomsJobs),
    potentialTrucks: numOrNull(body.potentialTrucks),
    potentialRevenue: numOrNull(body.potentialRevenue),
    currentSharePct: numOrNull(body.currentSharePct),
    competitors: csv(body.competitors),
    creditTerm: upper(body.creditTerm),
    creditDaysAsked: numOrNull(body.creditDaysAsked),
    creditLimitAsked: numOrNull(body.creditLimitAsked),
    firstContactDate: clean(body.firstContactDate),
    nextReviewDate: clean(body.nextReviewDate),
    lostReason: clean(body.lostReason),
    lostTo: clean(body.lostTo),
    lostDate: clean(body.lostDate),
    remarks: clean(body.remarks),
  };
}

function customerCodeProblems(fields) {
  const problems = [];
  if (!fields.name) problems.push('Customer name is required');
  if (!hasCode(CUSTOMER_STATUS, fields.status)) problems.push('Unknown status ' + fields.status);
  if (fields.customerType && !hasCode(CUSTOMER_TYPES, fields.customerType))
    problems.push('Unknown customer type ' + fields.customerType);
  if (fields.segment && !hasCode(SEGMENTS, fields.segment)) problems.push('Unknown segment ' + fields.segment);
  for (const service of listOf(fields.services))
    if (!hasCode(SERVICES, service)) problems.push('Unknown service ' + service);
  if (fields.creditTerm && !hasCode(CREDIT_TERMS, fields.creditTerm))
    problems.push('Unknown credit term ' + fields.creditTerm);
  return problems;
}

function customerIdentityProblems(fields) {
  const problems = [];
  if (fields.gstin && !GSTIN_RE.test(fields.gstin))
    problems.push(`GSTIN "${fields.gstin}" is not a valid 15-character GSTIN`);
  if (fields.pan && !PAN_RE.test(fields.pan))
    problems.push(`PAN "${fields.pan}" is not valid (5 letters, 4 digits, 1 letter)`);
  if (fields.gstin && fields.pan && fields.gstin.slice(2, 12) !== fields.pan) {
    problems.push('PAN does not match the GSTIN (characters 3 to 12)');
  }
  if (fields.iec && !IEC_RE.test(fields.iec)) problems.push(`IEC "${fields.iec}" must be 10 letters / digits`);
  if (fields.email && !EMAIL_RE.test(fields.email)) problems.push(`E-mail "${fields.email}" is not valid`);
  if (fields.pinCode && fields.country === 'IN' && !INDIAN_PIN_RE.test(fields.pinCode))
    problems.push('PIN must be 6 digits');
  return problems;
}

function customerAmountProblems(fields) {
  const problems = [];
  for (const key of NON_NEGATIVE_CUSTOMER_FIELDS)
    if (fields[key] != null && fields[key] < 0) problems.push(key + ' cannot be negative');
  if (fields.currentSharePct != null && (fields.currentSharePct < 0 || fields.currentSharePct > 100)) {
    problems.push('Our share must be 0 to 100 %');
  }
  return problems;
}

// a lost customer keeps why / to whom / when; any other status clears them
function applyStatusRules(fields, problems) {
  if (fields.status === 'LOST' && !fields.lostReason) problems.push('A lost customer needs the reason it was lost');
  if (fields.status === 'LOST' && !fields.lostDate) fields.lostDate = today();
  if (fields.status !== 'LOST') {
    fields.lostReason = null;
    fields.lostTo = null;
    fields.lostDate = null;
  }
  if (fields.status === 'ACTIVE' && !fields.ledgerId) {
    problems.push(
      'An active customer must be linked to its accounts ledger (it is billed there) - keep it a prospect until then',
    );
  }
}

/** The customer's own fields, checked; throws with every problem found (`errors`). */
function customerFields(body, current = {}) {
  const fields = readCustomerFields(body, current);
  const problems = [
    ...customerCodeProblems(fields),
    ...customerIdentityProblems(fields),
    ...customerAmountProblems(fields),
  ];
  applyStatusRules(fields, problems);
  if (problems.length) throw new BadRequestError(problems[0], { errors: problems });
  return fields;
}

function readContact(contact) {
  return {
    name: clean(contact.name),
    designation: clean(contact.designation),
    department: clean(contact.department),
    mobile: clean(contact.mobile),
    phone: clean(contact.phone),
    email: clean(contact.email),
    whatsapp: clean(contact.whatsapp),
    isPrimary: contact.isPrimary ? 1 : 0,
    isDecisionMaker: contact.isDecisionMaker ? 1 : 0,
    sendQuotes: isSwitchedOff(contact.sendQuotes) ? 0 : 1,
    birthday: clean(contact.birthday),
    anniversary: clean(contact.anniversary),
    linkedin: clean(contact.linkedin),
    remarks: clean(contact.remarks),
    isActive: isSwitchedOff(contact.isActive) ? 0 : 1,
  };
}

function contactProblems(row, index) {
  const problems = [];
  const label = row.name || index + 1;
  if (!row.name) problems.push(`Contact ${index + 1}: name is required`);
  if (row.email && !EMAIL_RE.test(row.email)) problems.push(`Contact ${label}: e-mail "${row.email}" is not valid`);
  for (const key of ['mobile', 'whatsapp']) {
    if (row[key] && !MOBILE_RE.test(row[key]))
      problems.push(`Contact ${label}: ${key} "${row[key]}" must be 10 to 15 digits`);
  }
  if (!row.email && !row.mobile && !row.phone) problems.push(`Contact ${label}: give a mobile, phone or e-mail`);
  return problems;
}

/** Contact rows to save (blank rows dropped; the first one is primary when none is) and their problems. */
export function contactRows(list) {
  const rows = [];
  const problems = [];
  (Array.isArray(list) ? list : []).forEach((contact, index) => {
    const row = readContact(contact);
    if (!row.name && !row.email && !row.mobile) return;
    problems.push(...contactProblems(row, index));
    rows.push(row);
  });
  if (rows.filter((row) => row.isPrimary).length > 1) problems.push('Only one contact can be the primary contact');
  if (rows.length && !rows.some((row) => row.isPrimary)) rows[0].isPrimary = 1;
  return { out: rows, errs: problems };
}

function readLane(lane) {
  return {
    service: upper(lane.service),
    origin: upper(lane.origin),
    originCountry: upper(lane.originCountry),
    destination: upper(lane.destination),
    destinationCountry: upper(lane.destinationCountry),
    commodity: clean(lane.commodity),
    hsCode: clean(lane.hsCode),
    incoterm: upper(lane.incoterm),
    containerType: upper(lane.containerType),
    shipmentsPerMonth: numOrNull(lane.shipmentsPerMonth),
    volumePerShipment: numOrNull(lane.volumePerShipment),
    volumeUnit: upper(lane.volumeUnit),
    isDg: lane.isDg ? 1 : 0,
    isTempControlled: lane.isTempControlled ? 1 : 0,
    currentVendor: clean(lane.currentVendor),
    currentRate: numOrNull(lane.currentRate),
    rateCurrency: upper(lane.rateCurrency),
    rateBasis: clean(lane.rateBasis),
    targetRate: numOrNull(lane.targetRate),
    status: upper(lane.status) || 'OPEN',
    remarks: clean(lane.remarks),
    isActive: isSwitchedOff(lane.isActive) ? 0 : 1,
  };
}

function laneProblems(row, index) {
  const problems = [];
  const label = `Lane ${index + 1}`;
  if (!row.service || !hasCode(SERVICES, row.service)) problems.push(`${label}: pick the service`);
  if (!row.origin && !row.originCountry) problems.push(`${label}: origin is required`);
  if (!row.destination && !row.destinationCountry) problems.push(`${label}: destination is required`);
  if (row.incoterm && !INCOTERMS.includes(row.incoterm))
    problems.push(`${label}: incoterm ${row.incoterm} is not valid`);
  if (row.volumeUnit && !hasCode(VOLUME_UNITS, row.volumeUnit))
    problems.push(`${label}: unit ${row.volumeUnit} is not valid`);
  if (row.containerType && !CONTAINER_TYPES.includes(row.containerType)) {
    problems.push(`${label}: container type ${row.containerType} is not valid`);
  }
  if (/FCL/.test(row.service || '') && !row.containerType) problems.push(`${label}: FCL needs the container type`);
  for (const key of NON_NEGATIVE_LANE_FIELDS)
    if (row[key] != null && row[key] < 0) problems.push(`${label}: ${key} cannot be negative`);
  return problems;
}

/** Lane rows to save (blank rows dropped) and their problems. */
export function laneRows(list) {
  const rows = [];
  const problems = [];
  (Array.isArray(list) ? list : []).forEach((lane, index) => {
    const row = readLane(lane);
    if (!row.service && !row.origin && !row.destination && !row.commodity) return;
    problems.push(...laneProblems(row, index));
    if ((row.currentRate != null || row.targetRate != null) && !row.rateCurrency) row.rateCurrency = 'INR';
    if (!LANE_STATUSES.includes(row.status))
      problems.push(`Lane ${index + 1}: status must be OPEN, QUOTED, WON or LOST`);
    rows.push(row);
  });
  return { out: rows, errs: problems };
}

/** Checks the customer, its contacts and its lanes together; throws with every problem found (`errors`). */
export function validateCustomerForm(body, current) {
  const problems = [];
  let fields = null;
  try {
    fields = customerFields(body, current);
  } catch (error) {
    problems.push(...(error.errors || [error.message]));
  }
  if (body.contacts !== undefined) problems.push(...contactRows(body.contacts).errs);
  if (body.lanes !== undefined) problems.push(...laneRows(body.lanes).errs);
  if (problems.length) throw new BadRequestError(problems[0], { errors: problems });
  return fields;
}
