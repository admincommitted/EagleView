import { sequelize, DataTypes } from '../config/database.js';

const Drawback = sequelize.define('Drawback', {
  tariffItem: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  description: { type: DataTypes.STRING, allowNull: false },
  schemeDescription: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  schemeCode: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  drawbackRate: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  drawbackRateSpec: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  drawbackCap: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  drawbackFlag: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  uqc: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

export default Drawback;
