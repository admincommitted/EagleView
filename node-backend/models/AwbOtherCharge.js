const { sequelize, DataTypes } = require('../db');

const AwbOtherCharge = sequelize.define('AwbOtherCharge', {
  awbId:       { type: DataTypes.INTEGER, allowNull: false },
  awbType:     { type: DataTypes.STRING,  allowNull: false, defaultValue: 'MAWB' },
  chargeCode:  { type: DataTypes.STRING,  allowNull: true },
  description: { type: DataTypes.STRING,  allowNull: true }, // Human-readable charge description (fallback for Reason in XML)
  entitlement: { type: DataTypes.STRING,  allowNull: true }, // 'agent' or 'carrier'
  ppcc:        { type: DataTypes.STRING,  allowNull: true }, // 'PP' or 'CC'
  amount:      { type: DataTypes.STRING,  allowNull: true },
  rate:        { type: DataTypes.STRING,  allowNull: true }
});

module.exports = AwbOtherCharge;

