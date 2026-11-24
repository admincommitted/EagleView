const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config();

let sequelize;

if (process.env.DB_DIALECT === 'mssql') {
  sequelize = new Sequelize(
    process.env.DB_NAME, 
    process.env.DB_USER, 
    process.env.DB_PASSWORD, 
    {
      host: process.env.DB_HOST,
      dialect: 'mssql',
      logging: false,
      dialectOptions: {
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true', // true if Azure, false for local
          trustServerCertificate: true,
          instanceName: process.env.DB_INSTANCE_NAME || undefined // e.g. SQLEXPRESS
        }
      },
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
    }
  );
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  });

  const setupPragmas = async () => {
    try {
        await sequelize.query("PRAGMA foreign_keys = ON;");
        await sequelize.query("PRAGMA journal_mode = WAL;");
        await sequelize.query("PRAGMA synchronous = NORMAL;");
        await sequelize.query("PRAGMA cache_size = -64000;");
        await sequelize.query("PRAGMA temp_store = MEMORY;");
        await sequelize.query("PRAGMA mmap_size = 30000000000;");
        console.log("SQLite Optimized: WAL, Normal Sync, 64MB Cache, Memory Temp, MMAP active.");
    } catch (err) {}
  };
  setupPragmas();
}

module.exports = { sequelize, DataTypes };
