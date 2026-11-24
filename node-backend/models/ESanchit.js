const { sequelize, DataTypes } = require('../db');

const ESanchit = sequelize.define('ESanchit', {
    documentCode: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.STRING, allowNull: false },
    documentType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MANDATORY' },
    agency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'CUSTOMS' },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

module.exports = ESanchit;
