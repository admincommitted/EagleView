import { badRequest } from './shipments.errors.js';
import { execute, selectRows } from './shipments.tables.js';

/**
 * Every field of the docket reads its master (Master Directory): parties (with the iCAFFE party directory as a
 * fallback), party addresses, airports / ports, airlines / lines, vessels, users, cost centres, CHA, warehouses / CFS,
 * UQC, countries, states (place of supply), currencies, quotations and the customs jobs.
 */
const MAX_PARTY_ROWS = 20;
const MIN_DIRECTORY_SEARCH = 2;

const quietRows = (sql, replacements) => selectRows(sql, replacements).catch(() => []);
const placeholders = (values) => values.map(() => '?').join(',');

/** One address line; India is not written out. */
const addressOf = (branch) =>
  [
    branch.address1,
    branch.address2,
    branch.city,
    branch.state,
    branch.pinCode,
    branch.country && !/^(IN|INDIA)$/i.test(branch.country) ? branch.country : '',
  ]
    .filter(Boolean)
    .join(', ');

/** Party master flags of each party role on the docket. */
const PARTY_ROLE_CONDITION = {
  shipper: 'isShipper = 1',
  consignee: '(isConsignee = 1 OR isShipper = 1)',
  foreign: "(isConsignee = 1 OR isBuyer = 1 OR coalesce(countryCode, 'IN') <> 'IN')",
  overseas: 'isOverseasAgent = 1',
  subagent: 'isSubAgent = 1',
  notify: '(isNotifyParty = 1 OR isConsignee = 1 OR isShipper = 1)',
  buyer: '(isBuyer = 1 OR isConsignee = 1)',
  cha: '1 = 1',
  carrier: 'isShipline = 1',
  iata: 'isIataAgent = 1',
};

/** iCAFFE directory party types of each role; notify party and buyer also look in the consignees (foreign buyers / suppliers). */
const ICAFFE_TYPES_OF_ROLE = {
  shipper: ['EXPORTER'],
  consignee: ['EXPORTER', 'CONSIGNEE'],
  foreign: ['CONSIGNEE'],
  overseas: ['OVERSEAS_AGENT'],
  subagent: ['SUBAGENT'],
  carrier: ['SHIPLINE'],
  iata: ['IATA_AGENT'],
  notify: ['CONSIGNEE', 'EXPORTER'],
  buyer: ['CONSIGNEE'],
};

const parseJsonList = (text) => {
  try {
    return JSON.parse(text || '[]');
  } catch {
    return [];
  }
};

/** The customer's KAM in the Sales module is the docket's marketing person (by party id, ledger party or name). */
async function kamByParty(parties) {
  const kamOf = new Map();
  const ids = parties.map((party) => party.id);
  if (!ids.length) return kamOf;
  const names = parties.map((party) => String(party.name).trim().toUpperCase());
  const rows = await quietRows(
    `SELECT c.partyId, upper(trim(c.name)) nm, l.partyId lp, sp.name kam FROM SalesCustomers c JOIN SalesPersons sp ON sp.id = c.kamId LEFT JOIN AccountLedgers l ON l.id = c.ledgerId
          WHERE c.partyId IN (${ids.join(',')}) OR l.partyId IN (${ids.join(',')}) OR upper(trim(c.name)) IN (${placeholders(parties)})`,
    names,
  );
  for (const row of rows) {
    if (row.partyId) kamOf.set(row.partyId, row.kam);
    if (row.lp) kamOf.set(row.lp, row.kam);
    kamOf.set(row.nm, row.kam);
  }
  return kamOf;
}

