const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const CostCentre = sequelize.define('CostCentre', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    categoryId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'CostCategories', key: 'id' } },
    parentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'CostCentres', key: 'id' } }
}, { timestamps: true });

module.exports = CostCentre;