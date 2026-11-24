// Extra documents / sheets filled on the AWB screens (29-Oct-2026): DG declaration, live-animal certificate, security
// declaration, lithium battery, certificate of origin, CCA, temperature control, SLI, delivery order, cargo label,
// booking confirmation, cargo manifest, commodity list. Before, these windows were print-only and nothing was kept.
// One row per AWB record + document type; the window's fields are kept as JSON.
const { sequelize, DataTypes } = require('../db');

const AwbExtraDoc = sequelize.define('AwbExtraDoc', {
    awbId: { type: DataTypes.INTEGER, allowNull: false },
    awbType: { type: DataTypes.STRING(10), allowNull: false },  // AWB / MAWB / HAWB
    docType: { type: DataTypes.STRING(30), allowNull: false },  // DGD, AVI, CSD, LITHIUM, COO, CCA, TEMP, SLI, DO, LABEL, BOOKING, MANIFEST, COMMODITY
    data: { type: DataTypes.TEXT, allowNull: true },             // JSON
    updatedBy: { type: DataTypes.STRING, allowNull: true },
}, {
    tableName: 'AwbExtraDocs',
    indexes: [{ unique: true, fields: ['awbId', 'awbType', 'docType'] }],
});

module.exports = AwbExtraDoc;
