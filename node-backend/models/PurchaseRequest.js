const { sequelize, DataTypes } = require('../db');

const PurchaseRequest = sequelize.define('PurchaseRequest', {
    itemName: { type: DataTypes.STRING, allowNull: false },
    itemDetails: { type: DataTypes.TEXT },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    lastPurchaseDate: { type: DataTypes.DATEONLY }, // When was this type of item last purchased
    intendedUser: { type: DataTypes.STRING, allowNull: false },
    designation: { type: DataTypes.STRING },
    department: { type: DataTypes.STRING },
    branch: { type: DataTypes.STRING, defaultValue: 'Head Office' },
    category: { type: DataTypes.STRING, defaultValue: 'General' },
    priority: { type: DataTypes.STRING, defaultValue: 'NORMAL' },
    expectedDate: { type: DataTypes.DATEONLY },
    productPhotoUrl: { type: DataTypes.STRING },
    justification: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'PENDING' },
    rejectionReason: { type: DataTypes.TEXT },
    approvedBy: { type: DataTypes.STRING },
    approvedAt: { type: DataTypes.DATE }
});

module.exports = PurchaseRequest;
