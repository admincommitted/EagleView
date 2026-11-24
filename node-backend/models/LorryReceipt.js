const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// 30-Oct-2026: the Fleet & Transport screen listed two invented trips with invented vehicle numbers
// and drivers ("LR-2026-901 / HR 38 X 4455 / Raju Singh"), its "Update Status" button did nothing,
// and the Lorry Receipt form behind it saved nothing - 21 of its 23 boxes were not even bound to
// state, so anything typed into them vanished on the spot.
const LorryReceipt = sequelize.define('LorryReceipt', {
    lrNo:          { type: DataTypes.STRING(40), allowNull: false, unique: true },
    date:          { type: DataTypes.DATEONLY, allowNull: false },
    jobNo:         { type: DataTypes.STRING(40), allowNull: true },
    // parties: a ledger id when they are on the books, otherwise just the typed name
    consignor:     { type: DataTypes.STRING(200), allowNull: true },
    consignee:     { type: DataTypes.STRING(200), allowNull: true },
    billingParty:  { type: DataTypes.STRING(200), allowNull: true },
    billingLedgerId: { type: DataTypes.INTEGER, allowNull: true },
    transporterId: { type: DataTypes.INTEGER, allowNull: true },

    origin:        { type: DataTypes.STRING(120), allowNull: true },
    destination:   { type: DataTypes.STRING(120), allowNull: true },
    distanceKm:    { type: DataTypes.DECIMAL(10, 2), allowNull: true },

    vehicleNo:     { type: DataTypes.STRING(20), allowNull: true },
    vehicleType:   { type: DataTypes.STRING(60), allowNull: true },
    driverName:    { type: DataTypes.STRING(120), allowNull: true },
    driverPhone:   { type: DataTypes.STRING(20), allowNull: true },
    dlNumber:      { type: DataTypes.STRING(30), allowNull: true },

    ewayBill:      { type: DataTypes.STRING(20), allowNull: true },
    invoiceValue:  { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    packages:      { type: DataTypes.INTEGER, allowNull: true },
    actualWeight:  { type: DataTypes.DECIMAL(15, 3), allowNull: true },
    chargedWeight: { type: DataTypes.DECIMAL(15, 3), allowNull: true },
    commodity:     { type: DataTypes.STRING(200), allowNull: true },

    // Per Ton / Per Trip / Per Km / Flat - the freight is computed from this, never typed blind
    freightBasis:  { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'Per Trip' },
    freightRate:   { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    freightAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    advanceToDriver: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    paymentType:   { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'To Pay' },
    // the voucher that actually paid the advance, when one was posted
    advanceVoucherId: { type: DataTypes.INTEGER, allowNull: true },

    // PENDING_DISPATCH -> IN_TRANSIT -> DELIVERED, or CANCELLED
    status:        { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING_DISPATCH' },
    dispatchedAt:  { type: DataTypes.DATE, allowNull: true },
    deliveredAt:   { type: DataTypes.DATE, allowNull: true },
    podReceived:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    remarks:       { type: DataTypes.TEXT, allowNull: true },
    createdByName: { type: DataTypes.STRING(150), allowNull: true },
}, { timestamps: true });

module.exports = LorryReceipt;
