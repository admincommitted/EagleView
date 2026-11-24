const { sequelize, DataTypes } = require('../db');
const Tariff = sequelize.define('Tariff', {
  hsCode: DataTypes.STRING,
  description: DataTypes.STRING
});
module.exports = Tariff;
