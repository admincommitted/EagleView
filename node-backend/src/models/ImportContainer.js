import { sequelize, DataTypes } from '../config/database.js';

const ImportContainer = sequelize.define('ImportContainer', {
  importJobId: { type: DataTypes.INTEGER, allowNull: false },
  containerNo: { type: DataTypes.STRING },
  size: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING },
  sealNo: { type: DataTypes.STRING },
  extendedData: { type: DataTypes.TEXT, allowNull: true }, // form fields without a column of their own (JSON)
});

export default ImportContainer;
