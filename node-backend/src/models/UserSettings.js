import { sequelize, DataTypes } from '../config/database.js';

const UserSettings = sequelize.define('UserSettings', {
  theme: { type: DataTypes.STRING, defaultValue: 'light' },
  notificationsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  language: { type: DataTypes.STRING, defaultValue: 'en' },
  timezone: { type: DataTypes.STRING, defaultValue: 'UTC' },
  primaryColor: { type: DataTypes.STRING, defaultValue: 'blue' },
  appBackground: { type: DataTypes.STRING, defaultValue: 'sky' },
});

export default UserSettings;
