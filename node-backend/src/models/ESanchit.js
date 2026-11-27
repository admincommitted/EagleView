import { sequelize, DataTypes } from '../config/database.js';

const ESanchit = sequelize.define('ESanchit', {
  documentCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.STRING, allowNull: false },
  documentType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MANDATORY' },
  agency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'CUSTOMS' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

export default ESanchit;
