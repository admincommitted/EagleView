import { sequelize, DataTypes } from '../config/database.js';

const TactRateSector = sequelize.define('TactRateSector', {
  originCode: { type: DataTypes.STRING(3), allowNull: false },
  destinationCode: { type: DataTypes.STRING(3), allowNull: false },
  carrierCode: { type: DataTypes.STRING(3), defaultValue: 'ALL' },
  currencyCode: { type: DataTypes.STRING(3), allowNull: false },
  effectiveFrom: { type: DataTypes.DATEONLY, allowNull: true },
  effectiveTo: { type: DataTypes.DATEONLY, allowNull: true },
});

export default TactRateSector;
