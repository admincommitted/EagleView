const { sequelize, DataTypes } = require('../db');

const FinancialPeriod = sequelize.define('FinancialPeriod', {
  financialYearId: { type: DataTypes.INTEGER, allowNull: false },
  periodName: { type: DataTypes.STRING, allowNull: false }, // e.g. "April-2026"
  periodNo: { type: DataTypes.INTEGER, allowNull: false }, // e.g. 1 to 12
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  isClosed: { type: DataTypes.BOOLEAN, defaultValue: false }, // To lock the month for accounting
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  indexes: [
    {
      unique: true,
      fields: ['financialYearId', 'periodNo']
    }
  ]
});

module.exports = FinancialPeriod;
