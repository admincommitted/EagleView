import { sequelize, DataTypes } from '../config/database.js';

const Voucher = sequelize.define(
  'Voucher',
  {
    voucherTypeId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'VoucherTypes', key: 'id' } },
    voucherNumber: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    narration: { type: DataTypes.TEXT, allowNull: true },
    totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0.0 },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' }, // Pending, Approved, Rejected
    // who raised the voucher, taken from the logged-in user on create (shown on the approvals screen)
    // the job the voucher belongs to (job-wise and lane-wise profit); set by the entry screens
    jobNo: { type: DataTypes.STRING, allowNull: true },
    // the Branch and Reference / Bill No. boxes of the Voucher Entry screen
    branchCode: { type: DataTypes.STRING(20), allowNull: true },
    refNo: { type: DataTypes.STRING(80), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
    createdByName: { type: DataTypes.STRING, allowNull: true },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true },
    rejectionReason: { type: DataTypes.STRING, allowNull: true },
  },
  { timestamps: true },
);

export default Voucher;
