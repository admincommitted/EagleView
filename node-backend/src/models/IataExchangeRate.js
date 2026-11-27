import { sequelize, DataTypes } from '../config/database.js';

const IataExchangeRate = sequelize.define('IataExchangeRate', {
  billingMonth: { type: DataTypes.STRING(10), allowNull: false }, // YYYY-MM
  currencyCode: { type: DataTypes.STRING(3), allowNull: false },
  iataRoe: { type: DataTypes.FLOAT, allowNull: false },
  sdrValue: { type: DataTypes.FLOAT, allowNull: true },
});

export default IataExchangeRate;
