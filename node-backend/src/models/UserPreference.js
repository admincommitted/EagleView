import { sequelize, DataTypes } from '../config/database.js';

// Small per-user screen preferences kept in the database, e.g. favourite reports.
// One row per user + key; value is JSON text.

const UserPreference = sequelize.define(
  'UserPreference',
  {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    prefKey: { type: DataTypes.STRING(60), allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'UserPreferences',
    indexes: [{ unique: true, fields: ['userId', 'prefKey'] }],
  },
);

export default UserPreference;
