import { sequelize, DataTypes } from '../config/database.js';

// A quote priced off a made-up exchange rate is a real commercial risk, so the rate is taken from the
// Currency master and stored with the quote.
const Quotation = sequelize.define(
  'Quotation',
  {
    quoteNo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    leadId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Leads', key: 'id' } },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    validUntil: { type: DataTypes.DATEONLY, allowNull: true },
    partyLedgerId: { type: DataTypes.INTEGER, allowNull: true },
    clientName: { type: DataTypes.STRING(200), allowNull: false },
    contactPerson: { type: DataTypes.STRING(150), allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    origin: { type: DataTypes.STRING(120), allowNull: true },
    destination: { type: DataTypes.STRING(120), allowNull: true },
    mode: { type: DataTypes.STRING(40), allowNull: true },
    commodity: { type: DataTypes.STRING(200), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    // DRAFT -> SENT -> APPROVED / REJECTED -> CONVERTED
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'DRAFT' },
    sentAt: { type: DataTypes.DATE, allowNull: true },
    sentTo: { type: DataTypes.STRING(150), allowNull: true },
    decidedAt: { type: DataTypes.DATE, allowNull: true },
    rejectReason: { type: DataTypes.STRING(300), allowNull: true },
    // the job this quote became, once it is converted
    jobNo: { type: DataTypes.STRING(40), allowNull: true },
    // totals are recomputed from the charge lines on every save, never typed
    totalBuyInr: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    totalSellInr: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
    createdByName: { type: DataTypes.STRING(150), allowNull: true },
  },
  { timestamps: true },
);

export default Quotation;
