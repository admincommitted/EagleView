import { sequelize, DataTypes } from '../config/database.js';

const IataShcConflict = sequelize.define('IataShcConflict', {
  shcCode1: { type: DataTypes.STRING(3), allowNull: false },
  shcCode2: { type: DataTypes.STRING(3), allowNull: false },
  conflictReason: { type: DataTypes.TEXT, allowNull: true },
  isProhibited: { type: DataTypes.BOOLEAN, defaultValue: true },
});

export default IataShcConflict;
