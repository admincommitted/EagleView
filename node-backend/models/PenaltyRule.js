const { DataTypes } = require('sequelize');
const sequelize = require('../db').sequelize;

const PenaltyRule = sequelize.define('PenaltyRule', {
  tradeType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'IMPORT' },
  type: { type: DataTypes.STRING, allowNull: false },
  mode: { type: DataTypes.STRING, allowNull: false },
  basis: { type: DataTypes.STRING, allowNull: false },
  rateUom: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PER_SHIPMENT_PER_DAY' },
  freeDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  slab1Rate: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  slab2Rate: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  slab3Rate: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
});

module.exports = PenaltyRule;
