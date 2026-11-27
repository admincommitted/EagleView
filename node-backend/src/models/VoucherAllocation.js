import { sequelize, DataTypes } from '../config/database.js';

// Bill-wise knock-off: which invoice a receipt / payment was set against.
// These rows are the "Bill-by-Bill Allocation (Knock-off)" grid of the Payment / Receipt screen.
//
// utils/openItems.js uses these where they exist and keeps FIFO (oldest bill first) only for the bills
// nobody allocated.
const VoucherAllocation = sequelize.define(
  'VoucherAllocation',
  {
    // the receipt / payment voucher being allocated
    voucherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Vouchers', key: 'id' },
      onDelete: 'CASCADE',
    },
    // the party whose bill is being knocked off (kept here so a lookup needs no join)
    ledgerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountLedgers', key: 'id' } },
    // the invoice voucher it is set against - null for an advance / on-account receipt
    againstVoucherId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Vouchers', key: 'id' } },
    // what the user saw on screen: the invoice number or bill number
    refNo: { type: DataTypes.STRING(80), allowNull: true },
    // 'AGAINST' an existing bill, 'ADVANCE' against nothing yet, 'ON_ACCOUNT' unallocated on purpose
    refType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'AGAINST' },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    amountFcy: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
  },
  { timestamps: true },
);

export default VoucherAllocation;
