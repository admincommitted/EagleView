const { sequelize, DataTypes } = require('../db');

const PartyDrawbackAccount = sequelize.define('PartyDrawbackAccount', {
    partyId: { type: DataTypes.INTEGER, allowNull: false },
    adCode: { type: DataTypes.STRING },
    bankName: { type: DataTypes.STRING },
    ifscCode: { type: DataTypes.STRING },
    accountNo: { type: DataTypes.STRING },
    bankAddress: { type: DataTypes.STRING }
});

const Party = require('./Party');
Party.hasMany(PartyDrawbackAccount, { foreignKey: 'partyId', as: 'drawbackAccounts' });
PartyDrawbackAccount.belongsTo(Party, { foreignKey: 'partyId' });

module.exports = PartyDrawbackAccount;
