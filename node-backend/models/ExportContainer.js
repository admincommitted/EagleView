const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const ExportContainer = sequelize.define('ExportContainer', {
    exportJobId: { type: DataTypes.INTEGER, allowNull: false },
    containerNo: { type: DataTypes.STRING },
    size: { type: DataTypes.STRING },
    type: { type: DataTypes.STRING },
    sealNo: { type: DataTypes.STRING },
    additionalData: { type: DataTypes.TEXT, allowNull: true } // form fields without a column of their own (JSON), 28-Oct-2026
});
module.exports = ExportContainer;
