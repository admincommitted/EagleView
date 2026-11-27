import { sequelize, DataTypes } from '../config/database.js';

// the notification no. is unique per type - IGST 001/2017 and ADD 001/2017 are different notifications.
// (The table itself is built by load_icaffe_masters2.js; sync() does not change an existing table.)
const DutyNotifHeader = sequelize.define(
  'DutyNotifHeader',
  {
    notifNo: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    effectiveDate: { type: DataTypes.DATEONLY, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    indexes: [{ unique: true, fields: ['notifNo', 'type'], name: 'duty_notif_headers_notif_no_type' }],
  },
);

export default DutyNotifHeader;
