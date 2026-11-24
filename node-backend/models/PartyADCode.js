const { sequelize, DataTypes } = require('../db');

const PartyADCode = sequelize.define('PartyADCode', {
    partyId: { type: DataTypes.INTEGER, allowNull: false },
    adCode: { type: DataTypes.STRING },
    bankName: { type: DataTypes.STRING },
    serialNo: { type: DataTypes.STRING },
    branchAddress: { type: DataTypes.STRING },
    forexCode: { type: DataTypes.STRING },
    bankAddress: { type: DataTypes.STRING },
    loadingPort: { type: DataTypes.STRING }
});

const Party = require('./Party');
Party.hasMany(PartyADCode, { foreignKey: 'partyId', as: 'adCodes' });
PartyADCode.belongsTo(Party, { foreignKey: 'partyId' });

module.exports = PartyADCode;
