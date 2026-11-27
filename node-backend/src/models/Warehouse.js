import { sequelize, DataTypes } from '../config/database.js';

const Warehouse = sequelize.define('Warehouse', {
  warehouseCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  warehouseName: { type: DataTypes.STRING, allowNull: false },
  linkedPortCode: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: true },
  capacity: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  state: { type: DataTypes.STRING, allowNull: true },
  country: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  contactPerson: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true }, // switch off instead of delete (column added at start by ensureColumns)
});

export default Warehouse;
