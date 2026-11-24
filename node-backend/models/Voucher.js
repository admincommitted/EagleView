const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Voucher = sequelize.define('Voucher', {
    voucherTypeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'VoucherTypes', key: 'id' } },
    voucherNumber: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    narration: { type: DataTypes.TEXT, allowNull: true },
    totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' }, // Pending, Approved, Rejected
    // 30-Oct-2026: who raised the voucher was never recorded, so the approvals screen had no one to show and
    // invented names. It is taken from the logged-in user on create.
    // 30-Oct-2026: a voucher carried no link to the job it belongs to, so job-wise and lane-wise profit could
    // not be worked out at all - the Director MIS invented both. The entry screens set it now.
    jobNo: { type: DataTypes.STRING, allowNull: true },
    // 30-Oct-2026: the Voucher Entry screen has Branch and Reference / Bill No. boxes; they used to go nowhere
    branchCode: { type: DataTypes.STRING(20), allowNull: true },
    refNo: { type: DataTypes.STRING(80), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
    createdByName: { type: DataTypes.STRING, allowNull: true },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true },
    rejectionReason: { type: DataTypes.STRING, allowNull: true }
}, { timestamps: true });

module.exports = Voucher;