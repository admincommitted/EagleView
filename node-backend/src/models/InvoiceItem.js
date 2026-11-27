import { sequelize, DataTypes } from '../config/database.js';

const InvoiceItem = sequelize.define(
  'InvoiceItem',
  {
    invoiceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Invoices', key: 'id' },
      onDelete: 'CASCADE',
    },
    chargeLedgerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountLedgers', key: 'id' } },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    taxRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 18 },
    cgst: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    sgst: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    igst: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  },
  { timestamps: true },
);

export default InvoiceItem;
