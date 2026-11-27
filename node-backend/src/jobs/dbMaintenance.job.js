import { checkpointDb, optimizeDb } from '../utils/db/dbIndexes.js';

const DB_MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function runDbMaintenance() {
  await checkpointDb();
  await optimizeDb();
}

/** Folds the SQLite WAL file back into database.sqlite and refreshes its query statistics, every 6 hours. */
export function startDbMaintenanceJob() {
  setInterval(runDbMaintenance, DB_MAINTENANCE_INTERVAL_MS).unref();
}
