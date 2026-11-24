const { sequelize, DataTypes } = require('../db');
const IataDgrMaster = sequelize.define('IataDgrMaster', {
  unNumber: { type: DataTypes.STRING(10), allowNull: false },
  properShippingName: { type: DataTypes.TEXT, allowNull: false },
  classDivision: { type: DataTypes.STRING(10), allowNull: false },
  packingGroup: { type: DataTypes.STRING(10), allowNull: true },
  caoOnly: { type: DataTypes.STRING(50), defaultValue: 'No' }, // Yes/No or PI limits
});
module.exports = IataDgrMaster;