const { sequelize, DataTypes } = require('../db');

// 04-Nov-2026: the notification no. is unique per type - IGST 001/2017 and ADD 001/2017 are different notifications.
// (The table itself was rebuilt by load_icaffe_masters2.js; sync() does not change an existing table.)
const DutyNotifHeader = sequelize.define('DutyNotifHeader', {
    notifNo: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    effectiveDate: { type: DataTypes.DATEONLY, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
    indexes: [{ unique: true, fields: ['notifNo', 'type'], name: 'duty_notif_headers_notif_no_type' }]
});

module.exports = DutyNotifHeader;
