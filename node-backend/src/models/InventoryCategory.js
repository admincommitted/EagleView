import { sequelize, DataTypes } from '../config/database.js';

const InventoryCategory = sequelize.define(
  'InventoryCategory',
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    parentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'InventoryCategories', key: 'id' } },
  },
  { timestamps: true },
);

export default InventoryCategory;
