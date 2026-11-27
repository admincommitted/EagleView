/**
 * Every field the Import / Export screens send gets a real database column.
 *
 * - ensureFieldColumns(Model, rows): before a save, adds a TEXT column for each field name in rows
 *   that the table does not have yet, then registers it on the model so Sequelize saves it.
 * - registerDbColumns(Model): at startup, registers columns that exist in the table but not in the
 *   model file (added earlier by ensureFieldColumns), so they are read and written again.
 * Lists/objects are stored as JSON text and read back as lists/objects.
 * Field names that cannot be column names stay in the extendedData / additionalData JSON column.
 */
import { DataTypes } from '../../config/database.js';

const VALID_COLUMN_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const NEVER_A_COLUMN = new Set([
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
  'extendedData',
  'additionalData',
]);

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// true for the shapes this file itself stores: a plain object, or a list that is empty or holds only plain objects
function isStoredObject(value) {
  if (Array.isArray(value)) return value.every(isPlainObject);
  return isPlainObject(value);
}

function jsonAttribute(name) {
  return {
    type: DataTypes.TEXT,
    allowNull: true,
    _dynamic: true,
    get() {
      const value = this.getDataValue(name);
      // The setter only ever writes an object or a list of objects (popup data and grid rows), never a list of plain
      // numbers or words. So only those shapes are read back as data: text an operator typed, such as "[1,10]", stays
      // text. "[]" and "{}" are read as the empty list / object, because the screens really do store empty grids.
      if (typeof value === 'string' && /^\s*[[{]/.test(value)) {
        try {
          const parsed = JSON.parse(value);
          if (isStoredObject(parsed)) return parsed;
        } catch {
          /* plain text */
        }
      }
      return value;
    },
    set(value) {
      const isObjectValue = value && typeof value === 'object' && !(value instanceof Date);
      this.setDataValue(name, isObjectValue ? JSON.stringify(value) : value === undefined ? null : value);
    },
  };
}

function registerAttributes(Model, names) {
  let changed = false;
  const known = new Set(Object.keys(Model.rawAttributes).map((key) => key.toLowerCase()));
  for (const name of names) {
    if (known.has(name.toLowerCase())) continue;
    Model.rawAttributes[name] = jsonAttribute(name);
    known.add(name.toLowerCase());
    changed = true;
  }
  if (changed) Model.refreshAttributes();
  return changed;
}

async function describeTable(Model) {
  try {
    return await Model.sequelize.getQueryInterface().describeTable(Model.getTableName());
  } catch {
    return null;
  }
}

async function registerDbColumns(Model) {
  const columns = await describeTable(Model);
  if (!columns) return [];
  const extra = Object.keys(columns).filter(
    (column) =>
      !Model.rawAttributes[column] &&
      !Object.values(Model.rawAttributes).some((attribute) => attribute.field === column),
  );
  registerAttributes(Model, extra);
  return extra;
}

function wantedFieldNames(rows) {
  const wanted = new Set();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined || typeof value === 'function') continue;
      if (NEVER_A_COLUMN.has(key) || !VALID_COLUMN_NAME.test(key)) continue;
      wanted.add(key);
    }
  }
  return wanted;
}

// rows: one object or an array of objects (e.g. all invoices of a job)
async function ensureFieldColumns(Model, rows) {
  const objectRows = (Array.isArray(rows) ? rows : [rows]).filter((row) => row && typeof row === 'object');
  const wanted = wantedFieldNames(objectRows);
  const known = new Set(Object.keys(Model.rawAttributes).map((key) => key.toLowerCase()));
  const missing = [...wanted].filter((key) => !known.has(key.toLowerCase()));
  if (!missing.length) return [];
  const columns = (await describeTable(Model)) || {};
  const inDatabase = new Set(Object.keys(columns).map((key) => key.toLowerCase()));
  const queryInterface = Model.sequelize.getQueryInterface();
  const added = [];
  for (const key of missing) {
    if (inDatabase.has(key.toLowerCase())) continue;
    try {
      await queryInterface.addColumn(Model.getTableName(), key, { type: DataTypes.TEXT, allowNull: true });
      added.push(key);
      inDatabase.add(key.toLowerCase());
    } catch (error) {
      console.warn(`[DB] could not add column ${key}: ${error.message}`);
    }
  }
  registerAttributes(
    Model,
    missing.filter((key) => inDatabase.has(key.toLowerCase())),
  );
  if (added.length) console.log(`[DB] ${Model.name}: new column(s) for form fields: ${added.join(', ')}`);
  return added;
}

export { ensureFieldColumns, registerDbColumns };
