import { sequelize, DataTypes } from '../config/database.js';

const PartyBranch = sequelize.define('PartyBranch', {
  partyId: { type: DataTypes.INTEGER, allowNull: false },
  branchSrNo: { type: DataTypes.STRING },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  branchName: { type: DataTypes.STRING, defaultValue: 'DEFAULT' },
  contactPerson: { type: DataTypes.STRING },
  address1: { type: DataTypes.STRING },
  address2: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  state: { type: DataTypes.STRING },
  country: { type: DataTypes.STRING },
  pinCode: { type: DataTypes.STRING },
  ctxType: { type: DataTypes.STRING },
  ctxState: { type: DataTypes.STRING },
  regNo: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  mobile: { type: DataTypes.STRING },
  fax: { type: DataTypes.STRING },
  email1: { type: DataTypes.STRING },
  email2: { type: DataTypes.STRING },
  website: { type: DataTypes.STRING },
  tanNo: { type: DataTypes.STRING },
  unlocCity: { type: DataTypes.STRING },
  disabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  sez: { type: DataTypes.BOOLEAN, defaultValue: false },
  gstExempted: { type: DataTypes.BOOLEAN, defaultValue: false },
  sezWarehouseCode: { type: DataTypes.STRING },
  gstin: { type: DataTypes.STRING }, // Keeping for backward compatibility
});

export default PartyBranch;
