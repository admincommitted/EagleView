const { sequelize, DataTypes } = require('../db');

const CompanyBranch = sequelize.define('CompanyBranch', {
  branchCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  branchName: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'Active' },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  // 05-Nov-2026: iCAFFE branch code (NDL) and GST state (DL) - columns already in the table
  icaffeCode: { type: DataTypes.STRING },
  stateCode: { type: DataTypes.STRING },
  // 07-Nov-2026: branch-wise GST registration and contact details
  gstin: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  website: { type: DataTypes.STRING }
});

module.exports = CompanyBranch;
