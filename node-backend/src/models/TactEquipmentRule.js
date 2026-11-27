import { sequelize, DataTypes } from '../config/database.js';

const TactEquipmentRule = sequelize.define('TactEquipmentRule', {
  aircraftType: { type: DataTypes.STRING(50), allowNull: false },
  iataCode: { type: DataTypes.STRING(10), allowNull: true },
  manufacturer: { type: DataTypes.STRING(50), allowNull: true },
  bodyType: { type: DataTypes.STRING(50), defaultValue: 'Narrow Body' },
  deckType: { type: DataTypes.STRING(50), defaultValue: 'Lower Deck' },
  doorSize: { type: DataTypes.STRING(50), allowNull: true },
  maxLengthCm: { type: DataTypes.FLOAT, allowNull: false },
  maxWidthCm: { type: DataTypes.FLOAT, allowNull: false },
  maxHeightCm: { type: DataTypes.FLOAT, allowNull: false },
  maxKgsPerPiece: { type: DataTypes.FLOAT, allowNull: false },
  maxPayloadTons: { type: DataTypes.FLOAT, allowNull: true },
  maxVolumeCbm: { type: DataTypes.FLOAT, allowNull: true },
  compatibleUlds: { type: DataTypes.STRING(200), allowNull: true },
  maxRangeKm: { type: DataTypes.FLOAT, allowNull: true },
  co2EmissionIndex: { type: DataTypes.FLOAT, allowNull: true },
});

export default TactEquipmentRule;
