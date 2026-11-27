import { sequelize, DataTypes } from '../config/database.js';

// One charge line of a quotation. buyRate is what it costs us, sellRate what the customer is quoted;
// roe is the rate actually used at the time of quoting (from the Currency master, not a hardcoded 84).
const QuotationCharge = sequelize.define(
  'QuotationCharge',
  {
    quotationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Quotations', key: 'id' },
      onDelete: 'CASCADE',
    },
    head: { type: DataTypes.STRING(150), allowNull: false },
    buyRate: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    sellRate: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
    roe: { type: DataTypes.DECIMAL(15, 6), allowNull: false, defaultValue: 1 },
    qty: { type: DataTypes.DECIMAL(15, 3), allowNull: false, defaultValue: 1 },
    basis: { type: DataTypes.STRING(40), allowNull: true },
    remarks: { type: DataTypes.STRING(200), allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { timestamps: true },
);

export default QuotationCharge;
