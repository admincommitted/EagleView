import { sequelize, DataTypes } from '../config/database.js';

// CBIC customs exchange rates, one row per currency per notification.
// The Currency master holds one rate per currency - the one in force today. A BE must carry the rate in force on its
// own date, and CBIC publishes a notification the evening before it comes into force, so every notification read from
// ICEGATE is kept here with its effective date. effectiveDate is a plain 'YYYY-MM-DD' (the day in India) - a DATE
// column comes back as the UTC moment ("2026-11-17T18:30:00.000Z" for 18-Nov) and reads as the day before.

const CurrencyRateHistory = sequelize.define(
  'CurrencyRateHistory',
  {
    currencyCode: { type: DataTypes.STRING, allowNull: false },
    currencyName: { type: DataTypes.STRING, allowNull: true },
    units: { type: DataTypes.REAL, defaultValue: 1 }, // CBIC quotes JPY / KRW per 100; rates below are per 1 unit
    importRate: { type: DataTypes.REAL, allowNull: false }, // rupees per 1 unit
    exportRate: { type: DataTypes.REAL, allowNull: false },
    effectiveDate: { type: DataTypes.STRING, allowNull: false }, // 'YYYY-MM-DD'
    notificationNo: { type: DataTypes.STRING, allowNull: false }, // 'CBIC 31/2026'
    source: { type: DataTypes.STRING, allowNull: true },
  },
  {
    timestamps: true,
    indexes: [
      { unique: true, fields: ['currencyCode', 'notificationNo'] },
      { fields: ['currencyCode', 'effectiveDate'] },
    ],
  },
);

export default CurrencyRateHistory;
