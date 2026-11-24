const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// Bill-wise knock-off: which invoice a receipt / payment was set against.
//
// 30-Oct-2026: until now no receipt carried a bill reference, so every outstanding figure in this
// system had to fall back to FIFO (oldest bill first) and every screen showing one had to say so.
// The Payment / Receipt screen had a "Bill-by-Bill Allocation (Knock-off)" grid that stored nothing -
// its one row was hardcoded and Auto-FIFO only printed a toast. These rows are that allocation.
//
// utils/openItems.js uses these where they exist and keeps FIFO only for the bills nobody allocated,
// so old data behaves exactly as before and new data is exact.
const VoucherAllocation = sequelize.define('VoucherAllocation', {
    // the receipt / payment voucher being allocated
    voucherId:       { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Vouchers', key: 'id' }, onDelete: 'CASCADE' },
    // the party whose bill is being knocked off (kept here so a lookup needs no join)
    ledgerId:        { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountLedgers', key: 'id' } },
    // the invoice voucher it is set against - null for an advance / on-account receipt
    againstVoucherId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Vouchers', key: 'id' } },
    // what the user saw on screen: the invoice number or bill number
    refNo:           { type: DataTypes.STRING(80), allowNull: true },
    // 'AGAINST' an existing bill, 'ADVANCE' against nothing yet, 'ON_ACCOUNT' unallocated on purpose
    refType:         { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'AGAINST' },
    amount:          { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    amountFcy:       { type: DataTypes.DECIMAL(15, 2), allowNull: true },
}, { timestamps: true });

module.exports = VoucherAllocation;
