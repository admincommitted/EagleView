/**
 * Keeps form fields that have no column of their own.
 *
 * The Import / Export screens send many fields (autoField_*, CTX details, CHA details, scheme grids…)
 * that are not columns of the job / invoice / item tables, and Sequelize silently drops such keys.
 * packExtra() stores them as JSON in one TEXT column; unpackExtra() puts them back on read.
 * Real columns always win over the JSON.
 */

// saved in their own tables
const NESTED = new Set([
  'invoices',
  'Invoices',
  'items',
  'containers',
  'Containers',
  'docs',
  'dbkItems',
  'licenseItems',
  'createdAt',
  'updatedAt',
]);
const TEXT_TYPE_KEYS = ['STRING', 'TEXT', 'CHAR'];

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const typeKeyOf = (attribute) =>
  attribute.type && (attribute.type.key || (attribute.type.constructor && attribute.type.constructor.key));

// arrays / objects sent for a text column (e.g. ExportJob.PackingDetails) are stored as JSON, or the save fails
function columnValue(attribute, value) {
  const isObjectValue = value && typeof value === 'object' && !(value instanceof Date);
  return isObjectValue && TEXT_TYPE_KEYS.includes(typeKeyOf(attribute)) ? JSON.stringify(value) : value;
}

/** Returns a copy of obj where every non-column key is moved into obj[col] (JSON string). */
function packExtra(Model, obj, col, previous) {
  const attributes = Model.rawAttributes;
  const packed = {};
  const extra = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (key === col) continue;
    // a nested list goes to its own table; one that is also a text column of this table
    // (ExportJob.Containers - the SB Header container list) is stored as JSON by columnValue
    if (NESTED.has(key) && !attributes[key]) {
      packed[key] = value;
      continue;
    }
    if (attributes[key]) {
      packed[key] = columnValue(attributes[key], value);
      continue;
    }
    if (value === undefined || typeof value === 'function') continue;
    extra[key] = value;
  }
  const merged = { ...parseJsonObject(previous), ...parseJsonObject(obj && obj[col]), ...extra };
  for (const key of Object.keys(merged)) if (attributes[key]) delete merged[key]; // old JSON must never shadow a real column
  packed[col] = Object.keys(merged).length ? JSON.stringify(merged) : null;
  return packed;
}

/** Plain object with the JSON column merged back in (columns win) and the JSON column removed. */
function unpackExtra(row, col) {
  if (!row) return row;
  const data = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  const extended = parseJsonObject(data[col]);
  delete data[col];
  // a column wins, except when it is empty and the JSON still has the value (field moved to a column later)
  const merged = { ...extended };
  for (const [key, value] of Object.entries(data)) {
    if ((value !== null && value !== undefined) || !(key in extended)) merged[key] = value;
  }
  return merged;
}

export { packExtra, unpackExtra };
