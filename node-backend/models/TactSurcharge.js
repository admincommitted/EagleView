const { sequelize, DataTypes } = require('../db');
const TactSurcharge = sequelize.define('TactSurcharge', {
  chargeCode: { type: DataTypes.STRING(2), allowNull: false }, // MY, SC
  carrierCode: { type: DataTypes.STRING(3), defaultValue: 'ALL' },
  originZone: { type: DataTypes.STRING(50), allowNull: true },
  destZone: { type: DataTypes.STRING(50), allowNull: true },
  chargeBasis: { type: DataTypes.STRING(50), allowNull: false }, // PER_KG, FLAT
  amount: { type: DataTypes.FLOAT, allowNull: false },
  minimumAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
});
module.exports = TactSurcharge;