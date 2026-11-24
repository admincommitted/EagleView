const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Currency = sequelize.define('Currency', {
    currencyCode: { type: DataTypes.STRING, allowNull: false, unique: true },
    currencyName: { type: DataTypes.STRING, allowNull: false },
    importRate: { type: DataTypes.REAL, defaultValue: 1.0 },
    exportRate: { type: DataTypes.REAL, defaultValue: 1.0 },
    standard: { type: DataTypes.BOOLEAN, defaultValue: false },
    effectiveDate: { type: DataTypes.DATE, allowNull: true },
    notificationNo: { type: DataTypes.STRING, allowNull: true },
    customLogo: { type: DataTypes.TEXT, allowNull: true }
}, { timestamps: true });

module.exports = Currency;