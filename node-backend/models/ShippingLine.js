// 04-Nov-2026: shipping line codes (SPL/xxx) - table created by load_remaining_masters.js
const { sequelize, DataTypes } = require('../db');
const ShippingLine = sequelize.define('ShippingLine', {
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});
module.exports = ShippingLine;
