import { sequelize, DataTypes } from '../config/database.js';

const Uqc = sequelize.define('Uqc', {
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

export default Uqc;
