const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const InventoryGroup = sequelize.define('InventoryGroup', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    parentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'InventoryGroups', key: 'id' } }
}, { timestamps: true });

module.exports = InventoryGroup;