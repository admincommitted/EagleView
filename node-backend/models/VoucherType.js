const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const VoucherType = sequelize.define('VoucherType', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    baseType: { type: DataTypes.STRING, allowNull: false },
    numberingMethod: { type: DataTypes.ENUM('Automatic', 'Manual', 'None'), defaultValue: 'Automatic' },
    prefix: { type: DataTypes.STRING, allowNull: true },
    suffix: { type: DataTypes.STRING, allowNull: true },
    startingNumber: { type: DataTypes.INTEGER, defaultValue: 1 },
    isBuiltIn: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { timestamps: true });

module.exports = VoucherType;