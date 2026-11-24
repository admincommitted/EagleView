const { sequelize, DataTypes } = require('../db');

const AwbOci = sequelize.define('AwbOci', {
  awbId: { type: DataTypes.INTEGER, allowNull: false },
  awbType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MAWB' },
  countryCode: { type: DataTypes.STRING, allowNull: true },
  infoId: { type: DataTypes.STRING, allowNull: true },
  customsId: { type: DataTypes.STRING, allowNull: true },
  suppInfo: { type: DataTypes.STRING, allowNull: true }
});

module.exports = AwbOci;
