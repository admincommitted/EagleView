import { sequelize, DataTypes } from '../config/database.js';

const CostCategory = sequelize.define(
  'CostCategory',
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    allocateRevenue: { type: DataTypes.BOOLEAN, defaultValue: true },
    allocateNonRevenue: { type: DataTypes.BOOLEAN, defaultValue: false },
    isBuiltIn: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { timestamps: true },
);

export default CostCategory;
