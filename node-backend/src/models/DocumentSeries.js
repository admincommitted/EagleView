import { sequelize, DataTypes } from '../config/database.js';

// Document Series & Numbering Master (Settings > Document Series).

const DocumentSeries = sequelize.define(
  'DocumentSeries',
  {
    docType: { type: DataTypes.STRING(60), allowNull: false }, // Tax Invoice, Payment Voucher, ...
    branchCode: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ALL' },
    dept: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'ALL' },
    fyCode: { type: DataTypes.STRING(20), allowNull: false }, // FinancialYear.code, e.g. 26-27
    format: { type: DataTypes.STRING(120), allowNull: false }, // e.g. {BRANCH}/{DEPT}/INV/{FY}/
    pad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    nextNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }, // the NEXT number to give
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: 'DocumentSeries',
    indexes: [{ unique: true, fields: ['docType', 'branchCode', 'dept', 'fyCode'] }],
  },
);

export default DocumentSeries;
