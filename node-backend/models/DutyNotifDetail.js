const { sequelize, DataTypes } = require('../db');
const DutyNotifHeader = require('./DutyNotifHeader');

const DutyNotifDetail = sequelize.define('DutyNotifDetail', {
    serialNo: { type: DataTypes.STRING, allowNull: false },
    tariffHead: { type: DataTypes.STRING, allowNull: true },
    specificSeries: { type: DataTypes.STRING, allowNull: true },
    effectiveDate: { type: DataTypes.DATEONLY, allowNull: true },
    dutyRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    itemDescription: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
    conditionNo: { type: DataTypes.STRING, allowNull: true, defaultValue: '' }
});

DutyNotifHeader.hasMany(DutyNotifDetail, { as: 'details', foreignKey: 'headerId', onDelete: 'CASCADE' });
DutyNotifDetail.belongsTo(DutyNotifHeader, { foreignKey: 'headerId' });

module.exports = DutyNotifDetail;
