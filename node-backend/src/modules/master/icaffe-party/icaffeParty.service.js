import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { Party, PartyADCode, PartyBranch } from '../../../models/index.js';
import { clearPartyCache } from '../party/party.service.js';

/*
 * The iCAFFE party directory (table IcaffeParties, filled by load_icaffe_parties.js): exporters, consignees, agents,
 * shipping lines, IATA agents and banks - tens of thousands of rows, so it is searched here and NOT mixed into the
 * Party master the job screens load in full. A row is copied into the Party master when a job needs it.
 */
const TYPES = ['EXPORTER', 'CONSIGNEE', 'SUBAGENT', 'OVERSEAS_AGENT', 'SHIPLINE', 'IATA_AGENT', 'BANK'];
const IMPORTABLE_TYPES = ['EXPORTER', 'CONSIGNEE', 'SUBAGENT', 'OVERSEAS_AGENT', 'SHIPLINE'];
const PARTY_FLAG_BY_TYPE = {
  EXPORTER: 'isShipper',
  CONSIGNEE: 'isConsignee',
  SUBAGENT: 'isSubAgent',
  OVERSEAS_AGENT: 'isOverseasAgent',
  SHIPLINE: 'isShipline',
  IATA_AGENT: 'isIataAgent',
};
const PARTY_TYPE_BY_TYPE = {
  EXPORTER: 'SHIPPER',
  CONSIGNEE: 'CONSIGNEE',
  SUBAGENT: 'SUBAGENT',
  OVERSEAS_AGENT: 'AGENT',
  SHIPLINE: 'SHIPLINE',
  IATA_AGENT: 'IATA_AGENT',
};
const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;

const notFound = () => new NotFoundError('Not found', { body: { error: 'Not found' } });

const selectRows = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

const directoryLoaded = async () =>
  (await selectRows("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'IcaffeParties'")).length > 0;

const parseJson = (text, fallback) => {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
};

/** A directory row with its JSON columns read. */
const directoryEntryOf = (row) => ({
  ...row,
  addresses: parseJson(row.addresses, []),
  adCodes: parseJson(row.adCodes, []),
  dbkAccounts: parseJson(row.dbkAccounts, []),
  extra: parseJson(row.extra, {}),
});

/** GET /stats: rows per party type and how many are already in the Party master. */
export async function directoryStats() {
  if (!(await directoryLoaded())) return { loaded: false, types: [] };
  const types = await selectRows(
    'SELECT partyType, count(*) n, sum(CASE WHEN importedPartyId IS NOT NULL THEN 1 ELSE 0 END) imported ' +
      'FROM IcaffeParties GROUP BY partyType',
  );
  return { loaded: true, types };
}

/** GET /?q=&type=&limit= (name, code, IEC, PAN or GSTIN), names starting with the text first. */
export async function searchDirectory({ q, type: typeText, limit: limitText }) {
  if (!(await directoryLoaded())) return [];
  const text = String(q || '').trim();
  const type = String(typeText || '')
    .trim()
    .toUpperCase();
  const limit = Math.min(Math.max(parseInt(limitText, 10) || DEFAULT_SEARCH_LIMIT, 1), MAX_SEARCH_LIMIT);
  const conditions = [];
  const replacements = [];
  if (type && TYPES.includes(type)) {
    conditions.push('partyType = ?');
    replacements.push(type);
  }
  if (text) {
    const upperText = text.toUpperCase();
    conditions.push('(name LIKE ? OR code = ? OR iec = ? OR pan = ? OR gstin LIKE ?)');
    replacements.push(`%${text}%`, upperText, upperText, upperText, `%${upperText}%`);
  }
  const sql =
    `SELECT * FROM IcaffeParties${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}` +
    ' ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name LIMIT ?';
  replacements.push(`${text}%`, limit);
  return (await selectRows(sql, replacements)).map(directoryEntryOf);
}

export async function directoryEntry(id) {
  const [row] = await selectRows('SELECT * FROM IcaffeParties WHERE id = ?', [id]);
  if (!row) throw notFound();
  return directoryEntryOf(row);
}

function newPartyOf(entry, flag, name) {
  const address = entry.addresses[0] || {};
  return {
    partyType: PARTY_TYPE_BY_TYPE[entry.partyType],
    [flag]: true,
    code: entry.code,
    name,
    extendedName: entry.extra.extendedName || null,
    street: [address.address1, address.address2].filter(Boolean).join(', ') || null,
    city: address.city || entry.city || null,
    stateProvince: address.state || entry.state || null,
    zipPostcode: address.pinCode || entry.pinCode || null,
    countryCode: entry.countryCode || null,
    phoneNumber: address.phone || entry.phone || null,
    email: address.email1 || entry.email || null,
    taxId: entry.iec || null,
    panNumber: entry.pan || null,
    classType: entry.classType || null,
    iecNoReqd: !!entry.iec,
    rbiNumber: entry.extra.rbiNumber || null,
    mercManuf: entry.extra.mercManuf || null,
    remarks: `From iCAFFE ${entry.code}`,
  };
}

