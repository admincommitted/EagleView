const { sequelize, DataTypes } = require('../db');

const ItemTemplate = sequelize.define('ItemTemplate', {
    templateName: { type: DataTypes.STRING, allowNull: false },
    jobType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'BE' },
    jsonPayload: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.STRING, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true } // 22-Nov-2026: switch off instead of delete (column added at start by ensureColumns)
});

module.exports = ItemTemplate;
