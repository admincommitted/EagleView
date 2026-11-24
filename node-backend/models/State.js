const { sequelize, DataTypes } = require('../db');

const State = sequelize.define('State', {
    countryId: { type: DataTypes.INTEGER, allowNull: false },
    stateName: { type: DataTypes.STRING, allowNull: false },
    stateCode: { type: DataTypes.STRING, allowNull: false },
    taxCode: { type: DataTypes.STRING, allowNull: false } // e.g. 07 for Delhi
});

module.exports = State;
