const { sequelize, DataTypes } = require('../db');
const Charge = sequelize.define('Charge', {
  chargeType: { type: DataTypes.STRING, allowNull: false },
  awbChargeName: { type: DataTypes.STRING, allowNull: false, unique: true },
  awbChargeCode: { type: DataTypes.STRING, allowNull: true },
  // 28-Oct-2026: fields of the AWB Charges Master screen (before it saved nothing); added by ensureColumns
  chargeName: { type: DataTypes.STRING, allowNull: true },      // name used in billing (AWB name is awbChargeName)
  entitlement: { type: DataTypes.STRING, allowNull: true },     // DUE_AGENT / DUE_CARRIER
  sacCode: { type: DataTypes.STRING, allowNull: true },         // GST SAC (6 digits, e.g. 996531)
  gstRate: { type: DataTypes.DECIMAL(5, 2), allowNull: true },  // %
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});
module.exports = Charge;