import { sequelize, DataTypes } from '../config/database.js';

const Tariff = sequelize.define('Tariff', {
  hsCode: DataTypes.STRING,
  description: DataTypes.STRING,
});

export default Tariff;
