import { sequelize, DataTypes } from '../config/database.js';

// Customer Contract & Quotation master (page /contracts).

const CustomerContract = sequelize.define(
  'CustomerContract',
  {
    contractNo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    partyId: { type: DataTypes.INTEGER, allowNull: false },
    partyName: { type: DataTypes.STRING, allowNull: true },
    validFrom: { type: DataTypes.DATEONLY, allowNull: true },
    validTo: { type: DataTypes.DATEONLY, allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Draft' }, // Draft, Pending Approval, Active, Rejected
    salesRep: { type: DataTypes.STRING, allowNull: true },
    terms: { type: DataTypes.TEXT, allowNull: true },
    splitInvoicing: { type: DataTypes.BOOLEAN, defaultValue: false },
    consolidatedBilling: { type: DataTypes.BOOLEAN, defaultValue: false },
    autoEmailInvoices: { type: DataTypes.BOOLEAN, defaultValue: true },
    billingNotes: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.STRING, allowNull: true },
    approvedBy: { type: DataTypes.STRING, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'CustomerContracts' },
);

// one attribute object per column: a single shared object makes Sequelize map every rate column
// (normal, +45 ... +1000, rate, minAmt, maxAmt, amount) to the field "min", so only one number would be stored
const rate = () => ({ type: DataTypes.DECIMAL(14, 2), allowNull: true });
const ContractFreightRate = sequelize.define(
  'ContractFreightRate',
  {
    contractId: { type: DataTypes.INTEGER, allowNull: false },
    origin: { type: DataTypes.STRING(5), allowNull: false },
    destination: { type: DataTypes.STRING(5), allowNull: false },
    serviceType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'General' },
    carrier: { type: DataTypes.STRING(10), allowNull: true },
    chargeName: { type: DataTypes.STRING, allowNull: true }, // the Accounts GST charge billed for this freight
    min: rate(),
    normal: rate(),
    plus45: rate(),
    plus100: rate(),
    plus300: rate(),
    plus500: rate(),
    plus1000: rate(),
  },
  { tableName: 'ContractFreightRates' },
);

const ContractCharge = sequelize.define(
  'ContractCharge',
  {
    contractId: { type: DataTypes.INTEGER, allowNull: false },
    printName: { type: DataTypes.STRING, allowNull: false },
    systemLedger: { type: DataTypes.STRING, allowNull: true },
    basis: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'Flat' },
    rate: rate(),
    minAmt: rate(),
    maxAmt: rate(),
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
    mandatory: { type: DataTypes.BOOLEAN, defaultValue: false },
    type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Taxable' }, // Taxable, Non-Taxable, Reimbursement
    appliesTo: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'ALL' }, // ALL, AE, AI, SE, SI
  },
  { tableName: 'ContractCharges' },
);

const ContractTransportRate = sequelize.define(
  'ContractTransportRate',
  {
    contractId: { type: DataTypes.INTEGER, allowNull: false },
    fromLoc: { type: DataTypes.STRING, allowNull: false },
    toLoc: { type: DataTypes.STRING, allowNull: false },
    vehicle: { type: DataTypes.STRING(40), allowNull: true },
    amount: rate(),
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
    chargeName: { type: DataTypes.STRING, allowNull: true }, // the Accounts GST charge billed for this cartage
  },
  { tableName: 'ContractTransportRates' },
);

export { CustomerContract, ContractFreightRate, ContractCharge, ContractTransportRate };
