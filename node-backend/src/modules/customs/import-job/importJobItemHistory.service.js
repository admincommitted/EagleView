import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';

const MIN_MODEL_LENGTH = 3;
const MIN_DESCRIPTION_LENGTH = 4;
const MIN_DESCRIPTION_HEAD_LENGTH = 6;
const MIN_HEADING_DIGITS = 4;
const MAX_HEADINGS_FOR_A_MODEL = 3;
const ROWS_PER_SEARCH = 400;
const MAX_OPTIONS = 5;
const NO_MODEL_RX = /^(NA|N\.A\.?|N\/A|NIL|NONE|NO MODEL|NOT APPLICABLE|-+|\.+)$/;
const ITEM_FIELDS = [
  'ritc',
  'hsCode',
  'cth',
  'ceth',
  'uqc',
  'unit',
  'bcdRate',
  'bcdNotificationNo',
  'bcdSrNo',
  'bcdFlag',
  'swsRate',
  'swsNotificationNo',
  'swsSrNo',
  'swsFlag',
  'healthCessRate',
  'healthCessNotificationNo',
  'healthCessSrNo',
  'brandName',
  'model',
  'endUse',
  'countryOfOrigin',
  'genericDesc',
  'manufacturer',
  'price',
  'unitPrice',
  'currency',
  'igstData',
  'desc',
  'productDescription',
];
// rates were not always kept: an older entry of the same heading fills these when the newest one is blank
const FILLED_FROM_OLDER = ['bcdRate', 'bcdNotificationNo', 'bcdSrNo', 'swsRate', 'ceth', 'cth', 'uqc'];

const searchText = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';
const headingDigits = (row) => String(row.ritc || row.hsCode || '').replace(/\D/g, '');

async function columnsOf(table) {
  const columns = await sequelize.query(`PRAGMA table_info(${table})`, { type: QueryTypes.SELECT });
  return new Set(columns.map((column) => column.name));
}

/** SQL for a field: the column (when not blank), else the value kept in extendedData. */
function fieldSql(alias, columns, name) {
  const fromJson = `CASE WHEN json_valid(${alias}.extendedData) THEN json_extract(${alias}.extendedData, '$.${name}') END`;
  return columns.has(name) ? `COALESCE(NULLIF(TRIM(${alias}.${name}), ''), ${fromJson})` : fromJson;
}

async function itemSearch(excludeJobId) {
  const itemColumns = await columnsOf('ImportItems');
  const jobColumns = await columnsOf('ImportJobs');
  const itemField = (name) => fieldSql('it', itemColumns, name);
  const jobField = (name) => fieldSql('j', jobColumns, name);
  const sql = {
    description: `UPPER(TRIM(COALESCE(${itemField('desc')}, ${itemField('productDescription')}, '')))`,
    model: `UPPER(TRIM(COALESCE(${itemField('model')}, '')))`,
    iec: `UPPER(TRIM(COALESCE(${jobField('iecCode')}, ${jobField('autoField_5')}, '')))`,
  };
  const selectSql =
    `SELECT it.id, j.id AS jobId, j.jobNo, ${jobField('jobDate')} AS jobDate, ${jobField('beNo')} AS jobBeNo,` +
    ` COALESCE(${jobField('nameOfImporter')}, ${jobField('autoField_4')}) AS importer,` +
    ` ${ITEM_FIELDS.map((name) => `${itemField(name)} AS ${name}`).join(', ')}` +
    ' FROM ImportItems it JOIN ImportInvoices inv ON inv.id = it.importInvoiceId JOIN ImportJobs j ON j.id = inv.importJobId';
  // excludeJobId is a parsed integer, safe to put in the SQL
  const run = (where, replacements) =>
    sequelize.query(
      `${selectSql} WHERE ${where}${excludeJobId ? ` AND j.id <> ${excludeJobId}` : ''} ORDER BY it.id DESC LIMIT ${ROWS_PER_SEARCH}`,
      { replacements, type: QueryTypes.SELECT },
    );
  return { sql, run };
}

const tagRows = (rows, scope, matchedBy) => rows.map((row) => ({ ...row, _scope: scope, _by: matchedBy }));

// a "model" that sits on many different headings is the model of the finished product the parts are for (every part
// of one phone carries the phone's model) - it does not identify the item, so such a match is not offered
const modelIdentifiesItem = (rows) =>
  new Set(rows.map(headingDigits).filter((digits) => digits.length >= MIN_HEADING_DIGITS)).size <=
  MAX_HEADINGS_FOR_A_MODEL;

// the text before the first bracket, often the part number: "starts the same"
function descriptionHeadLike(description) {
  const head = description ? description.split('(')[0].trim() : '';
  return head.length >= MIN_DESCRIPTION_HEAD_LENGTH && head.length < description.length
    ? `${head.replace(/[\\%_]/g, '\\$&')}%`
    : '';
}

/**
 * First this importer (IEC): the same description, a description that starts the same, the same model; then the same
 * description / model of other clients.
 */
