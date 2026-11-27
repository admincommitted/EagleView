import { sequelize, DataTypes } from '../config/database.js';

const Bond = sequelize.define('Bond', {
  bondCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

export default Bond;
