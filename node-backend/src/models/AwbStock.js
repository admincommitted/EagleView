import { sequelize, DataTypes } from '../config/database.js';

const AwbStock = sequelize.define('AwbStock', {
  airlinePrefix: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [3, 3] },
  },
  sequenceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [7, 7] },
  },
  checkDigit: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fullAwbNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: [11, 11] },
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'ALLOCATED', 'USED', 'VOID'),
    defaultValue: 'AVAILABLE',
  },
  stockDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

export default AwbStock;
