import { sequelize, DataTypes } from '../config/database.js';

const ExportDrawback = sequelize.define('ExportDrawback', {
  exportJobId: { type: DataTypes.INTEGER, allowNull: false },
  srNo: { type: DataTypes.INTEGER },
  invNo: { type: DataTypes.INTEGER },
  itemNo: { type: DataTypes.INTEGER },
  dbkNo: { type: DataTypes.STRING },
  dbkQty: { type: DataTypes.STRING },
  accUnit: { type: DataTypes.STRING },
  dbkRtAdv: { type: DataTypes.STRING },
  dbkRtSpe: { type: DataTypes.STRING },
  dbkVal: { type: DataTypes.STRING },
});

export default ExportDrawback;
