import { sequelize, DataTypes } from '../config/database.js';

const Airport = sequelize.define('Airport', {
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  countryCode: { type: DataTypes.STRING },
});

export default Airport;
