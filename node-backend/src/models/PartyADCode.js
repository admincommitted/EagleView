import { sequelize, DataTypes } from '../config/database.js';

const PartyADCode = sequelize.define('PartyADCode', {
  partyId: { type: DataTypes.INTEGER, allowNull: false },
  adCode: { type: DataTypes.STRING },
  bankName: { type: DataTypes.STRING },
  serialNo: { type: DataTypes.STRING },
  branchAddress: { type: DataTypes.STRING },
  forexCode: { type: DataTypes.STRING },
  bankAddress: { type: DataTypes.STRING },
  loadingPort: { type: DataTypes.STRING },
});

export default PartyADCode;
