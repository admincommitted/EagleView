import { sequelize, DataTypes } from '../config/database.js';

const AwbOci = sequelize.define('AwbOci', {
  awbId: { type: DataTypes.INTEGER, allowNull: false },
  awbType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MAWB' },
  countryCode: { type: DataTypes.STRING, allowNull: true },
  infoId: { type: DataTypes.STRING, allowNull: true },
  customsId: { type: DataTypes.STRING, allowNull: true },
  suppInfo: { type: DataTypes.STRING, allowNull: true },
});

export default AwbOci;
