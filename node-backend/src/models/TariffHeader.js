import { sequelize, DataTypes } from '../config/database.js';

const TariffHeader = sequelize.define('TariffHeader', {
  hsnCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  dutyType: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
  isGstApplicable: { type: DataTypes.BOOLEAN, defaultValue: true },
  uqc: { type: DataTypes.STRING, allowNull: true, defaultValue: 'KGS' },
});

export default TariffHeader;
