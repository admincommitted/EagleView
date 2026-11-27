import { sequelize, DataTypes } from '../config/database.js';

const DutyNotifDetail = sequelize.define('DutyNotifDetail', {
  serialNo: { type: DataTypes.STRING, allowNull: false },
  tariffHead: { type: DataTypes.STRING, allowNull: true },
  specificSeries: { type: DataTypes.STRING, allowNull: true },
  effectiveDate: { type: DataTypes.DATEONLY, allowNull: true },
  dutyRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  itemDescription: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  conditionNo: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
});

export default DutyNotifDetail;
