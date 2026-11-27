import { sequelize, DataTypes } from '../config/database.js';

const SpecialHandlingCode = sequelize.define('SpecialHandlingCode', {
  awbId: { type: DataTypes.INTEGER, allowNull: false },
  awbType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MAWB' },
  code: { type: DataTypes.STRING, allowNull: false },
});

export default SpecialHandlingCode;
