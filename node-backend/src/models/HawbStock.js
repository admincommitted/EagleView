import { sequelize, DataTypes } from '../config/database.js';

const HawbStock = sequelize.define('HawbStock', {
  prefix: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sequenceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fullHawbNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  partyType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  partyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
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

export default HawbStock;
