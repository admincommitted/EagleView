const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// 30-Oct-2026: the "Auto-Mail Rules" tab of Credit Control showed three switches that were
// hardcoded (two checked, one not) and read-only - nothing was stored and nothing acted on them.
// One row per customer ledger. Nothing here sends mail by itself; the flags are what the
// outstanding-reminder job and the D/O release check read.
const CreditPolicy = sequelize.define('CreditPolicy', {
    ledgerId:          { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: 'AccountLedgers', key: 'id' } },
    autoSendLedger:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // days of the month to send the statement on, e.g. "1,15"
    autoSendDays:      { type: DataTypes.STRING(40), allowNull: true, defaultValue: '1,15' },
    overdueReminders:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    reminderAfterDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    // block the Delivery Order / BL release while the party is over its credit limit
    autoHoldDelivery:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    notes:             { type: DataTypes.TEXT, allowNull: true },
    updatedByName:     { type: DataTypes.STRING(150), allowNull: true },
}, { timestamps: true });

module.exports = CreditPolicy;
