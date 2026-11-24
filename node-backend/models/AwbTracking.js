const { sequelize, DataTypes } = require('../db');

const AwbTracking = sequelize.define('AwbTracking', {
  awbNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  hawbNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  documentType: {
    type: DataTypes.STRING, // 'AIR WAYBILL', 'MASTER', 'HOUSE'
    allowNull: false
  },
  saved: { type: DataTypes.BOOLEAN, defaultValue: false },
  submittedToAirline: { type: DataTypes.BOOLEAN, defaultValue: false },
  
  // Milestones (stored as ISO datetime strings or null)
  fna: { type: DataTypes.STRING, allowNull: true },
  fma: { type: DataTypes.STRING, allowNull: true },
  foh: { type: DataTypes.STRING, allowNull: true },
  rcs: { type: DataTypes.STRING, allowNull: true },
  dep: { type: DataTypes.STRING, allowNull: true },
  arr: { type: DataTypes.STRING, allowNull: true },
  tfd: { type: DataTypes.STRING, allowNull: true },
  rcf: { type: DataTypes.STRING, allowNull: true },
  nfd: { type: DataTypes.STRING, allowNull: true },
  dlv: { type: DataTypes.STRING, allowNull: true },

  // General info
  origin: { type: DataTypes.STRING, allowNull: true },
  destination: { type: DataTypes.STRING, allowNull: true },
  departureDate: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, defaultValue: 'PENDING' }
});

module.exports = AwbTracking;
