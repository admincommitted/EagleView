// Small per-user screen preferences kept in the database (28-Oct-2026), e.g. favourite reports.
// One row per user + key; value is JSON text.
const { sequelize, DataTypes } = require('../db');

const UserPreference = sequelize.define('UserPreference', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    prefKey: { type: DataTypes.STRING(60), allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: true },
}, {
    tableName: 'UserPreferences',
    indexes: [{ unique: true, fields: ['userId', 'prefKey'] }],
});

module.exports = UserPreference;
