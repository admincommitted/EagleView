const { sequelize, DataTypes } = require('../db');

const IataAgent = sequelize.define('IataAgent', {
  name: DataTypes.STRING,
  iataCode: DataTypes.STRING,
  tdsRate: DataTypes.STRING,
  tdsRemarks: DataTypes.STRING,
  panNumber: DataTypes.STRING,
  isDefault: DataTypes.BOOLEAN,
  commission: DataTypes.STRING,
  commissionType: { type: DataTypes.STRING, defaultValue: 'PERCENT' },
  // JSON array for branches/addresses
  branches: DataTypes.TEXT,
  isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true } // 22-Nov-2026: switch off instead of delete (column added at start by ensureColumns)
});

module.exports = IataAgent;
