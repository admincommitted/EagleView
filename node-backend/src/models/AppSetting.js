import { sequelize, DataTypes } from '../config/database.js';

const AppSetting = sequelize.define('AppSetting', {
  key: { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.TEXT, allowNull: true },
  label: { type: DataTypes.STRING, allowNull: true },
  group: { type: DataTypes.STRING, allowNull: true, defaultValue: 'general' },
});

export default AppSetting;
