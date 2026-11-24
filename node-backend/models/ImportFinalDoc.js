const { sequelize, DataTypes } = require('../db');

const ImportFinalDoc = sequelize.define('ImportFinalDoc', {
    beNo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    docType: {
        type: DataTypes.STRING, // 'BE_COPY', 'OOC_COPY', 'GATEPASS'
        allowNull: false
    },
    fileName: {
        type: DataTypes.STRING
    },
    fileUrl: {
        type: DataTypes.STRING
    },
    messageId: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'import_final_docs',
    timestamps: true
});

module.exports = ImportFinalDoc;
