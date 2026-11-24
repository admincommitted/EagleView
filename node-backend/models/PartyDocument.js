const { sequelize, DataTypes } = require('../db');
const Party = require('./Party');

const PartyDocument = sequelize.define('PartyDocument', {
  partyId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  documentType: {
    type: DataTypes.STRING,
    defaultValue: 'OTHER'
  },
  docStatus: {
    type: DataTypes.STRING,
    defaultValue: 'PENDING'
  }
});

Party.hasMany(PartyDocument, { foreignKey: 'partyId', as: 'kycDocs' });
PartyDocument.belongsTo(Party, { foreignKey: 'partyId' });

module.exports = PartyDocument;
