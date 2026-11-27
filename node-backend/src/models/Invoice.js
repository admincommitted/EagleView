import { sequelize, DataTypes } from '../config/database.js';

const Invoice = sequelize.define(
  'Invoice',
  {
    invoiceNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    jobType: { type: DataTypes.ENUM('Export', 'Import', 'General'), allowNull: false, defaultValue: 'Export' },
    jobId: { type: DataTypes.INTEGER, allowNull: true },
    partyId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountLedgers', key: 'id' } },
    subTotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    cgstTotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    sgstTotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    igstTotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    grandTotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    status: { type: DataTypes.ENUM('Draft', 'Final'), defaultValue: 'Draft' },
    autoVoucherId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { timestamps: true },
);

export default Invoice;
