const { sequelize, DataTypes } = require('../db');

const AWBDocument = sequelize.define('AWBDocument', {
  awbId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tempId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // 29-Oct-2026: AWB / MAWB rows and HAWB rows have separate id ranges, so the type is needed with awbId
  awbType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  documentType: {
    type: DataTypes.STRING,
    defaultValue: 'OTHER'
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
  }
});

module.exports = AWBDocument;
