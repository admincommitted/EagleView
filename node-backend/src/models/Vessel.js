import { sequelize, DataTypes } from '../config/database.js';

const Vessel = sequelize.define('Vessel', {
  vesselName: { type: DataTypes.STRING, allowNull: false },
  imoNumber: { type: DataTypes.STRING, allowNull: false },
  callSign: { type: DataTypes.STRING, allowNull: true },
  carrierAgent: { type: DataTypes.STRING, allowNull: true },
  // the logo picked on the Vessel screen (added by ensureColumns)
  customLogo: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true }, // switch off instead of delete (column added at start by ensureColumns)
});

export default Vessel;
