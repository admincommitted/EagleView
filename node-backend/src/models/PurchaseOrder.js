import { sequelize, DataTypes } from '../config/database.js';

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  poNumber: { type: DataTypes.STRING, unique: true },
  date: { type: DataTypes.DATEONLY },
  totalAmount: { type: DataTypes.DECIMAL(18, 2) },
  status: { type: DataTypes.ENUM('Draft', 'Pending Approval', 'Approved', 'Rejected', 'Hold'), defaultValue: 'Draft' },
  justification: { type: DataTypes.TEXT },
  directorRemarks: { type: DataTypes.TEXT },
  quoteFilePath: { type: DataTypes.STRING },
  branch: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING },
  priority: { type: DataTypes.STRING },
  submittedAt: { type: DataTypes.DATE }, // set by the routes
  actionAt: { type: DataTypes.DATE },
});

export default PurchaseOrder;
