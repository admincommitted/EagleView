const { DataTypes } = require("sequelize");
const { sequelize } = require("../db");

const UnitOfMeasure = sequelize.define(
  "UnitOfMeasure",
  {
    symbol: { type: DataTypes.STRING, allowNull: false, unique: true },
    formalName: { type: DataTypes.STRING, allowNull: false },
    type: {
      type: DataTypes.ENUM("Simple", "Compound"),
      defaultValue: "Simple",
    },
  },
  { timestamps: true },
);

module.exports = UnitOfMeasure;
