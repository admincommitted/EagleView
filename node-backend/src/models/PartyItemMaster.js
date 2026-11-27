import { sequelize, DataTypes } from '../config/database.js';

const PartyItemMaster = sequelize.define('PartyItemMaster', {
  partyId: { type: DataTypes.INTEGER, allowNull: false },
  ruleType: { type: DataTypes.STRING, defaultValue: 'BOTH' },
  partNumber: { type: DataTypes.STRING, allowNull: false },
  customsDescription: { type: DataTypes.STRING, allowNull: false },
  ritc: { type: DataTypes.STRING },
  uqc: { type: DataTypes.STRING },
  unitPrice: { type: DataTypes.DECIMAL(15, 4) },
});

export default PartyItemMaster;
