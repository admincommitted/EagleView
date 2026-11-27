import { sequelize, DataTypes } from '../config/database.js';

const PartyDocument = sequelize.define('PartyDocument', {
  partyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  documentType: {
    type: DataTypes.STRING,
    defaultValue: 'OTHER',
  },
  docStatus: {
    type: DataTypes.STRING,
    defaultValue: 'PENDING',
  },
});

export default PartyDocument;
