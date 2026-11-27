import { sequelize, DataTypes } from '../config/database.js';

const ChaMaster = sequelize.define('ChaMaster', {
  chaCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  chaLicense: { type: DataTypes.STRING },
  chaName: { type: DataTypes.STRING, allowNull: false },
  chaAddress: { type: DataTypes.STRING },
  chaCity: { type: DataTypes.STRING },
  chaPin: { type: DataTypes.STRING },
  chaGstin: { type: DataTypes.STRING },
  chaPhone: { type: DataTypes.STRING },
  chaEmail: { type: DataTypes.STRING },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
});

export default ChaMaster;
