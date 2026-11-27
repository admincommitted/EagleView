import { sequelize, DataTypes } from '../config/database.js';

const JobSequence = sequelize.define(
  'JobSequence',
  {
    branchCode: { type: DataTypes.STRING, allowNull: false },
    jobMode: { type: DataTypes.STRING, allowNull: false },
    prefix: { type: DataTypes.STRING },
    startNumber: { type: DataTypes.INTEGER, defaultValue: 1001 },
    financialYearId: { type: DataTypes.INTEGER },
  },
  {
    indexes: [{ unique: true, fields: ['branchCode', 'jobMode', 'financialYearId'] }],
  },
);

export default JobSequence;
