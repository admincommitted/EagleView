const { sequelize } = require('./db');
const TactEquipmentRule = require('./models/TactEquipmentRule');

const allCommercialCargo = [
  // --- FREIGHTERS ---
  { aircraftType: '747-8F', iataCode: '747', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Main & Lower', doorSize: '120x134 in', maxLengthCm: 605, maxWidthCm: 244, maxHeightCm: 300, maxKgsPerPiece: 28000, maxPayloadTons: 137.7, maxVolumeCbm: 853, compatibleUlds: 'Q7, PMC, PAG, AKE, ALF, AMA, AMD, ULD' },
  { aircraftType: '747-400F', iataCode: '74F', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Main & Lower', doorSize: '120x134 in', maxLengthCm: 605, maxWidthCm: 244, maxHeightCm: 300, maxKgsPerPiece: 28000, maxPayloadTons: 112.6, maxVolumeCbm: 710, compatibleUlds: 'PMC, PAG, AKE, ALF, AMA, AMD' },
  { aircraftType: '777F', iataCode: '77X', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Main & Lower', doorSize: '146x122 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 300, maxKgsPerPiece: 14000, maxPayloadTons: 102.8, maxVolumeCbm: 653, compatibleUlds: 'PMC, PAG, AKE, ALF, AMA' },
  { aircraftType: '767-300F', iataCode: '76F', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Main & Lower', doorSize: '134x105 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 240, maxKgsPerPiece: 6000, maxPayloadTons: 52.7, maxVolumeCbm: 438, compatibleUlds: 'PMC, PAG, AKE, APE' },
  { aircraftType: '757-200F', iataCode: '75F', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Main & Lower', doorSize: '134x86 in', maxLengthCm: 318, maxWidthCm: 220, maxHeightCm: 200, maxKgsPerPiece: 3500, maxPayloadTons: 32.0, maxVolumeCbm: 239, compatibleUlds: 'PMC, PAG, AYY' },
  { aircraftType: '737-800BCF', iataCode: '73F', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Main & Lower', doorSize: '134x86 in', maxLengthCm: 318, maxWidthCm: 220, maxHeightCm: 200, maxKgsPerPiece: 3000, maxPayloadTons: 23.9, maxVolumeCbm: 141, compatibleUlds: 'PMC, PAG, AYY' },
  { aircraftType: '737-400F', iataCode: '734', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Main & Lower', doorSize: '134x86 in', maxLengthCm: 318, maxWidthCm: 220, maxHeightCm: 200, maxKgsPerPiece: 2500, maxPayloadTons: 21.0, maxVolumeCbm: 130, compatibleUlds: 'PMC, PAG, AYY' },
  { aircraftType: 'A330-200F', iataCode: '33X', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Main & Lower', doorSize: '141x101 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 244, maxKgsPerPiece: 7500, maxPayloadTons: 70.0, maxVolumeCbm: 475, compatibleUlds: 'PMC, PAG, AKE, ALF, AMA' },
  { aircraftType: 'A300-600F', iataCode: 'ABY', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Main & Lower', doorSize: '141x101 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 244, maxKgsPerPiece: 6000, maxPayloadTons: 48.0, maxVolumeCbm: 391, compatibleUlds: 'PMC, PAG, AKE' },
  { aircraftType: 'A321P2F', iataCode: '321', manufacturer: 'Airbus', bodyType: 'Narrow Body', deckType: 'Main & Lower', doorSize: '141x81 in', maxLengthCm: 318, maxWidthCm: 220, maxHeightCm: 200, maxKgsPerPiece: 3000, maxPayloadTons: 27.0, maxVolumeCbm: 208, compatibleUlds: 'PMC, PAG, AKH' },
  { aircraftType: 'MD-11F', iataCode: 'M1F', manufacturer: 'McDonnell Douglas', bodyType: 'Wide Body', deckType: 'Main & Lower', doorSize: '140x102 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 244, maxKgsPerPiece: 10000, maxPayloadTons: 92.0, maxVolumeCbm: 597, compatibleUlds: 'PMC, PAG, AKE, ALF' },
  { aircraftType: 'AN-124', iataCode: 'A4F', manufacturer: 'Antonov', bodyType: 'Heavy Freighter', deckType: 'Main Deck', doorSize: '252x173 in', maxLengthCm: 3650, maxWidthCm: 640, maxHeightCm: 440, maxKgsPerPiece: 120000, maxPayloadTons: 150.0, maxVolumeCbm: 1040, compatibleUlds: 'Out of Gauge, Special' },
  
  // --- PASSENGER WIDEBODY (Belly Cargo) ---
  { aircraftType: '777-300ER', iataCode: '77W', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x67 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500, maxPayloadTons: 24.5, maxVolumeCbm: 200, compatibleUlds: 'PMC, PAG, AKE, ALF' },
  { aircraftType: '777-200LR', iataCode: '77L', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x67 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500, maxPayloadTons: 20.0, maxVolumeCbm: 160, compatibleUlds: 'PMC, PAG, AKE, ALF' },
  { aircraftType: '787-9', iataCode: '789', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x67 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4200, maxPayloadTons: 22.0, maxVolumeCbm: 172, compatibleUlds: 'PMC, PAG, AKE, ALF' },
  { aircraftType: '787-8', iataCode: '788', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x67 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4000, maxPayloadTons: 16.2, maxVolumeCbm: 136, compatibleUlds: 'PMC, PAG, AKE' },
  { aircraftType: '787-10', iataCode: '781', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x67 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500, maxPayloadTons: 25.0, maxVolumeCbm: 193, compatibleUlds: 'PMC, PAG, AKE, ALF' },
  { aircraftType: 'A350-900', iataCode: '359', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '96x64 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 162, maxKgsPerPiece: 4500, maxPayloadTons: 20.0, maxVolumeCbm: 172, compatibleUlds: 'LD3 (AKE), LD6 (ALF), PMC' },
  { aircraftType: 'A350-1000', iataCode: '351', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '96x64 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 162, maxKgsPerPiece: 4500, maxPayloadTons: 25.0, maxVolumeCbm: 208, compatibleUlds: 'LD3 (AKE), LD6 (ALF), PMC' },
  { aircraftType: 'A380-800', iataCode: '388', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '96x64 in', maxLengthCm: 153, maxWidthCm: 153, maxHeightCm: 162, maxKgsPerPiece: 4500, maxPayloadTons: 18.0, maxVolumeCbm: 175, compatibleUlds: 'LD3 (AKE) ONLY' },
  { aircraftType: 'A330-300', iataCode: '333', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x66 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500, maxPayloadTons: 21.0, maxVolumeCbm: 162, compatibleUlds: 'PMC, PAG, AKE' },
  { aircraftType: 'A330-200', iataCode: '332', manufacturer: 'Airbus', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x66 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500, maxPayloadTons: 17.5, maxVolumeCbm: 132, compatibleUlds: 'PMC, PAG, AKE' },
  { aircraftType: '747-400Pax', iataCode: '744', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '106x66 in', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500, maxPayloadTons: 15.0, maxVolumeCbm: 158, compatibleUlds: 'PMC, PAG, AKE, LD1' },
  { aircraftType: '767-300ER', iataCode: '763', manufacturer: 'Boeing', bodyType: 'Wide Body', deckType: 'Lower Deck', doorSize: '70x70 in', maxLengthCm: 160, maxWidthCm: 150, maxHeightCm: 160, maxKgsPerPiece: 2500, maxPayloadTons: 14.5, maxVolumeCbm: 114, compatibleUlds: 'LD2, LD3' },

  // --- PASSENGER NARROWBODY (Belly Cargo) ---
  { aircraftType: 'A320NEO', iataCode: '32N', manufacturer: 'Airbus', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '49x47 in', maxLengthCm: 120, maxWidthCm: 110, maxHeightCm: 110, maxKgsPerPiece: 150, maxPayloadTons: 2.5, maxVolumeCbm: 37, compatibleUlds: 'LD3-45 (AKH), Bulk' },
  { aircraftType: 'A321NEO', iataCode: '32Q', manufacturer: 'Airbus', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '49x47 in', maxLengthCm: 120, maxWidthCm: 110, maxHeightCm: 110, maxKgsPerPiece: 150, maxPayloadTons: 3.5, maxVolumeCbm: 51, compatibleUlds: 'LD3-45 (AKH), Bulk' },
  { aircraftType: 'A319', iataCode: '319', manufacturer: 'Airbus', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '49x47 in', maxLengthCm: 120, maxWidthCm: 110, maxHeightCm: 110, maxKgsPerPiece: 150, maxPayloadTons: 2.3, maxVolumeCbm: 27, compatibleUlds: 'LD3-45 (AKH), Bulk' },
  { aircraftType: '737 MAX 8', iataCode: '7M8', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '48x35 in', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150, maxPayloadTons: 5.0, maxVolumeCbm: 43, compatibleUlds: 'Bulk Only' },
  { aircraftType: '737 MAX 9', iataCode: '7M9', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '48x35 in', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150, maxPayloadTons: 5.5, maxVolumeCbm: 51, compatibleUlds: 'Bulk Only' },
  { aircraftType: '737-800', iataCode: '738', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '48x35 in', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150, maxPayloadTons: 4.5, maxVolumeCbm: 44, compatibleUlds: 'Bulk Only' },
  { aircraftType: '757-200Pax', iataCode: '752', manufacturer: 'Boeing', bodyType: 'Narrow Body', deckType: 'Lower Deck', doorSize: '55x44 in', maxLengthCm: 130, maxWidthCm: 100, maxHeightCm: 100, maxKgsPerPiece: 200, maxPayloadTons: 6.5, maxVolumeCbm: 47, compatibleUlds: 'Bulk Only' },

  // --- REGIONAL (Commercial Cargo) ---
  { aircraftType: 'ATR 72-600F', iataCode: 'AT7', manufacturer: 'ATR', bodyType: 'Turboprop', deckType: 'Main Deck', doorSize: '115x71 in', maxLengthCm: 150, maxWidthCm: 150, maxHeightCm: 150, maxKgsPerPiece: 1000, maxPayloadTons: 8.9, maxVolumeCbm: 75, compatibleUlds: 'Bulk, LD3' },
  { aircraftType: 'Embraer E190', iataCode: 'E90', manufacturer: 'Embraer', bodyType: 'Regional', deckType: 'Lower Deck', doorSize: '40x31 in', maxLengthCm: 80, maxWidthCm: 70, maxHeightCm: 70, maxKgsPerPiece: 80, maxPayloadTons: 1.4, maxVolumeCbm: 24, compatibleUlds: 'Bulk Only' },
  { aircraftType: 'CRJ-900', iataCode: 'CR9', manufacturer: 'Bombardier', bodyType: 'Regional', deckType: 'Lower Deck', doorSize: '33x43 in', maxLengthCm: 70, maxWidthCm: 60, maxHeightCm: 60, maxKgsPerPiece: 40, maxPayloadTons: 1.0, maxVolumeCbm: 17, compatibleUlds: 'Bulk Only' },
];

async function seed() {
  try {
    await sequelize.authenticate();
    await TactEquipmentRule.destroy({ where: {} });
    await TactEquipmentRule.bulkCreate(allCommercialCargo);
    const count = await TactEquipmentRule.count();
    console.log(`Successfully added ${count} detailed commercial cargo aircraft with payloads!`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
