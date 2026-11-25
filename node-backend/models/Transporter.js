const { sequelize, DataTypes } = require("../db");

const Transporter = sequelize.define("Transporter", {
  transporterName: { type: DataTypes.STRING, allowNull: false },
  gstin: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [15, 15] },
  },
  vehicleType: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true }, // 22-Nov-2026: switch off instead of delete (column added at start by ensureColumns)
});

module.exports = Transporter;
