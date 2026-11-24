const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const ExportLicense = sequelize.define('ExportLicense', {
    exportJobId: { type: DataTypes.INTEGER, allowNull: false },
    srNo: { type: DataTypes.INTEGER },
    invNo: { type: DataTypes.INTEGER },
    itemNo: { type: DataTypes.INTEGER },
    regNo: { type: DataTypes.STRING },
    regDate: { type: DataTypes.STRING },
    snE: { type: DataTypes.STRING },
    snC: { type: DataTypes.STRING },
    qty: { type: DataTypes.STRING },
    uqc: { type: DataTypes.STRING },
    expDesc: { type: DataTypes.STRING },
    impDesc: { type: DataTypes.STRING },
    indImp: { type: DataTypes.STRING },
    licNo: { type: DataTypes.STRING },
    licDt: { type: DataTypes.STRING },
    licType: { type: DataTypes.STRING }
});
module.exports = ExportLicense;
