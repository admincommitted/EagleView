const { sequelize, DataTypes } = require('../db');

const FinancialYear = sequelize.define('FinancialYear', {
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  yearType: { type: DataTypes.STRING, defaultValue: 'FINANCIAL' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  isClosed: { type: DataTypes.BOOLEAN, defaultValue: false },
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
});

module.exports = FinancialYear;
