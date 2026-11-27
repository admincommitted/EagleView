import { sequelize, DataTypes } from '../config/database.js';

const TactRateDetail = sequelize.define('TactRateDetail', {
  sectorId: { type: DataTypes.INTEGER, allowNull: false },
  rateClassCode: { type: DataTypes.STRING(2), allowNull: false }, // M, N, Q, C, S, R
  weightBreak: { type: DataTypes.FLOAT, defaultValue: 0 },
  commodityItemNo: { type: DataTypes.STRING(10), allowNull: true },
  rateAmount: { type: DataTypes.FLOAT, allowNull: false },
  percentageMultiplier: { type: DataTypes.FLOAT, allowNull: true }, // e.g. 150 for 150%
});

export default TactRateDetail;