async function findMatchingRows({ iec, model, description }, { sql, run }) {
  const headLike = descriptionHeadLike(description);
  let rows = [];
  if (iec) {
    if (description)
      rows = tagRows(
        await run(`${sql.iec} = ? AND ${sql.description} = ?`, [iec, description]),
        'importer',
        'description',
      );
    if (!rows.length && headLike) {
      rows = tagRows(
        await run(`${sql.iec} = ? AND ${sql.description} LIKE ? ESCAPE '\\'`, [iec, headLike]),
        'importer',
        'similar',
      );
    }
    if (!rows.length && model) {
      const modelRows = await run(`${sql.iec} = ? AND ${sql.model} = ?`, [iec, model]);
      if (modelIdentifiesItem(modelRows)) rows = tagRows(modelRows, 'importer', 'model');
    }
  }
  const otherClients = iec ? ` AND ${sql.iec} <> ?` : '';
  if (!rows.length && description) {
    rows = tagRows(
      await run(`${sql.description} = ?${otherClients}`, iec ? [description, iec] : [description]),
      'others',
      'description',
    );
  }
  if (!rows.length && model) {
    const modelRows = await run(`${sql.model} = ?${otherClients}`, iec ? [model, iec] : [model]);
    if (modelIdentifiesItem(modelRows)) rows = tagRows(modelRows, 'others', 'model');
  }
  return rows;
}

function parsedIgst(value) {
  let igst = value;
  if (typeof igst === 'string') {
    try {
      igst = JSON.parse(igst);
    } catch {
      igst = null;
    }
  }
  return igst && typeof igst === 'object' ? igst : null;
}

const igstFields = (igst, rate) => ({
  notnNo: igst.notnNo || '',
  srNo: igst.srNo || '',
  rate,
  flag: igst.flag || 'A',
  amount: '',
});

// the product's own particulars are offered only from this importer's earlier entry
const productParticulars = (row) =>
  row._scope === 'importer'
    ? {
        brandName: row.brandName || '',
        model: row.model || '',
        endUse: row.endUse || '',
        countryOfOrigin: row.countryOfOrigin || '',
        genericDesc: row.genericDesc || '',
        manufacturer: row.manufacturer || '',
      }
    : {};

// the newest row of a heading gives the values
function newHeadingGroup(row, heading, igst) {
  return {
    scope: row._scope,
    matchedBy: row._by,
    count: 0,
    jobs: new Set(),
    lastJobNo: row.jobNo,
    lastJobId: row.jobId,
    lastJobDate: row.jobDate,
    lastBeNo: row.jobBeNo,
    importer: row._scope === 'others' ? row.importer : undefined,
    description: row.desc || row.productDescription || '',
    fields: {
      ritc: heading,
      cth: row.cth || '',
      ceth: row.ceth || '',
      uqc: row.uqc || row.unit || '',
      bcdRate: row.bcdRate,
      bcdNotificationNo: row.bcdNotificationNo || '',
      bcdSrNo: row.bcdSrNo || '',
      bcdFlag: row.bcdFlag || '',
      swsRate: row.swsRate,
      swsNotificationNo: row.swsNotificationNo || '',
      swsSrNo: row.swsSrNo || '',
      swsFlag: row.swsFlag || '',
      healthCessRate: row.healthCessRate,
      healthCessNotificationNo: row.healthCessNotificationNo || '',
      healthCessSrNo: row.healthCessSrNo || '',
      igstData: igst ? igstFields(igst, igst.rate === undefined || igst.rate === null ? '' : String(igst.rate)) : null,
      ...productParticulars(row),
    },
    lastPrice: row.price || row.unitPrice || '',
    lastCurrency: row.currency || '',
  };
}

function fillFromOlderEntry(fields, row, igst) {
  for (const key of FILLED_FROM_OLDER) if (isBlank(fields[key]) && !isBlank(row[key])) fields[key] = row[key];
  if ((!fields.igstData || isBlank(fields.igstData.rate)) && igst && !isBlank(igst.rate))
    fields.igstData = igstFields(igst, String(igst.rate));
}

// one line per heading (RITC) used, newest first, with how often and when
function groupByHeading(rows) {
  const groups = new Map();
  for (const row of rows) {
    const heading = headingDigits(row);
    if (heading.length < MIN_HEADING_DIGITS) continue;
    const igst = parsedIgst(row.igstData);
    let group = groups.get(heading);
    if (!group) {
      group = newHeadingGroup(row, heading, igst);
      groups.set(heading, group);
    } else {
      fillFromOlderEntry(group.fields, row, igst);
    }
    group.count++;
    group.jobs.add(row.jobId);
  }
  return [...groups.values()].slice(0, MAX_OPTIONS).map((group) => ({ ...group, jobs: group.jobs.size }));
}

/**
 * "What did we use last time" for an item being entered: the classification (RITC + CTH + BCD + IGST) of the same
 * product in the saved import items. Read only.
 */
export async function importItemHistory(query) {
  const iec = searchText(query.iec);
  let model = searchText(query.model);
  const fullDescription = searchText(query.desc);
  const excludeJobId = parseInt(query.excludeJobId, 10) || 0;
  if (model.length < MIN_MODEL_LENGTH || NO_MODEL_RX.test(model)) model = '';
  const description = fullDescription.length >= MIN_DESCRIPTION_LENGTH ? fullDescription : '';
  if (!model && !description) return { success: true, options: [] };
  const search = await itemSearch(excludeJobId);
  const rows = await findMatchingRows({ iec, model, description }, search);
  return { success: true, options: groupByHeading(rows) };
}
