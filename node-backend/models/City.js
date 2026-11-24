const { sequelize, DataTypes } = require('../db');

const City = sequelize.define('City', {
    stateId: { type: DataTypes.INTEGER, allowNull: false },
    countryId: { type: DataTypes.INTEGER, allowNull: false },
    cityName: { type: DataTypes.STRING, allowNull: false },
    unlocCode: { type: DataTypes.STRING }, 
    airportName: { type: DataTypes.STRING }, 
    iataCode: { type: DataTypes.STRING },
    portCode: { type: DataTypes.STRING },
    portName: { type: DataTypes.STRING },
    portCategory: { type: DataTypes.STRING },
    chaCode: { type: DataTypes.STRING },
    chaName: { type: DataTypes.STRING },
    division: { type: DataTypes.STRING },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    isSez: { type: DataTypes.BOOLEAN, defaultValue: false } // NEW FIELD
});

module.exports = City;