const branchRowOf = (partyId, entry, address, serialNo) => ({
  partyId,
  branchSrNo: String(serialNo),
  isDefault: serialNo === 1,
  branchName: address.branchName || 'DEFAULT',
  contactPerson: address.contactPerson || null,
  address1: address.address1 || '',
  address2: address.address2 || '',
  city: address.city || '',
  state: address.state || '',
  country: entry.countryCode || address.country || '',
  pinCode: address.pinCode || '',
  phone: address.phone || '',
  mobile: address.mobile || '',
  fax: address.fax || '',
  email1: address.email1 || '',
  email2: address.email2 || '',
  website: address.website || '',
  tanNo: address.tanNo || '',
  gstin: address.gstin || '',
  regNo: address.gstin || '',
  ctxState: address.gstStateCode || '',
});

const adCodeRowOf = (partyId, adCode) => ({
  partyId,
  adCode: adCode.adCode,
  bankName: adCode.bankName || '',
  serialNo: adCode.serialNo || '',
  forexCode: adCode.forexCode || '',
  bankAddress: adCode.bankAddress || '',
  branchAddress: adCode.branchAddress || '',
  loadingPort: adCode.port || '',
});

async function createPartyFromEntry(entry, flag, name, transaction) {
  const party = await Party.create(newPartyOf(entry, flag, name), { transaction });
  let serialNo = 0;
  for (const address of entry.addresses) {
    serialNo++;
    await PartyBranch.create(branchRowOf(party.id, entry, address, serialNo), { transaction });
  }
  for (const adCode of entry.adCodes) {
    if (!adCode.adCode) continue;
    await PartyADCode.create(adCodeRowOf(party.id, adCode), { transaction });
  }
  return party;
}

/** The party already linked to the entry, else one with the same code, else one with the same name. */
async function existingPartyFor(entry, name, transaction) {
  return (
    (entry.importedPartyId && (await Party.findByPk(entry.importedPartyId, { transaction }))) ||
    (await Party.findOne({ where: { code: entry.code }, transaction })) ||
    (await Party.findOne({ where: { name }, transaction }))
  );
}

function checkImportable(entry) {
  if (IMPORTABLE_TYPES.includes(entry.partyType)) return;
  const message =
    entry.partyType === 'IATA_AGENT'
      ? 'IATA agents are in the IATA Agent Master'
      : 'This type does not go into the Party master';
  throw new BadRequestError(message, { body: { error: message } });
}

async function rollbackQuietly(transaction) {
  try {
    await transaction.rollback();
  } catch {
    // already closed
  }
}

/**
 * POST /:id/import: copies the directory row into the Party master (with its addresses and AD codes), or links an
 * existing party of the same code / name and gives it the role.
 */
export async function importIntoPartyMaster(id) {
  const transaction = await sequelize.transaction();
  let result;
  try {
    const [row] = await sequelize.query('SELECT * FROM IcaffeParties WHERE id = ?', {
      replacements: [id],
      type: QueryTypes.SELECT,
      transaction,
    });
    if (!row) throw notFound();
    const entry = directoryEntryOf(row);
    checkImportable(entry);
    const flag = PARTY_FLAG_BY_TYPE[entry.partyType];
    const name = String(entry.name || '')
      .replace(/\s+/g, ' ')
      .trim();
    let party = await existingPartyFor(entry, name, transaction);
    let created = false;
    if (party) {
      if (!party[flag])
        await party.update(
          { [flag]: true, partyType: party.partyType === 'MULTI' ? 'MULTI' : party.partyType },
          { transaction },
        );
    } else {
      party = await createPartyFromEntry(entry, flag, name, transaction);
      created = true;
    }
    await sequelize.query('UPDATE IcaffeParties SET importedPartyId = ?, updatedAt = ? WHERE id = ?', {
      replacements: [party.id, new Date().toISOString(), entry.id],
      transaction,
    });
    await transaction.commit();
    result = { ok: true, created, partyId: party.id, name: party.name };
  } catch (error) {
    await rollbackQuietly(transaction);
    throw error;
  }
  clearPartyCache();
  return result;
}
