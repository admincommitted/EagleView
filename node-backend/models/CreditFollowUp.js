const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// 30-Oct-2026: the Credit Control screen had a "Save Follow-up Log" button that only printed a toast,
// and a "Communication History" panel with two invented entries hardcoded into the page. Chasing money
// without a record of who said what, when, is the one thing this screen exists for - so it is stored.
const CreditFollowUp = sequelize.define('CreditFollowUp', {
    ledgerId:    { type: DataTypes.INTEGER, allowNull: false, references: { model: 'AccountLedgers', key: 'id' } },
    note:        { type: DataTypes.TEXT, allowNull: false },
    // CALL / EMAIL / VISIT / WHATSAPP / SYSTEM (an automatic mail logs itself as SYSTEM)
    channel:     { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'CALL' },
    promiseDate: { type: DataTypes.DATEONLY, allowNull: true },
    promiseAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    // was the promise kept - set when a receipt covers it, left null while it is still open
    promiseMet:  { type: DataTypes.BOOLEAN, allowNull: true },
    refNo:       { type: DataTypes.STRING(80), allowNull: true },
    createdBy:   { type: DataTypes.INTEGER, allowNull: true },
    createdByName: { type: DataTypes.STRING(150), allowNull: true },
}, { timestamps: true });

module.exports = CreditFollowUp;
