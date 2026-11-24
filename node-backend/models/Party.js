const { sequelize, DataTypes } = require('../db');

const Party = sequelize.define('Party', {
  partyType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MULTI' },
  isShipper: { type: DataTypes.BOOLEAN, defaultValue: false },
  isConsignee: { type: DataTypes.BOOLEAN, defaultValue: false },
  isNotifyParty: { type: DataTypes.BOOLEAN, defaultValue: false },
  isBuyer: { type: DataTypes.BOOLEAN, defaultValue: false },
  isSubAgent: { type: DataTypes.BOOLEAN, defaultValue: false },
  isOverseasAgent: { type: DataTypes.BOOLEAN, defaultValue: false },
  // 04-Nov-2026: party types from iCAFFE (columns added by load_icaffe_parties_to_party_master.js)
  isShipline: { type: DataTypes.BOOLEAN, defaultValue: false },
  isIataAgent: { type: DataTypes.BOOLEAN, defaultValue: false },
  isBank: { type: DataTypes.BOOLEAN, defaultValue: false },
  code: { type: DataTypes.STRING, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  street: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  stateProvince: { type: DataTypes.STRING },
  zipPostcode: { type: DataTypes.STRING },
  countryCode: { type: DataTypes.STRING },
  phoneNumber: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  taxId: { type: DataTypes.STRING },
  
  // New Unified Master Fields
  extendedName: { type: DataTypes.STRING },
  mercManuf: { type: DataTypes.STRING },
  rbiNumber: { type: DataTypes.STRING },
  marketingPerson1: { type: DataTypes.STRING },
  marketingPerson2: { type: DataTypes.STRING },
  marketingPerson3: { type: DataTypes.STRING },
  sezWarehouseCode: { type: DataTypes.STRING },
  remarks: { type: DataTypes.STRING },
  aiExtractionRules: { type: DataTypes.TEXT },
  aiImportRules: { type: DataTypes.TEXT },
  aiExportRules: { type: DataTypes.TEXT },
  iecNoReqd: { type: DataTypes.BOOLEAN, defaultValue: false },
  classType: { type: DataTypes.STRING },
  panNumber: { type: DataTypes.STRING },
  paymentDeferred: { type: DataTypes.BOOLEAN, defaultValue: false },
  blackList: { type: DataTypes.BOOLEAN, defaultValue: false },
  insuranceRate: { type: DataTypes.STRING },
  kycApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
  kycStatus: { type: DataTypes.STRING, defaultValue: 'PENDING' },
  kycLastSentAt: { type: DataTypes.DATE }
});

module.exports = Party;
