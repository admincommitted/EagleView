import { DataTypes, Op, Sequelize } from 'sequelize';
import { env } from './env.js';

const POOL = { max: 5, min: 0, acquire: 30000, idle: 10000 };

// WAL lets readers work while one writer writes; the rest trades a little safety on power loss for speed
const SQLITE_PRAGMAS = [
  'PRAGMA foreign_keys = ON;',
  'PRAGMA journal_mode = WAL;',
  'PRAGMA synchronous = NORMAL;',
  'PRAGMA cache_size = -64000;',
  'PRAGMA temp_store = MEMORY;',
  'PRAGMA mmap_size = 30000000000;',
];

const createMssqlConnection = ({ name, user, password, host, encrypt, instanceName }) =>
  new Sequelize(name, user, password, {
    host,
    dialect: 'mssql',
    logging: false,
    dialectOptions: { options: { encrypt, trustServerCertificate: true, instanceName } },
    pool: POOL,
  });

const createSqliteConnection = ({ storage }) =>
  new Sequelize({ dialect: 'sqlite', storage, logging: false, pool: POOL });

export const sequelize =
  env.database.dialect === 'mssql' ? createMssqlConnection(env.database) : createSqliteConnection(env.database);

const isSqlite = env.database.dialect === 'sqlite';

/** Runs the SQLite speed settings once the connection is open (nothing to do on MS SQL). */
export async function applyDatabaseSettings() {
  if (!isSqlite) return;
  for (const pragma of SQLITE_PRAGMAS) await sequelize.query(pragma);
  console.log('SQLite Optimized: WAL, Normal Sync, 64MB Cache, Memory Temp, MMAP active.');
}

export { DataTypes, Op };
