const { sequelize } = require('./db');
const TactCarrierRule = require('./models/TactCarrierRule');

const carrierRules = [
  // Existing 16 were Emirates(EK), Qatar(QR), Etihad(EY), Lufthansa(LH), British Airways(BA), Cathay(CX), Singapore(SQ)
  // Let's add many more major carriers

  // North America
  { carrierCode: 'AA', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'American Airlines does not accept warm-blooded live animals on flights over 12 hours.', isBlocking: true },
  { carrierCode: 'AA', ruleCategory: 'RESTRICTION', shcCode: 'ELI', description: 'UN3480 Lithium Ion Batteries Sections IA & IB strictly prohibited as cargo on passenger aircraft.', isBlocking: true },
  { carrierCode: 'AA', ruleCategory: 'RESTRICTION', shcCode: 'VAL', description: 'Valuable cargo requires min 48h advance arrangement and armored transport at origin.', isBlocking: false },
  { carrierCode: 'DL', ruleCategory: 'RESTRICTION', shcCode: 'HUM', description: 'Delta requires known shipper status for Human Remains (HUM).', isBlocking: true },
  { carrierCode: 'DL', ruleCategory: 'RESTRICTION', shcCode: 'ICE', description: 'Dry Ice (ICE) limited to 200kg per aircraft on narrowbody fleet.', isBlocking: true },
  { carrierCode: 'UA', ruleCategory: 'RESTRICTION', shcCode: 'PER', description: 'United restricts perishables routing through EWR during winter embargoes (Dec-Feb).', isBlocking: true },
  { carrierCode: 'UA', ruleCategory: 'RESTRICTION', shcCode: 'WEA', description: 'Firearms and ammunition strictly embargoed on international transits.', isBlocking: true },
  { carrierCode: 'AC', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'Air Canada restricts AVI shipments when ground temperature exceeds 29.5C (85F).', isBlocking: true },

  // Europe
  { carrierCode: 'AF', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'Air France embargoes snub-nosed (brachycephalic) dogs and cats on all flights.', isBlocking: true },
  { carrierCode: 'AF', ruleCategory: 'RESTRICTION', shcCode: 'VAL', description: 'High-value shipments > 100,000 EUR require security escort at CDG hub.', isBlocking: false },
  { carrierCode: 'KL', ruleCategory: 'RESTRICTION', shcCode: 'DIP', description: 'KLM requires diplomatic mail to be handed over by embassy staff only.', isBlocking: true },
  { carrierCode: 'KL', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'Live birds embargoed on all KLM flights to/from avian flu restricted zones.', isBlocking: true },
  { carrierCode: 'TK', ruleCategory: 'RESTRICTION', shcCode: 'RRY', description: 'Turkish Airlines strictly prohibits Radioactive Material Category III.', isBlocking: true },
  { carrierCode: 'TK', ruleCategory: 'RESTRICTION', shcCode: 'HUM', description: 'Human remains transit via IST requires specific zinc-lined coffin.', isBlocking: true },
  { carrierCode: 'VS', ruleCategory: 'RESTRICTION', shcCode: 'ELI', description: 'Virgin Atlantic embargoes all bulk lithium battery shipments on pax flights.', isBlocking: true },
  { carrierCode: 'LX', ruleCategory: 'RESTRICTION', shcCode: 'PER', description: 'Swiss WorldCargo requires Envirotainer active cooling for all pharma (PIL).', isBlocking: false },

  // Middle East & Africa
  { carrierCode: 'SV', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'Saudia completely embargoes live pigs and pork products on all flights.', isBlocking: true },
  { carrierCode: 'SV', ruleCategory: 'RESTRICTION', shcCode: 'ALC', description: 'Alcohol shipments are strictly prohibited on all Saudia flights.', isBlocking: true },
  { carrierCode: 'WY', ruleCategory: 'RESTRICTION', shcCode: 'DGR', description: 'Oman Air limits DGR acceptance to MCT direct flights only.', isBlocking: true },
  { carrierCode: 'MS', ruleCategory: 'RESTRICTION', shcCode: 'VAL', description: 'EgyptAir limits VAL cargo to CAI hub connections under 4 hours.', isBlocking: true },
  { carrierCode: 'ET', ruleCategory: 'RESTRICTION', shcCode: 'PER', description: 'Ethiopian Airlines prioritizes fresh flowers; other PER may be bumped during peak season.', isBlocking: false },
  { carrierCode: 'KQ', ruleCategory: 'RESTRICTION', shcCode: 'HUM', description: 'Kenya Airways requires advance original death certificate for HUM acceptance.', isBlocking: true },
  { carrierCode: 'EK', ruleCategory: 'RESTRICTION', shcCode: 'ELI', description: 'Emirates SkyCargo embargoes UN3480 PI965 on all passenger aircraft.', isBlocking: true },

  // Asia Pacific
  { carrierCode: 'SQ', ruleCategory: 'RESTRICTION', shcCode: 'ICE', description: 'Singapore Airlines dry ice limit is 2.5kg per package for medical cargo.', isBlocking: true },
  { carrierCode: 'SQ', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'SQ embargoes live dogs to Australia due to strict quarantine rules.', isBlocking: true },
  { carrierCode: 'NH', ruleCategory: 'RESTRICTION', shcCode: 'VAL', description: 'ANA requires VAL cargo to be securely packed in sealed metal containers.', isBlocking: true },
  { carrierCode: 'NH', ruleCategory: 'RESTRICTION', shcCode: 'ELI', description: 'ANA prohibits hoverboards and balance boards containing lithium batteries.', isBlocking: true },
  { carrierCode: 'JL', ruleCategory: 'RESTRICTION', shcCode: 'PER', description: 'JAL requires dry ice for all frozen tuna shipments.', isBlocking: false },
  { carrierCode: 'KE', ruleCategory: 'RESTRICTION', shcCode: 'WEA', description: 'Korean Air strictly embargoes firearms on all flights transiting ICN.', isBlocking: true },
  { carrierCode: 'OZ', ruleCategory: 'RESTRICTION', shcCode: 'DIP', description: 'Asiana Airlines limits diplomatic pouches to 20kg max weight.', isBlocking: true },
  { carrierCode: 'CI', ruleCategory: 'RESTRICTION', shcCode: 'DGR', description: 'China Airlines embargoes Class 1 Explosives on all flights.', isBlocking: true },
  { carrierCode: 'BR', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'EVA Air prohibits transport of live primates for laboratory research.', isBlocking: true },
  { carrierCode: 'MH', ruleCategory: 'RESTRICTION', shcCode: 'HUM', description: 'Malaysia Airlines requires embalming certificate for HUM shipments.', isBlocking: true },
  { carrierCode: 'TG', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'Thai Airways embargoes fighting cocks and live poultry.', isBlocking: true },
  { carrierCode: 'AI', ruleCategory: 'RESTRICTION', shcCode: 'HUM', description: 'Air India strictly prohibits Human Remains on narrowbody flights due to door size.', isBlocking: true },
  { carrierCode: 'AI', ruleCategory: 'RESTRICTION', shcCode: 'VAL', description: 'Air India requires RBI (Reserve Bank) clearance for bullion exports.', isBlocking: true },
  
  // Oceania
  { carrierCode: 'QF', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'Qantas Freight requires AVI shipments to be lodged 3 hours prior to departure.', isBlocking: true },
  { carrierCode: 'QF', ruleCategory: 'RESTRICTION', shcCode: 'ICE', description: 'Qantas limits dry ice to 200kg total per widebody aircraft hold.', isBlocking: true },
  { carrierCode: 'NZ', ruleCategory: 'RESTRICTION', shcCode: 'PER', description: 'Air New Zealand requires pre-booking for all perishable seafood.', isBlocking: false },

  // LatAm
  { carrierCode: 'LA', ruleCategory: 'RESTRICTION', shcCode: 'VAL', description: 'LATAM Cargo requires armed guards at origin and destination for precious metals.', isBlocking: true },
  { carrierCode: 'AM', ruleCategory: 'RESTRICTION', shcCode: 'AVI', description: 'Aeromexico embargoes live animals when ground temp exceeds 30C.', isBlocking: true }
];

async function seed() {
  try {
    await sequelize.authenticate();
    await TactCarrierRule.bulkCreate(carrierRules, { ignoreDuplicates: true });
    const count = await TactCarrierRule.count();
    console.log(`Successfully added carrier embargoes! Total is now: ${count}`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
