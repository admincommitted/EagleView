import { sequelize, DataTypes } from '../config/database.js';

// AWB templates saved by the user from the AWB / MAWB / HAWB screens (SAVE AS TEMPLATE).
// A template holds the reusable part of an AWB
// (routing, parties, agent, handling codes, charges ...), never the AWB number, pieces, weights or flight dates.

const AwbTemplate = sequelize.define(
  'AwbTemplate',
  {
    awbType: { type: DataTypes.STRING(10), allowNull: false }, // AWB / MAWB / HAWB
    name: { type: DataTypes.STRING(60), allowNull: false },
    data: { type: DataTypes.TEXT, allowNull: true }, // JSON of the screen fields
    createdBy: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: 'AwbTemplates',
    indexes: [{ unique: true, fields: ['awbType', 'name'] }],
  },
);

export default AwbTemplate;