async function partyMasterMatches(search, role) {
  const like = '%' + search + '%';
  const condition = PARTY_ROLE_CONDITION[role] || '1 = 1';
  const parties = await quietRows(
    `SELECT id, code, name, email, marketingPerson1, countryCode FROM Parties WHERE ${condition} AND coalesce(blackList, 0) = 0 AND name LIKE ? ORDER BY (name LIKE ?) DESC, name LIMIT 20`,
    [like, search + '%'],
  );
  const ids = parties.map((party) => party.id);
  const kamOf = await kamByParty(parties);
  const branches = ids.length
    ? await quietRows(
        `SELECT id, partyId, branchName, address1, address2, city, state, country, pinCode, gstin, email1 FROM PartyBranches WHERE partyId IN (${ids.join(',')}) AND coalesce(disabled, 0) = 0 ORDER BY isDefault DESC, id`,
      )
    : [];
  return parties.map((party) => {
    const partyBranches = branches.filter((branch) => branch.partyId === party.id);
    const firstBranch = partyBranches[0] || {};
    return {
      id: party.id,
      partyCode: party.code || '',
      name: party.name,
      address: addressOf(firstBranch),
      gstin: firstBranch.gstin || '',
      state: firstBranch.state || '',
      email: firstBranch.email1 || party.email || '',
      marketingPerson:
        kamOf.get(party.id) || kamOf.get(String(party.name).trim().toUpperCase()) || party.marketingPerson1 || '',
      branches: partyBranches.length,
      src: 'Party Master',
    };
  });
}

/** Names not in the party master yet: the imported iCAFFE party directory (1.5 lakh names). */
async function icaffeDirectoryMatches(search, role, rows) {
  const like = '%' + search + '%';
  const types = ICAFFE_TYPES_OF_ROLE[role];
  const seen = new Set(rows.map((row) => row.name.toUpperCase()));
  const typeCondition = types ? ` AND partyType IN (${placeholders(types)})` : '';
  const directory = await quietRows(
    `SELECT id, code, name, partyType, email, gstin, addresses, city, countryCode FROM IcaffeParties WHERE importedPartyId IS NULL AND coalesce(isActive, 1) = 1 AND name LIKE ?${typeCondition} ORDER BY (name LIKE ?) DESC, name LIMIT ?`,
    [like, ...(types || []), search + '%', MAX_PARTY_ROWS - rows.length],
  );
  const matches = [];
  for (const entry of directory) {
    if (seen.has(String(entry.name).toUpperCase())) continue;
    const addresses = parseJsonList(entry.addresses);
    const address = addresses.find((item) => item.isDefault) ||
      addresses[0] || { city: entry.city, country: entry.countryCode };
    matches.push({
      id: null,
      icaffeId: entry.id,
      partyCode: entry.code || '',
      name: entry.name,
      address: addressOf(address),
      gstin: entry.gstin || address.gstin || '',
      state: address.state || '',
      email: entry.email || '',
      branches: addresses.length,
      src:
        'iCAFFE directory - ' +
        String(entry.partyType || '')
          .replace('_', ' ')
          .toLowerCase(),
    });
  }
  return matches;
}

async function lookupParties(search, role) {
  const rows = await partyMasterMatches(search, role);
  if (rows.length < MAX_PARTY_ROWS && search.length >= MIN_DIRECTORY_SEARCH)
    rows.push(...(await icaffeDirectoryMatches(search, role, rows)));
  return rows;
}

