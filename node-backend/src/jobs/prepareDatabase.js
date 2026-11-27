import {
  ExportJob,
  FieldAgent,
  FieldAgentLocation,
  ImportJob,
  sequelize,
  WhatsappNotificationQueue,
} from '../models/index.js';
import { ready as settingsTablesReady } from '../utils/common/settingsStore.js';
import { migrateBeFields } from '../utils/db/beFieldsMigrate.js';
import { ensureJobIndexes, optimizeDb } from '../utils/db/dbIndexes.js';
import { ensureFieldColumns, registerDbColumns } from '../utils/db/dynamicColumns.js';
import { ensureColumns } from '../utils/db/ensureColumns.js';
import * as knownFormFieldColumns from '../utils/db/formFieldColumns.js';

// the Import / Export form models whose extra (screen-added) columns are loaded into the model at startup
const FORM_FIELD_MODELS = [
  'ImportJob',
  'ImportInvoice',
  'ImportItem',
  'ImportContainer',
  'ExportJob',
  'ExportInvoice',
  'ExportItem',
  'ExportContainer',
  'ExportDocument',
  'ExportDrawback',
  'ExportLicense',
];

// formFieldColumns is a { modelName: [field, ...] } map, exported per model or as one default object
const KNOWN_FORM_FIELD_COLUMNS = knownFormFieldColumns.default ?? { ...knownFormFieldColumns };

// tables synced once more after the column pass, each with its own warning label
const LATE_SYNC_TABLES = [
  [WhatsappNotificationQueue, 'WA Queue'],
  [ImportJob, 'ImportJob'],
  [ExportJob, 'ExportJob'],
  [FieldAgent, 'FieldAgent'],
  [FieldAgentLocation, 'FieldAgentLocation'],
];

// copies the old AppSetting values into the Settings tables once
async function prepareSettingsTables() {
  try {
    await settingsTablesReady();
    console.log('[Settings] tables ready');
  } catch (error) {
    console.warn('[Settings] migrate warning:', error.message);
  }
}

// add-only column sync (sync({ alter: true }) would rebuild SQLite tables on every start)
async function addMissingColumns() {
  for (const model of Object.values(sequelize.models)) {
    try {
      await ensureColumns(model);
    } catch (error) {
      console.warn('[DB] ensureColumns', model.name, error.message);
    }
  }
}

// create the known Import / Export form field columns, then load every extra column into its model
async function addFormFieldColumns() {
  try {
    for (const [modelName, fields] of Object.entries(KNOWN_FORM_FIELD_COLUMNS)) {
      const model = sequelize.models[modelName];
      if (model) await ensureFieldColumns(model, Object.fromEntries(fields.map((field) => [field, ''])));
    }
    for (const modelName of FORM_FIELD_MODELS) {
      const model = sequelize.models[modelName];
      if (model) await registerDbColumns(model);
    }
  } catch (error) {
    console.warn('[DB] form field columns:', error.message);
  }
}

// BE No / dates: extendedData JSON -> columns (idempotent)
async function moveBeFieldsToColumns() {
  try {
    await migrateBeFields();
  } catch (error) {
    console.warn('[DB] BE fields:', error.message);
  }
}

// job table indexes + SQLite statistics: idempotent, runs after the columns exist
async function prepareIndexes() {
  try {
    await ensureJobIndexes();
    await optimizeDb();
  } catch (error) {
    console.warn('[DB] indexes warning:', error.message);
  }
}

async function syncTableAndColumns(model, label) {
  try {
    await model.sync();
    await ensureColumns(model);
  } catch (error) {
    console.warn(`[${label}] Sync warning:`, error.message);
  }
}

/**
 * The database work after sequelize.sync(), in this order. The Settings tables and the late table syncs are not
 * awaited: the server starts listening while they finish.
 */
export async function prepareDatabase() {
  prepareSettingsTables();
  try {
    await addMissingColumns();
    await addFormFieldColumns();
  } catch (error) {
    console.warn('[DB] ensureColumns warning:', error.message);
  }
  await moveBeFieldsToColumns();
  await prepareIndexes();
  for (const [model, label] of LATE_SYNC_TABLES) syncTableAndColumns(model, label);
}
