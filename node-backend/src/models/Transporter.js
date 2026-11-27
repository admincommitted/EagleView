import { sequelize, DataTypes } from '../config/database.js';

const Transporter = sequelize.define('Transporter', {
  transporterName: { type: DataTypes.STRING, allowNull: false },
  gstin: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [15, 15] },
  },
  vehicleType: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true }, // switch off instead of delete (column added at start by ensureColumns)
});

export default Transporter;