/** The party's addresses, for the address picker next to each party. */
async function partyIdByName(name) {
  if (!name) return null;
  return (
    (await selectRows('SELECT id FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [String(name).trim()]))[0] || {}
  ).id;
}

async function lookupPartyAddresses(query) {
  const partyId = Number(query.partyId) || (await partyIdByName(query.name));
  if (partyId) {
    const branches = await quietRows(
      'SELECT id, branchName, address1, address2, city, state, country, pinCode, gstin, email1, phone, contactPerson, isDefault FROM PartyBranches WHERE partyId = ? AND coalesce(disabled, 0) = 0 ORDER BY isDefault DESC, id',
      [partyId],
    );
    return branches.map((branch) => ({
      id: branch.id,
      name: branch.branchName || 'Address',
      address: addressOf(branch),
      gstin: branch.gstin || '',
      email: branch.email1 || '',
      phone: branch.phone || '',
      contact: branch.contactPerson || '',
      state: branch.state || '',
      isDefault: !!branch.isDefault,
    }));
  }
  if (!query.icaffeId) return [];
  const entry = (await selectRows('SELECT addresses FROM IcaffeParties WHERE id = ?', [Number(query.icaffeId)]))[0];
  return parseJsonList(entry && entry.addresses).map((address, index) => ({
    id: index,
    name: address.branchName || address.city || 'Address ' + (index + 1),
    address: addressOf(address),
    phone: address.phone || '',
    isDefault: !!address.isDefault,
  }));
}

/** The simple masters: what = airport, port, airline ... -> rows of { code, name, country ... }. */
const MASTER_LOOKUPS = {
  airport: ({ like, upper }) =>
    quietRows(
      'SELECT code, name, countryCode country FROM Airports WHERE code LIKE ? OR name LIKE ? ORDER BY (code = ?) DESC, name LIMIT 20',
      [like, like, upper],
    ),
  port: async ({ like, upper }) => [
    ...(await quietRows(
      'SELECT portCode code, portName name, country FROM Ports WHERE coalesce(isActive, 1) = 1 AND (portCode LIKE ? OR portName LIKE ?) ORDER BY (portCode = ?) DESC LIMIT 12',
      [like, like, upper],
    )),
    ...(await quietRows(
      'SELECT code, name, countryCode country FROM ForeignPorts WHERE coalesce(isActive, 1) = 1 AND (code LIKE ? OR name LIKE ?) ORDER BY (code = ?) DESC LIMIT 15',
      [like, like, upper],
    )),
  ],
  airline: ({ like, upper }) =>
    quietRows(
      "SELECT name, code2 code, prefix FROM Airlines WHERE coalesce(status, 'ACTIVE') <> 'INACTIVE' AND (name LIKE ? OR code2 LIKE ? OR prefix LIKE ? OR code3 LIKE ?) ORDER BY (code2 = ? OR prefix = ?) DESC, name LIMIT 20",
      [like, like, like, like, upper, upper],
    ),
  line: ({ like }) =>
    quietRows(
      'SELECT name, code FROM ShippingLines WHERE coalesce(isActive, 1) = 1 AND (name LIKE ? OR code LIKE ?) ORDER BY name LIMIT 20',
      [like, like],
    ),
  vessel: ({ like }) =>
    quietRows(
      'SELECT vesselName name, imoNumber code, carrierAgent country FROM Vessels WHERE vesselName LIKE ? OR imoNumber LIKE ? ORDER BY vesselName LIMIT 20',
      [like, like],
    ),
  // marketing person = a sales person of the Sales module, then the users
  salesperson: async ({ like }) => [
    ...(await quietRows(
      "SELECT name, coalesce(role, '') || CASE WHEN coalesce(branchCodes, '') <> '' THEN ' - ' || branchCodes ELSE '' END country FROM SalesPersons WHERE coalesce(isActive, 1) = 1 AND (name LIKE ? OR coalesce(aliases, '') LIKE ? OR coalesce(code, '') LIKE ?) ORDER BY name LIMIT 20",
      [like, like, like],
    )),
    ...(await quietRows(
      "SELECT coalesce(nullif(fullName, ''), username) name, coalesce(designation, '') country FROM Users WHERE (coalesce(fullName, '') || ' ' || coalesce(username, '')) LIKE ? ORDER BY 1 LIMIT 10",
      [like],
    )),
  ],
  user: async ({ like }) => [
    ...(await quietRows(
      "SELECT coalesce(nullif(fullName, ''), username) name, coalesce(designation, '') || CASE WHEN coalesce(branch, '') <> '' THEN ' - ' || branch ELSE '' END country FROM Users WHERE coalesce(fullName, '') || ' ' || coalesce(username, '') LIKE ? ORDER BY 1 LIMIT 20",
      [like],
    )),
    ...(await quietRows(
      "SELECT trim(coalesce(firstName, '') || ' ' || coalesce(lastName, '')) name, coalesce(designation, '') country FROM EmployeeMasters WHERE coalesce(status, 'Active') <> 'Inactive' AND coalesce(firstName, '') || ' ' || coalesce(lastName, '') LIKE ? LIMIT 20",
      [like],
    )),
  ],
  costcentre: ({ like }) => quietRows('SELECT name FROM CostCentres WHERE name LIKE ? ORDER BY name LIMIT 20', [like]),
  cha: async ({ like }) => [
    ...(await quietRows(
      'SELECT chaName name, chaCode code, chaAddress address FROM ChaMasters WHERE chaName LIKE ? OR chaCode LIKE ? ORDER BY isDefault DESC, chaName LIMIT 10',
      [like, like],
    )),
  ],
  warehouse: ({ like, upper }) =>
    quietRows(
      "SELECT warehouseCode code, warehouseName name, coalesce(linkedPortCode, '') || CASE WHEN coalesce(address, '') <> '' THEN ' - ' || address ELSE '' END country FROM Warehouses WHERE warehouseCode LIKE ? OR warehouseName LIKE ? OR linkedPortCode LIKE ? ORDER BY (linkedPortCode = ?) DESC, warehouseName LIMIT 20",
      [like, like, like, upper],
    ),
  uqc: ({ like, upper }) =>
    quietRows(
      'SELECT uqcCode code, description name FROM Uqcs WHERE coalesce(isActive, 1) = 1 AND (uqcCode LIKE ? OR description LIKE ?) ORDER BY (uqcCode = ?) DESC, uqcCode LIMIT 20',
      [like, like, upper],
    ),
  country: ({ like, upper }) =>
    quietRows(
      'SELECT code, name FROM Countries WHERE code LIKE ? OR name LIKE ? ORDER BY (code = ?) DESC, name LIMIT 20',
      [like, like, upper],
    ),
  state: ({ like, search, upper }) =>
    quietRows(
      'SELECT taxCode code, stateName name FROM States WHERE countryId = 1 AND (stateName LIKE ? OR taxCode = ? OR stateCode = ?) ORDER BY stateName LIMIT 40',
      [like, search, upper],
    ),
  currency: async ({ like, upper }) =>
    (
      await quietRows(
        'SELECT currencyCode code, currencyName name, importRate, exportRate FROM Currencies WHERE currencyCode LIKE ? OR currencyName LIKE ? ORDER BY (currencyCode = ?) DESC, standard DESC, currencyCode LIMIT 20',
        [like, like, upper],
      )
    ).map((currency) => ({
      ...currency,
      country: 'Import ' + (currency.importRate || '-') + ' / Export ' + (currency.exportRate || '-'),
    })),
  // active customer contracts too (Customer Contract & Quotation Master) - the Provisional Sheet bills at its rates
  quotation: async ({ like }) => [
    ...(await quietRows(
      "SELECT contractNo code, coalesce(partyName, '') name, 'Contract, valid to ' || coalesce(validTo, '') country FROM CustomerContracts WHERE status = 'Active' AND (contractNo LIKE ? OR partyName LIKE ?) ORDER BY id DESC LIMIT 20",
      [like, like],
    )),
    ...(await quietRows(
      "SELECT quoteNo code, coalesce(clientName, '') name, coalesce(origin, '') || ' > ' || coalesce(destination, '') || ' ' || coalesce(status, '') country FROM Quotations WHERE quoteNo LIKE ? OR clientName LIKE ? ORDER BY id DESC LIMIT 20",
      [like, like],
    )),
  ],
  edijob: async ({ like }) => [
    ...(await quietRows(
      "SELECT jobNo code, coalesce(nameOfImporter, '') name, 'Import' dir FROM ImportJobs WHERE jobNo LIKE ? LIMIT 10",
      [like],
    )),
    ...(await quietRows(
      "SELECT jobNo code, coalesce(shipperName, '') name, 'Export' dir FROM ExportJobs WHERE jobNo LIKE ? LIMIT 10",
      [like],
    )),
  ],
};

/** GET /lookup/:what?q=&type= */
export async function lookup(what, query) {
  const search = String(query.q || '').trim();
  if (what === 'party') return lookupParties(search, query.type);
  if (what === 'branches') return lookupPartyAddresses(query);
  const findRows = Object.hasOwn(MASTER_LOOKUPS, what) ? MASTER_LOOKUPS[what] : null;
  if (!findRows) return [];
  return findRows({ search, like: '%' + search + '%', upper: search.toUpperCase() });
}

const PARTY_FLAG_COLUMNS_SQL = `INSERT INTO Parties (partyType, code, name, city, email, taxId, stateProvince, zipPostcode, countryCode, phoneNumber, isShipper, isConsignee, isNotifyParty, isBuyer, isSubAgent, isOverseasAgent, isShipline, isIataAgent, panNumber, blackList, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?,0,?,?)`;
const PARTY_BRANCH_SQL =
  'INSERT INTO PartyBranches (partyId, branchName, address1, address2, city, state, country, pinCode, phone, branchSrNo, isDefault, gstin, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

const flagFor = (partyType, wanted) => (partyType === wanted ? 1 : 0);

async function insertPartyFromDirectory(entry, now) {
  const type = entry.partyType;
  const codeIsFree = entry.code && !(await selectRows('SELECT id FROM Parties WHERE code = ?', [entry.code])).length;
  await execute(PARTY_FLAG_COLUMNS_SQL, [
    type,
    codeIsFree ? entry.code : null,
    entry.name,
    entry.city || '',
    entry.email || '',
    entry.gstin || entry.iec || '',
    entry.state || '',
    entry.pinCode || '',
    entry.countryCode || 'IN',
    entry.phone || '',
    flagFor(type, 'EXPORTER'),
    flagFor(type, 'CONSIGNEE'),
    flagFor(type, 'SUBAGENT'),
    flagFor(type, 'OVERSEAS_AGENT'),
    flagFor(type, 'SHIPLINE'),
    flagFor(type, 'IATA_AGENT'),
    entry.pan || '',
    now,
    now,
  ]);
  return (await selectRows('SELECT id FROM Parties WHERE name = ? ORDER BY id DESC LIMIT 1', [entry.name]))[0].id;
}

async function insertPartyAddresses(partyId, entry, addresses, now) {
  const rows = addresses.length
    ? addresses
    : [{ city: entry.city, pinCode: entry.pinCode, country: entry.countryCode, phone: entry.phone, isDefault: true }];
  let serial = 0;
  for (const address of rows) {
    serial++;
    await execute(PARTY_BRANCH_SQL, [
      partyId,
      address.branchName || address.city || 'HEAD OFFICE',
      address.address1 || '',
      address.address2 || '',
      address.city || '',
      address.state || '',
      address.country || entry.countryCode || '',
      address.pinCode || '',
      address.phone || address.mobile || '',
      String(serial),
      address.isDefault || serial === 1 ? 1 : 0,
      address.gstin || (serial === 1 ? entry.gstin : null) || null,
      now,
      now,
    ]);
  }
}

/** An iCAFFE directory name picked on the docket is copied into the party master (with its addresses) so it can be billed. */
export async function partyFromDirectory(icaffeId) {
  const entry = (await selectRows('SELECT * FROM IcaffeParties WHERE id = ?', [Number(icaffeId)]))[0];
  if (!entry) throw badRequest('Party not found in the iCAFFE directory');
  if (entry.importedPartyId) return { id: entry.importedPartyId, name: entry.name, already: true };
  const existing = (await selectRows('SELECT id FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [entry.name]))[0];
  if (existing) {
    await execute('UPDATE IcaffeParties SET importedPartyId = ? WHERE id = ?', [existing.id, entry.id]);
    return { id: existing.id, name: entry.name, already: true };
  }
  const now = new Date().toISOString();
  const addresses = parseJsonList(entry.addresses);
  const partyId = await insertPartyFromDirectory(entry, now);
  await insertPartyAddresses(partyId, entry, addresses, now);
  await execute('UPDATE IcaffeParties SET importedPartyId = ? WHERE id = ?', [partyId, entry.id]);
  return { id: partyId, name: entry.name };
}
