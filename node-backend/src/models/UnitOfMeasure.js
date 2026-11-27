import { sequelize, DataTypes } from '../config/database.js';

const UnitOfMeasure = sequelize.define(
  'UnitOfMeasure',
  {
    symbol: { type: DataTypes.STRING, allowNull: false, unique: true },
    formalName: { type: DataTypes.STRING, allowNull: false },
    type: {
      type: DataTypes.ENUM('Simple', 'Compound'),
      defaultValue: 'Simple',
    },
  },
  { timestamps: true },
);

export default UnitOfMeasure;
