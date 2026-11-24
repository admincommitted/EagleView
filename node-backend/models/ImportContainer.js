const { sequelize, DataTypes } = require('../db');

const ImportContainer = sequelize.define('ImportContainer', {
    importJobId: { type: DataTypes.INTEGER, allowNull: false },
    containerNo: { type: DataTypes.STRING },
    size: { type: DataTypes.STRING },
    type: { type: DataTypes.STRING },
    sealNo: { type: DataTypes.STRING },
    extendedData: { type: DataTypes.TEXT, allowNull: true } // form fields without a column of their own (JSON), 28-Oct-2026
});

module.exports = ImportContainer;
