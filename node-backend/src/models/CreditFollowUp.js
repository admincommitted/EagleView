import { sequelize, DataTypes } from '../config/database.js';

// Credit Control follow-up log ("Save Follow-up Log" / "Communication History"): who said what, when.
const CreditFollowUp = sequelize.define(
  'CreditFollowUp',
  {
    ledgerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountLedgers', key: 'id' } },
    note: { type: DataTypes.TEXT, allowNull: false },
    // CALL / EMAIL / VISIT / WHATSAPP / SYSTEM (an automatic mail logs itself as SYSTEM)
    channel: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'CALL' },
    promiseDate: { type: DataTypes.DATEONLY, allowNull: true },
    promiseAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    // was the promise kept - set when a receipt covers it, left null while it is still open
    promiseMet: { type: DataTypes.BOOLEAN, allowNull: true },
    refNo: { type: DataTypes.STRING(80), allowNull: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: true },
    createdByName: { type: DataTypes.STRING(150), allowNull: true },
  },
  { timestamps: true },
);

export default CreditFollowUp;
