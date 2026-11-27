import { sequelize, DataTypes } from '../config/database.js';

const ExportContainer = sequelize.define('ExportContainer', {
  exportJobId: { type: DataTypes.INTEGER, allowNull: false },
  containerNo: { type: DataTypes.STRING },
  size: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING },
  sealNo: { type: DataTypes.STRING },
  additionalData: { type: DataTypes.TEXT, allowNull: true }, // form fields without a column of their own (JSON)
});

export default ExportContainer;
