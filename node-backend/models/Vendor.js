const { sequelize, DataTypes } = require('../db');

const Vendor = sequelize.define('Vendor', {
    vendorName: { type: DataTypes.STRING, allowNull: false },
    gstNumber: { type: DataTypes.STRING },
    contactEmail: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    address: { type: DataTypes.TEXT }
});

module.exports = Vendor;
