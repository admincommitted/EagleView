const { sequelize, DataTypes } = require('../db');
const Airline = sequelize.define('Airline', {
  name: { type: DataTypes.STRING, allowNull: false },
  code3: { type: DataTypes.STRING },
  code2: { type: DataTypes.STRING },
  prefix: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' },
  customLogo: { type: DataTypes.TEXT },
  commRate: { type: DataTypes.STRING },
  commType: { type: DataTypes.STRING },
  accountNo: { type: DataTypes.STRING },
  pan: { type: DataTypes.STRING },
  address1: { type: DataTypes.STRING },
  address2: { type: DataTypes.STRING },
  contact: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  state: { type: DataTypes.STRING },
  country: { type: DataTypes.STRING },
  otherData: { type: DataTypes.TEXT },
  // airline's own tracking page (29-Oct-2026), e.g. https://example-airline.com/track?awb={awb}
  // {awb} = 11 digits, {awbdash} = 176-12345675, {prefix} = 176, {serial} = 12345675
  trackingUrl: { type: DataTypes.STRING(500), allowNull: true, validate: { isWebLink(v) { if (v && !/^https?:\/\/[^\s]+$/i.test(String(v).trim())) throw new Error('Tracking link must start with http:// or https://'); } } }
});
module.exports = Airline;
