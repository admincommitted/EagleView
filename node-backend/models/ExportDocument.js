const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const ExportDocument = sequelize.define('ExportDocument', {
    exportJobId: { type: DataTypes.INTEGER, allowNull: false },
    icegateId: { type: DataTypes.STRING },
    irnNo: { type: DataTypes.STRING },
    docType: { type: DataTypes.STRING },
    drn: { type: DataTypes.STRING },
    docCode: { type: DataTypes.STRING },
    docName: { type: DataTypes.STRING },
    docUrl: { type: DataTypes.STRING }
});
module.exports = ExportDocument;
