import { sequelize, DataTypes } from '../config/database.js';

const AccountLedger = sequelize.define(
  'AccountLedger',
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    groupId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountGroups', key: 'id' } },
    openingBalance: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.0 },
    balanceType: { type: DataTypes.ENUM('Dr', 'Cr'), allowNull: false, defaultValue: 'Dr' },

    // Accounting Behaviors
    maintainBillByBill: { type: DataTypes.BOOLEAN, defaultValue: false },
    costCentresApplicable: { type: DataTypes.BOOLEAN, defaultValue: false },

    // Mailing & Contact Details
    address: { type: DataTypes.TEXT, allowNull: true },
    state: { type: DataTypes.STRING, allowNull: true },
    pinCode: { type: DataTypes.STRING, allowNull: true },
    country: { type: DataTypes.STRING, allowNull: true },
    contactPerson: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },

    // Core Tax Info
    gstin: { type: DataTypes.STRING, allowNull: true },
    pan: { type: DataTypes.STRING, allowNull: true },

    // GST Configuration (For Expenses/Income)
    isGstApplicable: { type: DataTypes.BOOLEAN, defaultValue: false },
    hsnSac: { type: DataTypes.STRING, allowNull: true },
    taxability: { type: DataTypes.STRING, allowNull: true }, // Taxable, Exempt, Nil Rated
    gstRate: { type: DataTypes.DECIMAL(5, 2), allowNull: true },

    // TDS Configuration
    isTdsApplicable: { type: DataTypes.BOOLEAN, defaultValue: false }, // For expenses
    tdsNatureId: { type: DataTypes.INTEGER, allowNull: true }, // Link to TdsNature master
    isTdsDeductible: { type: DataTypes.BOOLEAN, defaultValue: false }, // For party
    deducteeType: { type: DataTypes.STRING, allowNull: true }, // Company, Individual, etc

    // Bank Details
    bankAccount: { type: DataTypes.STRING, allowNull: true },
    bankIfsc: { type: DataTypes.STRING, allowNull: true },
    bankName: { type: DataTypes.STRING, allowNull: true },

    // Credit Limit
    creditLimit: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0.0 },
    creditDays: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { timestamps: true },
);

export default AccountLedger;
