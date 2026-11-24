const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const VoucherDetail = sequelize.define('VoucherDetail', {
    voucherId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Vouchers', key: 'id' }, onDelete: 'CASCADE' },
    ledgerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountLedgers', key: 'id' } },
    dc: { type: DataTypes.ENUM('Dr', 'Cr'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    clearanceDate: { type: DataTypes.DATEONLY, allowNull: true },
    // 30-Oct-2026: the Voucher Entry screen had cost-centre, foreign-currency and remarks boxes per line with
    // nowhere to store them (and saved nothing at all). These are the columns behind those boxes.
    costCentreId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'CostCentres', key: 'id' } },
    currency: { type: DataTypes.STRING(3), allowNull: true },
    roe: { type: DataTypes.DECIMAL(15, 6), allowNull: true },
    amountFcy: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    remarks: { type: DataTypes.STRING(300), allowNull: true }
}, { timestamps: true });

module.exports = VoucherDetail;