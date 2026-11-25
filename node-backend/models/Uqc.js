const { sequelize, DataTypes } = require("../db");

const Uqc = sequelize.define("Uqc", {
  uqcCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = Uqc;
