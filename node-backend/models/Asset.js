const { sequelize, DataTypes } = require('../db');

const Asset = sequelize.define('Asset', {
    assetName: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    photoUrl: { type: DataTypes.STRING },
    status: { type: DataTypes.ENUM('IN_STOCK', 'ASSIGNED', 'DISCARDED'), defaultValue: 'IN_STOCK' },
    assignedTo: { type: DataTypes.STRING },
    assignedDepartment: { type: DataTypes.STRING },
    branch: { type: DataTypes.STRING, defaultValue: 'Head Office' },
    category: { type: DataTypes.STRING, defaultValue: 'General' },
    assetTag: { type: DataTypes.STRING },
    discardReason: { type: DataTypes.TEXT },
    purchaseValue: { type: DataTypes.DECIMAL(15, 2) },
    sourcePurchaseId: { type: DataTypes.INTEGER }, // Link to PurchaseRequest if applicable
    warrantyExpiryDate: { type: DataTypes.DATEONLY },
    billUrl: { type: DataTypes.STRING },
    discardPhotoUrl: { type: DataTypes.STRING }
});

module.exports = Asset;
