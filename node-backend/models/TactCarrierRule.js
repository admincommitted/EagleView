const { sequelize, DataTypes } = require('../db');
const TactCarrierRule = sequelize.define('TactCarrierRule', {
  carrierCode: { type: DataTypes.STRING(3), allowNull: false },
  shcCode: { type: DataTypes.STRING(10), allowNull: true },
  ruleCategory: { type: DataTypes.STRING(50), allowNull: false }, // RESTRICTION, ROUTING
  description: { type: DataTypes.TEXT, allowNull: false },
  isBlocking: { type: DataTypes.BOOLEAN, defaultValue: true },
});
module.exports = TactCarrierRule;