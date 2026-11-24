const { sequelize } = require('./db');
const TactEquipmentRule = require('./models/TactEquipmentRule');

const moreEquipment = [
  // BOEING PASSENGER
  { aircraftType: '737-800', iataCode: '738', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 4.5, maxVolumeCbm: 44, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150 },
  { aircraftType: '737 MAX 8', iataCode: '7M8', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 5.0, maxVolumeCbm: 43, compatibleUlds: 'Bulk Only', doorSize: '122 x 89', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 150 },
  { aircraftType: '777-200ER', iataCode: '772', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 20.5, maxVolumeCbm: 160, compatibleUlds: 'LD3, LD6, PMC', doorSize: '269 x 170', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  { aircraftType: '777-300ER', iataCode: '77W', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 24.5, maxVolumeCbm: 200, compatibleUlds: 'LD3, LD6, PMC, AKE', doorSize: '269 x 170', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  { aircraftType: '787-8 Dreamliner', iataCode: '788', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 16.2, maxVolumeCbm: 136, compatibleUlds: 'LD3, PMC', doorSize: '269 x 170', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4000 },
  { aircraftType: '787-9 Dreamliner', iataCode: '789', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 22.0, maxVolumeCbm: 172, compatibleUlds: 'LD3, PMC', doorSize: '269 x 170', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4200 },
  { aircraftType: '747-400', iataCode: '744', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 15.0, maxVolumeCbm: 158, compatibleUlds: 'LD3, PMC, LD1', doorSize: '264 x 168', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  
  // AIRBUS PASSENGER
  { aircraftType: 'A320-200', iataCode: '320', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 2.5, maxVolumeCbm: 37, compatibleUlds: 'AKH, Bulk', doorSize: '124 x 119', maxLengthCm: 120, maxWidthCm: 110, maxHeightCm: 110, maxKgsPerPiece: 150 },
  { aircraftType: 'A321-200', iataCode: '321', bodyType: 'Narrow-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 3.5, maxVolumeCbm: 51, compatibleUlds: 'AKH, Bulk', doorSize: '124 x 119', maxLengthCm: 120, maxWidthCm: 110, maxHeightCm: 110, maxKgsPerPiece: 150 },
  { aircraftType: 'A330-200', iataCode: '332', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 17.5, maxVolumeCbm: 132, compatibleUlds: 'LD3, PMC, AKE', doorSize: '273 x 168', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  { aircraftType: 'A330-300', iataCode: '333', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 21.0, maxVolumeCbm: 162, compatibleUlds: 'LD3, PMC, AKE', doorSize: '273 x 168', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  { aircraftType: 'A350-900', iataCode: '359', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 20.0, maxVolumeCbm: 172, compatibleUlds: 'LD3, PMC', doorSize: '273 x 168', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  { aircraftType: 'A350-1000', iataCode: '351', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 25.0, maxVolumeCbm: 208, compatibleUlds: 'LD3, PMC', doorSize: '273 x 168', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },
  { aircraftType: 'A380-800', iataCode: '388', bodyType: 'Wide-Body Pax', deckType: 'Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 18.0, maxVolumeCbm: 175, compatibleUlds: 'LD3, PMC', doorSize: '273 x 168', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 160, maxKgsPerPiece: 4500 },

  // FREIGHTERS
  { aircraftType: '737-800BCF', iataCode: '73F', bodyType: 'Narrow-Body Freighter', deckType: 'Main & Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 23.9, maxVolumeCbm: 141, compatibleUlds: 'PMC, AYY', doorSize: '346 x 213', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 208, maxKgsPerPiece: 3000 },
  { aircraftType: '757-200PCF', iataCode: '75F', bodyType: 'Narrow-Body Freighter', deckType: 'Main & Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 32.0, maxVolumeCbm: 239, compatibleUlds: 'PMC, AYY', doorSize: '340 x 218', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 208, maxKgsPerPiece: 3500 },
  { aircraftType: '767-300F', iataCode: '76F', bodyType: 'Wide-Body Freighter', deckType: 'Main & Lower Deck', manufacturer: 'Boeing', maxPayloadTons: 52.7, maxVolumeCbm: 438, compatibleUlds: 'PMC, AKE', doorSize: '340 x 266', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 240, maxKgsPerPiece: 6000 },
  { aircraftType: 'A330-200F', iataCode: '33F', bodyType: 'Wide-Body Freighter', deckType: 'Main & Lower Deck', manufacturer: 'Airbus', maxPayloadTons: 70.0, maxVolumeCbm: 475, compatibleUlds: 'PMC, AMA', doorSize: '358 x 256', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 244, maxKgsPerPiece: 7500 },
  { aircraftType: 'MD-11F', iataCode: 'M1F', bodyType: 'Wide-Body Freighter', deckType: 'Main & Lower Deck', manufacturer: 'McDonnell Douglas', maxPayloadTons: 92.0, maxVolumeCbm: 597, compatibleUlds: 'PMC, PGA', doorSize: '355 x 259', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 244, maxKgsPerPiece: 10000 },
  { aircraftType: 'AN-124 Ruslan', iataCode: 'A4F', bodyType: 'Heavy Freighter', deckType: 'Main Deck', manufacturer: 'Antonov', maxPayloadTons: 150.0, maxVolumeCbm: 1040, compatibleUlds: 'Out of Gauge', doorSize: '640 x 440', maxLengthCm: 3650, maxWidthCm: 640, maxHeightCm: 440, maxKgsPerPiece: 120000 },
  
  // REGIONALS / TURBOPROPS
  { aircraftType: 'ATR 72-500', iataCode: 'AT7', bodyType: 'Turboprop Pax', deckType: 'Main Deck', manufacturer: 'ATR', maxPayloadTons: 1.5, maxVolumeCbm: 10, compatibleUlds: 'Bulk Only', doorSize: '127 x 153', maxLengthCm: 100, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 80 },
  { aircraftType: 'ATR 72-600F', iataCode: 'AT7F', bodyType: 'Turboprop Freighter', deckType: 'Main Deck', manufacturer: 'ATR', maxPayloadTons: 8.9, maxVolumeCbm: 75, compatibleUlds: 'Bulk, LD3', doorSize: '294 x 180', maxLengthCm: 150, maxWidthCm: 150, maxHeightCm: 150, maxKgsPerPiece: 1000 },
  { aircraftType: 'Q400', iataCode: 'DH4', bodyType: 'Turboprop Pax', deckType: 'Lower Deck', manufacturer: 'De Havilland', maxPayloadTons: 1.0, maxVolumeCbm: 14, compatibleUlds: 'Bulk Only', doorSize: '109 x 152', maxLengthCm: 80, maxWidthCm: 80, maxHeightCm: 80, maxKgsPerPiece: 50 },
];

async function seed() {
  try {
    await sequelize.authenticate();
    await TactEquipmentRule.bulkCreate(moreEquipment, { ignoreDuplicates: true });
    console.log(`Successfully added ${moreEquipment.length} more aircraft!`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
