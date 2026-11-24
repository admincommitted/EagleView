const { sequelize, DataTypes } = require('../db');

const Port = sequelize.define('Port', {
    portCode: { type: DataTypes.STRING, allowNull: false, unique: true },
    portName: { type: DataTypes.STRING, allowNull: false },
    country: { type: DataTypes.STRING, defaultValue: 'INDIA (IN)' },
    category: { type: DataTypes.STRING }, // AIR, SEA, ICD, SEZ
    isSez: { type: DataTypes.BOOLEAN, defaultValue: false },
    chaCode: { type: DataTypes.STRING },
    chaName: { type: DataTypes.STRING },
    division: { type: DataTypes.STRING },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

module.exports = Port;
