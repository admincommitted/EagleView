const { sequelize } = require('./db');
const TactEquipmentRule = require('./models/TactEquipmentRule');

const commercialCargoAircraft = [
  // FREIGHTERS (Pure Cargo)
  { aircraftType: '747-8F', iataCode: '747', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Main & Lower Deck', doorSize: '120x134 in (Main)', maxLengthCm: 605, maxWidthCm: 244, maxHeightCm: 300, maxKgsPerPiece: 28000, maxPayloadTons: 137.7, maxVolumeCbm: 853, compatibleUlds: 'Q7, PMC, PAG, AKE, ALF, AMA, AMD, ULD' },
  { aircraftType: '777F', iataCode: '77F', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Main & Lower Deck', doorSize: '146x122 in (Main)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 300, maxKgsPerPiece: 14000, maxPayloadTons: 102.8, maxVolumeCbm: 653, compatibleUlds: 'PMC, PAG, AKE, ALF, AMA' },
  { aircraftType: 'A330-200F', iataCode: '33X', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Main & Lower Deck', doorSize: '141x101 in (Main)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 244, maxKgsPerPiece: 7500, maxPayloadTons: 70.0, maxVolumeCbm: 475, compatibleUlds: 'PMC, PAG, AKE, ALF' },
  { aircraftType: '767-300F', iataCode: '76F', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Main & Lower Deck', doorSize: '340 x 266', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 240, maxKgsPerPiece: 6000, maxPayloadTons: 52.7, maxVolumeCbm: 438, compatibleUlds: 'PMC, AKE' },
  { aircraftType: 'MD-11F', iataCode: 'M1F', manufacturer: 'McDonnell Douglas', bodyType: 'Wide Body', deckType: 'Main & Lower Deck', doorSize: '355 x 259', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 244, maxKgsPerPiece: 10000, maxPayloadTons: 92.0, maxVolumeCbm: 597, compatibleUlds: 'PMC, PGA' },
  { aircraftType: '737-800BCF', iataCode: '73F', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Main & Lower Deck', doorSize: '346 x 213', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 208, maxKgsPerPiece: 3000, maxPayloadTons: 23.9, maxVolumeCbm: 141, compatibleUlds: 'PMC, AYY' },

  // PASSENGER WIDEBODY (Belly Cargo)
  { aircraftType: '777-300ER', iataCode: '77W', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x67 in (Lower)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500, maxPayloadTons: 24.5, maxVolumeCbm: 200, compatibleUlds: 'PMC, PAG, AKE, ALF' },
  { aircraftType: '787-9', iataCode: '789', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x67 in (Lower)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4200, maxPayloadTons: 22.0, maxVolumeCbm: 140, compatibleUlds: 'PMC, PAG, AKE, ALF' },
  { aircraftType: 'A350-900', iataCode: '359', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '96x64 in (Lower)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 162, maxKgsPerPiece: 4500, maxPayloadTons: 20.0, maxVolumeCbm: 150, compatibleUlds: 'LD3 (AKE), LD6 (ALF), PMC (up to 11)' },
  { aircraftType: 'A380-800', iataCode: '388', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '96x64 in (Lower)', maxLengthCm: 153, maxWidthCm: 153, maxHeightCm: 162, maxKgsPerPiece: 4500, maxPayloadTons: 18.0, maxVolumeCbm: 175, compatibleUlds: 'LD3 (AKE) ONLY' },
  { aircraftType: 'A330-300', iataCode: '333', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x66 in (Lower)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500, maxPayloadTons: 21.0, maxVolumeCbm: 162, compatibleUlds: 'LD3, PMC, AKE' },

  // PASSENGER NARROWBODY (Belly Cargo)
  { aircraftType: 'A320NEO', iataCode: '32N', manufacturer: 'Airbus', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '124x119 in (Lower)', maxLengthCm: 120, maxWidthCm: 110, maxHeightCm: 110, maxKgsPerPiece: 150, maxPayloadTons: 2.5, maxVolumeCbm: 37, compatibleUlds: 'LD3-45 (AKH), Bulk' },
  { aircraftType: '737 MAX 8', iataCode: '7M8', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '122 x 89 in', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150, maxPayloadTons: 5.0, maxVolumeCbm: 43, compatibleUlds: 'Bulk Only' }
];

async function seed() {
  try {
    await sequelize.authenticate();
    await TactEquipmentRule.destroy({ where: {} }); // Wipe the bad CSV upload
    await TactEquipmentRule.bulkCreate(commercialCargoAircraft);
    console.log(`Successfully restored ${commercialCargoAircraft.length} correct commercial cargo flights with Payload!`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
