import { sequelize, DataTypes } from '../config/database.js';

const TactCountryRule = sequelize.define('TactCountryRule', {
  countryCode: { type: DataTypes.STRING(2), allowNull: false },
  ruleType: { type: DataTypes.STRING(50), allowNull: false }, // IMPORT, EXPORT, TRANSIT
  category: { type: DataTypes.STRING(50), allowNull: false }, // DOCS, EMBARGO, OCI
  description: { type: DataTypes.TEXT, allowNull: false },
  isBlocking: { type: DataTypes.BOOLEAN, defaultValue: false },
  effectiveFrom: { type: DataTypes.DATEONLY, allowNull: true },
  effectiveTo: { type: DataTypes.DATEONLY, allowNull: true },
});

export default TactCountryRule;
