import { sequelize, DataTypes } from '../config/database.js';

const Godown = sequelize.define(
  'Godown',
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    parentId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Godowns', key: 'id' } },
    address: { type: DataTypes.TEXT, allowNull: true },
  },
  { timestamps: true },
);

export default Godown;
