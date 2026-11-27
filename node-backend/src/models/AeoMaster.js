import { sequelize, DataTypes } from '../config/database.js';

const AeoMaster = sequelize.define('AeoMaster', {
  aeoCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  aeoRole: { type: DataTypes.STRING, allowNull: false },
  countryCode: { type: DataTypes.STRING, allowNull: false },
  countryName: { type: DataTypes.STRING, allowNull: false },
});

export default AeoMaster;
