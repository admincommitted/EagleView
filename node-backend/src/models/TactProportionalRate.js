import { sequelize, DataTypes } from '../config/database.js';

const TactProportionalRate = sequelize.define('TactProportionalRate', {
  gatewayAirport: { type: DataTypes.STRING(3), allowNull: false },
  localAirport: { type: DataTypes.STRING(3), allowNull: false },
  addonAmount: { type: DataTypes.FLOAT, allowNull: false },
  currencyCode: { type: DataTypes.STRING(3), allowNull: false },
});

export default TactProportionalRate;
