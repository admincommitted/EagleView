import { sequelize, DataTypes } from '../config/database.js';

// Leads / enquiries of the Sales & CRM screen (New Lead / Enquiry form).
const Lead = sequelize.define(
  'Lead',
  {
    enquiryNo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    // an existing customer ledger when there is one; otherwise just the typed name
    partyLedgerId: { type: DataTypes.INTEGER, allowNull: true },
    clientName: { type: DataTypes.STRING(200), allowNull: false },
    contactPerson: { type: DataTypes.STRING(150), allowNull: true },
    designation: { type: DataTypes.STRING(100), allowNull: true },
    email: { type: DataTypes.STRING(150), allowNull: true },
    phone: { type: DataTypes.STRING(40), allowNull: true },
    mode: { type: DataTypes.STRING(20), allowNull: true }, // Sea / Air / Land
    serviceType: { type: DataTypes.STRING(40), allowNull: true }, // Sea FCL, Air Pharma, ...
    origin: { type: DataTypes.STRING(120), allowNull: true },
    destination: { type: DataTypes.STRING(120), allowNull: true },
    incoterms: { type: DataTypes.STRING(10), allowNull: true },
    readinessDate: { type: DataTypes.DATEONLY, allowNull: true },
    commodity: { type: DataTypes.STRING(200), allowNull: true },
    containerType: { type: DataTypes.STRING(20), allowNull: true },
    weight: { type: DataTypes.DECIMAL(15, 3), allowNull: true },
    volume: { type: DataTypes.DECIMAL(15, 3), allowNull: true },
    targetRate: { type: DataTypes.STRING(80), allowNull: true },
    competitor: { type: DataTypes.STRING(150), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    // NEW -> QUOTED -> WON / LOST. Nothing sets it by itself except quoting.
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'NEW' },
    lostReason: { type: DataTypes.STRING(300), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
    createdByName: { type: DataTypes.STRING(150), allowNull: true },
  },
  { timestamps: true },
);

export default Lead;
