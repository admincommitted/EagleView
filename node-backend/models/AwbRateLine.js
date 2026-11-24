const { sequelize, DataTypes } = require('../db');

const AwbRateLine = sequelize.define('AwbRateLine', {
  awbId: { type: DataTypes.INTEGER, allowNull: false },
  awbType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MAWB' },
  pieces: DataTypes.STRING,
  grossWeight: DataTypes.STRING,
  rateClass: DataTypes.STRING,
  commodityItemNo: DataTypes.STRING,
  chargeableWeight: DataTypes.STRING,
  rateCharge: DataTypes.STRING,
  total: DataTypes.STRING,
  natureOfGoods: DataTypes.TEXT,
  slac: DataTypes.STRING,
  rcp: DataTypes.STRING,
  rateClassPercentage: DataTypes.STRING,
  length: DataTypes.STRING,
  width: DataTypes.STRING,
  height: DataTypes.STRING,
  cmIn: DataTypes.STRING,
  noOfUnits: DataTypes.STRING,
  volume: DataTypes.STRING,
  mc: DataTypes.STRING,
  uldType: DataTypes.STRING,
  uldSerial: DataTypes.STRING,
  uldOwner: DataTypes.STRING,
  uldRateClass: DataTypes.STRING,
  harmonisedCode: DataTypes.STRING,
  // 29-Oct-2026: volumetric weight (kg) kept apart from volume (CBM); chargeable-weight unit; all dimension lines of the rate line (JSON)
  volumetricWeight: DataTypes.STRING,
  cwUnit: DataTypes.STRING,
  dimensions: DataTypes.TEXT,
  gwUnit: { type: DataTypes.STRING, allowNull: true, defaultValue: 'K' },
  isRounded: { type: DataTypes.BOOLEAN, defaultValue: false },
  rateAsAgreed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

module.exports = AwbRateLine;
