const { sequelize, DataTypes } = require('../db');

const FieldAgent = sequelize.define('FieldAgent', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING(50),
        defaultValue: 'Fleet Driver'
        // Options: Fleet Driver, Doc Collection, Customs Clerk, Airport Runner, Other
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    vehicleNumber: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'Idle'
    },
    currentLat: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    },
    currentLng: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    },
    currentLocation: {
        type: DataTypes.STRING,
        defaultValue: 'Location Unknown'
    },
    battery: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    speed: {
        type: DataTypes.STRING,
        defaultValue: '0 km/h'
    },
    currentTask: {
        type: DataTypes.STRING,
        defaultValue: 'None'
    },
    taskStatus: {
        type: DataTypes.STRING(20),
        defaultValue: 'N/A'
    },
    lastSeen: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // 14-Nov-2026: field app security (utils/fieldAuth.js) - SHA-256 of the phone's device token (never sent out),
    // when it was given, and when the phone last used the old app without a token
    deviceTokenHash: { type: DataTypes.STRING(64), allowNull: true },
    deviceIssuedAt: { type: DataTypes.DATE, allowNull: true },
    lastLegacyAt: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'FieldAgents',
    timestamps: true
});

// the token hash never leaves the server; screens get "phoneSecure" (registered with the office code) instead
FieldAgent.prototype.toJSON = function () {
    const v = { ...this.get() };
    v.phoneSecure = !!v.deviceTokenHash;
    delete v.deviceTokenHash;
    return v;
};

module.exports = FieldAgent;
