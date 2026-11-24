const { sequelize, DataTypes } = require('../db');
const TactProportionalRate = sequelize.define('TactProportionalRate', {
  gatewayAirport: { type: DataTypes.STRING(3), allowNull: false },
  localAirport: { type: DataTypes.STRING(3), allowNull: false },
  addonAmount: { type: DataTypes.FLOAT, allowNull: false },
  currencyCode: { type: DataTypes.STRING(3), allowNull: false },
});
module.exports = TactProportionalRate;