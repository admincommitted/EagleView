import { sequelize, DataTypes } from '../config/database.js';

const AccountGroup = sequelize.define(
  'AccountGroup',
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'AccountGroups',
        key: 'id',
      },
    },
    nature: {
      type: DataTypes.ENUM('Assets', 'Liabilities', 'Income', 'Expenses'),
      allowNull: false,
    },
    isBuiltIn: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
  },
);

export default AccountGroup;
