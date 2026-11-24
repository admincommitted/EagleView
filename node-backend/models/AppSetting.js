const { sequelize, DataTypes } = require('../db');
const AppSetting = sequelize.define('AppSetting', {
  key:   { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.TEXT,   allowNull: true },
  label: { type: DataTypes.STRING, allowNull: true },
  group: { type: DataTypes.STRING, allowNull: true, defaultValue: 'general' },
});
module.exports = AppSetting;
