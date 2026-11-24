const { sequelize, DataTypes } = require('../db');

const SchemeCode = sequelize.define('SchemeCode', {
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  desc: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  requiresLicense: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  requiresDbk: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  requiresRodtep: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  timestamps: true,
});

module.exports = SchemeCode;
