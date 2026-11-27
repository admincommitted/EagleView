import { sequelize, DataTypes } from '../config/database.js';

const Rodtep = sequelize.define('Rodtep', {
  tariffItem: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  rate: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  cap: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  uqc: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  // rate / cap above = Appendix 4R (DTA exports). Appendix 4RE (exports under Advance Authorisation,
  // EOU, SEZ) has its own lower rates. rsPerUqc: entries notified as Rs per UQC instead of % of FOB (logs, wood).
  rateAA: { type: DataTypes.FLOAT, allowNull: true },
  capAA: { type: DataTypes.FLOAT, allowNull: true },
  rsPerUqc: { type: DataTypes.FLOAT, allowNull: true },
  rsPerUqcAA: { type: DataTypes.FLOAT, allowNull: true },
});

export default Rodtep;
