const { sequelize, DataTypes } = require('../db');

const SpecialHandlingCode = sequelize.define('SpecialHandlingCode', {
  awbId: { type: DataTypes.INTEGER, allowNull: false },
  awbType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MAWB' },
  code: { type: DataTypes.STRING, allowNull: false }
});

module.exports = SpecialHandlingCode;
