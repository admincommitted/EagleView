// AWB templates saved by the user from the AWB / MAWB / HAWB screens (SAVE AS TEMPLATE, 29-Oct-2026). Before, the
// button only showed "Saved as Template!" and nothing was kept. A template holds the reusable part of an AWB
// (routing, parties, agent, handling codes, charges ...), never the AWB number, pieces, weights or flight dates.
const { sequelize, DataTypes } = require('../db');

const AwbTemplate = sequelize.define('AwbTemplate', {
    awbType: { type: DataTypes.STRING(10), allowNull: false },  // AWB / MAWB / HAWB
    name: { type: DataTypes.STRING(60), allowNull: false },
    data: { type: DataTypes.TEXT, allowNull: true },             // JSON of the screen fields
    createdBy: { type: DataTypes.STRING, allowNull: true },
}, {
    tableName: 'AwbTemplates',
    indexes: [{ unique: true, fields: ['awbType', 'name'] }],
});

module.exports = AwbTemplate;
