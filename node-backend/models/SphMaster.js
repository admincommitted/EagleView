const { sequelize, DataTypes } = require('../db');

const SphMaster = sequelize.define('SphMaster', {
    code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    description: { type: DataTypes.STRING(500), allowNull: false },
    category: { type: DataTypes.STRING(100), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'SphMasters' });

module.exports = SphMaster;
