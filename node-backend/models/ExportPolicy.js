const { sequelize, DataTypes } = require('../db');
const ExportPolicy = sequelize.define('ExportPolicy', {
    tariffItem: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    exportDuty: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
    dgftPolicy: { type: DataTypes.STRING, allowNull: true, defaultValue: 'FREE' }
    , uqc: { type: DataTypes.STRING, allowNull: true }
    , isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});
module.exports = ExportPolicy;
