import { sequelize, DataTypes } from '../config/database.js';

const Vendor = sequelize.define('Vendor', {
  vendorName: { type: DataTypes.STRING, allowNull: false },
  gstNumber: { type: DataTypes.STRING },
  contactEmail: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  address: { type: DataTypes.TEXT },
});

export default Vendor;
