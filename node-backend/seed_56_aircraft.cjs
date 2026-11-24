const { sequelize } = require('./db');
const TactEquipmentRule = require('./models/TactEquipmentRule');

const moreEquipment = [
  // Additional Airbus
  { aircraftType: 'A220-100', iataCode: '221', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 1.5, maxVolumeCbm: 23, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 100 },
  { aircraftType: 'A220-300', iataCode: '223', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 2.0, maxVolumeCbm: 31, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 100 },
  { aircraftType: 'A318-100', iataCode: '318', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 2.0, maxVolumeCbm: 21, compatibleUlds: 'AKH, Bulk', doorSize: '124 x 119', maxLengthCm: 120, maxWidthCm: 110, maxHeightCm: 110, maxKgsPerPiece: 150 },
  { aircraftType: 'A319-100', iataCode: '319', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 2.3, maxVolumeCbm: 27, compatibleUlds: 'AKH, Bulk', doorSize: '124 x 119', maxLengthCm: 120, maxWidthCm: 110, maxHeightCm: 110, maxKgsPerPiece: 150 },
  { aircraftType: 'A330-800neo', iataCode: '338', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 16.5, maxVolumeCbm: 136, compatibleUlds: 'LD3, PMC', doorSize: '273 x 168', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  { aircraftType: 'A330-900neo', iataCode: '339', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 20.0, maxVolumeCbm: 162, compatibleUlds: 'LD3, PMC', doorSize: '273 x 168', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  
  // Additional Boeing
  { aircraftType: '717-200', iataCode: '717', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 1.2, maxVolumeCbm: 20, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 100 },
  { aircraftType: '737-700', iataCode: '73G', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 3.5, maxVolumeCbm: 27, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150 },
  { aircraftType: '737-900', iataCode: '739', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 5.2, maxVolumeCbm: 51, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150 },
  { aircraftType: '737 MAX 9', iataCode: '7M9', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 5.5, maxVolumeCbm: 51, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150 },
  { aircraftType: '737 MAX 10', iataCode: '7MJ', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 6.0, maxVolumeCbm: 56, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150 },
  { aircraftType: '757-200', iataCode: '752', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 6.5, maxVolumeCbm: 47, compatibleUlds: 'Bulk Only', doorSize: '140 x 112', maxLengthCm: 130, maxWidthCm: 100, maxHeightCm: 100, maxKgsPerPiece: 200 },
  { aircraftType: '757-300', iataCode: '753', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 8.0, maxVolumeCbm: 67, compatibleUlds: 'Bulk Only', doorSize: '140 x 112', maxLengthCm: 130, maxWidthCm: 100, maxHeightCm: 100, maxKgsPerPiece: 200 },
  { aircraftType: '767-300', iataCode: '763', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 14.5, maxVolumeCbm: 114, compatibleUlds: 'LD3, LD2', doorSize: '175 x 175', maxLengthCm: 160, maxWidthCm: 150, maxHeightCm: 160, maxKgsPerPiece: 2500 },
  { aircraftType: '767-400', iataCode: '764', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 16.0, maxVolumeCbm: 129, compatibleUlds: 'LD3, LD2', doorSize: '175 x 175', maxLengthCm: 160, maxWidthCm: 150, maxHeightCm: 160, maxKgsPerPiece: 2500 },
  { aircraftType: '777-200LR', iataCode: '77L', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 20.0, maxVolumeCbm: 160, compatibleUlds: 'LD3, PMC', doorSize: '269 x 170', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  { aircraftType: '787-10 Dreamliner', iataCode: '781', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 25.0, maxVolumeCbm: 193, compatibleUlds: 'LD3, PMC', doorSize: '269 x 170', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  
  // Embraer
  { aircraftType: 'Embraer E170', iataCode: 'E70', bodyType: 'Regional Pax', deckType: 'Lower Deck', manufacturer: 'Embraer', maxPayloadTons: 1.0, maxVolumeCbm: 15, compatibleUlds: 'Bulk Only', doorSize: '100 x 80', maxLengthCm: 80, maxWidthCm: 70, maxHeightCm: 70, maxKgsPerPiece: 50 },
  { aircraftType: 'Embraer E175', iataCode: 'E75', bodyType: 'Regional Pax', deckType: 'Lower Deck', manufacturer: 'Embraer', maxPayloadTons: 1.1, maxVolumeCbm: 18, compatibleUlds: 'Bulk Only', doorSize: '100 x 80', maxLengthCm: 80, maxWidthCm: 70, maxHeightCm: 70, maxKgsPerPiece: 50 },
  { aircraftType: 'Embraer E190', iataCode: 'E90', bodyType: 'Regional Pax', deckType: 'Lower Deck', manufacturer: 'Embraer', maxPayloadTons: 1.4, maxVolumeCbm: 24, compatibleUlds: 'Bulk Only', doorSize: '100 x 80', maxLengthCm: 80, maxWidthCm: 70, maxHeightCm: 70, maxKgsPerPiece: 80 },
  { aircraftType: 'Embraer E195', iataCode: 'E95', bodyType: 'Regional Pax', deckType: 'Lower Deck', manufacturer: 'Embraer', maxPayloadTons: 1.6, maxVolumeCbm: 27, compatibleUlds: 'Bulk Only', doorSize: '100 x 80', maxLengthCm: 80, maxWidthCm: 70, maxHeightCm: 70, maxKgsPerPiece: 80 },
  
  // Bombardier
  { aircraftType: 'CRJ-700', iataCode: 'CR7', bodyType: 'Regional Pax', deckType: 'Lower Deck', manufacturer: 'Bombardier', maxPayloadTons: 0.8, maxVolumeCbm: 15, compatibleUlds: 'Bulk Only', doorSize: '84 x 109', maxLengthCm: 70, maxWidthCm: 60, maxHeightCm: 60, maxKgsPerPiece: 40 },
  { aircraftType: 'CRJ-900', iataCode: 'CR9', bodyType: 'Regional Pax', deckType: 'Lower Deck', manufacturer: 'Bombardier', maxPayloadTons: 1.0, maxVolumeCbm: 17, compatibleUlds: 'Bulk Only', doorSize: '84 x 109', maxLengthCm: 70, maxWidthCm: 60, maxHeightCm: 60, maxKgsPerPiece: 40 },
  { aircraftType: 'CRJ-1000', iataCode: 'CRK', bodyType: 'Regional Pax', deckType: 'Lower Deck', manufacturer: 'Bombardier', maxPayloadTons: 1.2, maxVolumeCbm: 19, compatibleUlds: 'Bulk Only', doorSize: '84 x 109', maxLengthCm: 70, maxWidthCm: 60, maxHeightCm: 60, maxKgsPerPiece: 40 }
];

async function seed() {
  try {
    await sequelize.authenticate();
    await TactEquipmentRule.bulkCreate(moreEquipment, { ignoreDuplicates: true });
    const count = await TactEquipmentRule.count();
    console.log(`Successfully added 24 more aircraft! Total count is now: ${count}`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
