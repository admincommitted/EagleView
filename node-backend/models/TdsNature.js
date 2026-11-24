const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const TdsNature = sequelize.define('TdsNature', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    section: { type: DataTypes.STRING, allowNull: false },
    rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    rateWithoutPan: { type: DataTypes.DECIMAL(5, 2), defaultValue: 20.00 },
    exemptionLimit: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.00 }
}, { timestamps: true });

module.exports = TdsNature;