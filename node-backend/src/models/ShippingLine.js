import { sequelize, DataTypes } from '../config/database.js';

// shipping line codes (SPL/xxx) - table created by load_remaining_masters.js
const ShippingLine = sequelize.define('ShippingLine', {
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

export default ShippingLine;
