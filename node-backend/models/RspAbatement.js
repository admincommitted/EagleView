const { sequelize, DataTypes } = require('../db');

const RspAbatement = sequelize.define('RspAbatement', {
    cethCode: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.STRING, allowNull: false },
    notificationNo: { type: DataTypes.STRING, allowNull: true },
    serialNo: { type: DataTypes.STRING, allowNull: true },
    abatementRate: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    effectiveDate: { type: DataTypes.DATEONLY, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

module.exports = RspAbatement;
