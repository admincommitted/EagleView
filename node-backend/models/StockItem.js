const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const StockItem = sequelize.define('StockItem', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    groupId: { type: DataTypes.INTEGER, allowNull: true },
    categoryId: { type: DataTypes.INTEGER, allowNull: true },
    uomId: { type: DataTypes.INTEGER, allowNull: false },
    openingQty: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    openingRate: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    openingValue: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 }
}, { timestamps: true });

module.exports = StockItem;