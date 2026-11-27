import { sequelize, DataTypes } from '../config/database.js';

const CostCentre = sequelize.define(
  'CostCentre',
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    categoryId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'CostCategories', key: 'id' } },
    parentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'CostCentres', key: 'id' } },
  },
  { timestamps: true },
);

export default CostCentre;
