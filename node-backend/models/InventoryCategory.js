const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const InventoryCategory = sequelize.define('InventoryCategory', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    parentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'InventoryCategories', key: 'id' } }
}, { timestamps: true });

module.exports = InventoryCategory;