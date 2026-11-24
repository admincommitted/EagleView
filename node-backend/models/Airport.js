const { sequelize, DataTypes } = require('../db');
const Airport = sequelize.define('Airport', {
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  countryCode: { type: DataTypes.STRING }
});
module.exports = Airport;
