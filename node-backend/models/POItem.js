const { sequelize, DataTypes } = require('../db');
const PurchaseOrder = require('./PurchaseOrder');

const POItem = sequelize.define('POItem', {
    itemName: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    gstRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    gstAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
    isReceived: { type: DataTypes.BOOLEAN, defaultValue: false }, // set by Asset Management "Inward"
    receivedAt: { type: DataTypes.DATE }
});

PurchaseOrder.hasMany(POItem, { foreignKey: 'PO_ID', as: 'items' });
POItem.belongsTo(PurchaseOrder, { foreignKey: 'PO_ID' });

module.exports = POItem;
