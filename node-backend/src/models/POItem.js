import { sequelize, DataTypes } from '../config/database.js';

const POItem = sequelize.define('POItem', {
  itemName: { type: DataTypes.STRING, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  gstRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  gstAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  isReceived: { type: DataTypes.BOOLEAN, defaultValue: false }, // set by Asset Management "Inward"
  receivedAt: { type: DataTypes.DATE },
});

export default POItem;
