import { sequelize, DataTypes } from '../config/database.js';

const InventoryGroup = sequelize.define(
  'InventoryGroup',
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    parentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'InventoryGroups', key: 'id' } },
  },
  { timestamps: true },
);

export default InventoryGroup;
