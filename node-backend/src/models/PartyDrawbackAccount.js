import { sequelize, DataTypes } from '../config/database.js';

const PartyDrawbackAccount = sequelize.define('PartyDrawbackAccount', {
  partyId: { type: DataTypes.INTEGER, allowNull: false },
  adCode: { type: DataTypes.STRING },
  bankName: { type: DataTypes.STRING },
  ifscCode: { type: DataTypes.STRING },
  accountNo: { type: DataTypes.STRING },
  bankAddress: { type: DataTypes.STRING },
});

export default PartyDrawbackAccount;
