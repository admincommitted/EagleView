const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Godown = sequelize.define('Godown', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    parentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Godowns', key: 'id' } },
    address: { type: DataTypes.TEXT, allowNull: true }
}, { timestamps: true });

module.exports = Godown;