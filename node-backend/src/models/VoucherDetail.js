import { sequelize, DataTypes } from '../config/database.js';

const VoucherDetail = sequelize.define(
  'VoucherDetail',
  {
    voucherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Vouchers', key: 'id' },
      onDelete: 'CASCADE',
    },
    ledgerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountLedgers', key: 'id' } },
    dc: { type: DataTypes.ENUM('Dr', 'Cr'), allowNull: false },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    clearanceDate: { type: DataTypes.DATEONLY, allowNull: true },
    // the cost-centre, foreign-currency and remarks boxes of each Voucher Entry line
    costCentreId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'CostCentres', key: 'id' } },
    currency: { type: DataTypes.STRING(3), allowNull: true },
    roe: { type: DataTypes.DECIMAL(15, 6), allowNull: true },
    amountFcy: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    remarks: { type: DataTypes.STRING(300), allowNull: true },
  },
  { timestamps: true },
);

export default VoucherDetail;
