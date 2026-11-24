const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// 30-Oct-2026: the Budgets & Variance screen showed four invented budgets ("Marketing Budget 2023
// 5,00,000 / utilised 3,50,000") from a hardcoded array under a heading that said FY 2023-2024, and
// its Create Budget button did nothing.
//
// A budget is only meaningful if "utilised" can be measured, so each one is set against something the
// ledger can actually total: one expense ledger, a whole account group, or a cost centre. Utilisation
// is never stored - it is computed from the vouchers in the period every time the screen is opened,
// so it cannot drift away from the books.
const Budget = sequelize.define('Budget', {
    name:      { type: DataTypes.STRING(150), allowNull: false },
    // LEDGER | GROUP | COST_CENTRE
    basis:     { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'LEDGER' },
    targetId:  { type: DataTypes.INTEGER, allowNull: false },
    fromDate:  { type: DataTypes.DATEONLY, allowNull: false },
    toDate:    { type: DataTypes.DATEONLY, allowNull: false },
    allocated: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    // warn the user when utilisation crosses this share of the allocation
    warnAtPct: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 80 },
    notes:     { type: DataTypes.TEXT, allowNull: true },
    createdByName: { type: DataTypes.STRING(150), allowNull: true },
}, { timestamps: true });

module.exports = Budget;
