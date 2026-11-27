import { sequelize, DataTypes } from '../config/database.js';

const License = sequelize.define('License', {
  licenseNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  partyId: { type: DataTypes.INTEGER, allowNull: true },
  partyName: { type: DataTypes.STRING, allowNull: false },
  licenseType: { type: DataTypes.STRING, allowNull: false },
  validUpTo: { type: DataTypes.DATEONLY, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

export default License;
