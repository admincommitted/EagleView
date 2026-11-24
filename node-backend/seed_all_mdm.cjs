const { sequelize } = require('./db');
const TactCountryRule = require('./models/TactCountryRule');
const TactCarrierRule = require('./models/TactCarrierRule');
const TactEquipmentRule = require('./models/TactEquipmentRule');

const countryRules = [
  // US
  { countryCode: 'US', ruleType: 'IMPORT', category: 'DOCS', description: 'ACAS/AMS FILING MANDATORY BEFORE WHEELS UP. CBP REQUIRES PRECISE DESCRIPTIONS (NO "CONSOLIDATED CARGO").', isBlocking: true },
  { countryCode: 'US', ruleType: 'IMPORT', category: 'OCI', description: 'SCAC CODE AND FIRMS CODE REQUIRED FOR TRANSIT TO BONDED WAREHOUSES.', isBlocking: false },
  { countryCode: 'US', ruleType: 'IMPORT', category: 'RESTRICTION', description: 'LITHIUM BATTERIES (UN3480) STRICTLY PROHIBITED ON PASSENGER AIRCRAFT AS CARGO.', isBlocking: true },
  { countryCode: 'US', ruleType: 'IMPORT', category: 'RESTRICTION', description: 'KINDER SURPRISE EGGS PROHIBITED FROM IMPORT INTO THE US.', isBlocking: true },
  // EU (General)
  { countryCode: 'EU', ruleType: 'TRANSIT', category: 'OCI', description: 'ICS2 / ENS FILING MANDATORY. EORI NUMBER REQUIRED.', isBlocking: true },
  { countryCode: 'EU', ruleType: 'IMPORT', category: 'DOCS', description: 'PHYTOSANITARY CERTIFICATE MANDATORY FOR ALL PLANTS AND FRESH PRODUCE.', isBlocking: true },
  // GB
  { countryCode: 'GB', ruleType: 'IMPORT', category: 'DOCS', description: 'UK GVMS AND EORI NUMBERS REQUIRED FOR ALL COMMERCIAL IMPORTS POST-BREXIT.', isBlocking: true },
  // CN
  { countryCode: 'CN', ruleType: 'IMPORT', category: 'OCI', description: 'CCAM (CHINA CUSTOMS ADVANCE MANIFEST) REQUIRED 24H PRIOR. CONSIGNEE USCI NUMBER MANDATORY.', isBlocking: true },
  { countryCode: 'CN', ruleType: 'IMPORT', category: 'RESTRICTION', description: 'USED CLOTHING AND SCRAP METAL STRICTLY PROHIBITED FROM IMPORT.', isBlocking: true },
  // AE (UAE)
  { countryCode: 'AE', ruleType: 'IMPORT', category: 'DOCS', description: 'COMMERCIAL INVOICE AND CO MUST BE ATTESTED BY UAE EMBASSY FOR SHIPMENTS > 10,000 AED.', isBlocking: false },
  { countryCode: 'AE', ruleType: 'IMPORT', category: 'RESTRICTION', description: 'PORK PRODUCTS AND ALCOHOL REQUIRE SPECIAL MOCCAE/MUNICIPALITY PERMITS.', isBlocking: true },
  // SA (Saudi)
  { countryCode: 'SA', ruleType: 'IMPORT', category: 'DOCS', description: 'CERTIFICATE OF ORIGIN MUST BE ATTESTED BY CHAMBER OF COMMERCE.', isBlocking: false },
  { countryCode: 'SA', ruleType: 'IMPORT', category: 'RESTRICTION', description: 'DRONES, SPY CAMERAS, AND LASER POINTERS STRICTLY PROHIBITED.', isBlocking: true },
  // IN
  { countryCode: 'IN', ruleType: 'IMPORT', category: 'OCI', description: 'CONSIGNEE IEC (IMPORT EXPORT CODE) & GSTIN MANDATORY IN OCI FIELD.', isBlocking: true },
  { countryCode: 'IN', ruleType: 'IMPORT', category: 'DOCS', description: 'NOC FROM GPAT/WLRO REQUIRED FOR IMPORT OF DRUGS AND PHARMA.', isBlocking: true },
  // AU
  { countryCode: 'AU', ruleType: 'IMPORT', category: 'RESTRICTION', description: 'STRICT FUMIGATION CERTIFICATE (BMSB) REQUIRED FOR UNTREATED WOOD/AGRICULTURAL ITEMS.', isBlocking: true },
  { countryCode: 'AU', ruleType: 'IMPORT', category: 'RESTRICTION', description: 'ALL BIOLOGICAL MATERIALS AND FOOD SUBJECT TO STRICT QUARANTINE (DAFF).', isBlocking: true },
  // JP
  { countryCode: 'JP', ruleType: 'IMPORT', category: 'DOCS', description: 'NACCS ADVANCE FILING RULES (AFR) REQUIRED 24 HOURS PRIOR TO LOADING.', isBlocking: true },
  // BR
  { countryCode: 'BR', ruleType: 'IMPORT', category: 'OCI', description: 'CONSIGNEE CNPJ MUST BE PROVIDED ON THE AWB.', isBlocking: true },
  // SG
  { countryCode: 'SG', ruleType: 'IMPORT', category: 'OCI', description: 'SINGAPORE CUSTOMS UEN (UNIQUE ENTITY NUMBER) MANDATORY FOR CONSIGNEE.', isBlocking: true },
  // CA
  { countryCode: 'CA', ruleType: 'IMPORT', category: 'DOCS', description: 'PACT (PRE-ARRIVAL NOTIFICATION) MANDATORY. CBSA REQUIRES EXACT CARGO DESCRIPTION.', isBlocking: true },
  // QA
  { countryCode: 'QA', ruleType: 'IMPORT', category: 'RESTRICTION', description: 'IMPORT OF ELECTRONIC CIGARETTES AND VAPES IS STRICTLY PROHIBITED.', isBlocking: true }
];

const carrierRules = [
  // EK
  { carrierCode: 'EK', shcCode: 'OOG', description: 'OUT OF GAUGE CARGO NOT ACCEPTED ON PASSENGER NARROW-BODY AIRCRAFT.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  { carrierCode: 'EK', shcCode: 'VAL', description: 'VALUABLE CARGO ONLY ACCEPTED ON DIRECT FLIGHTS OR MAX 1 TRANSIT VIA DXB.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  { carrierCode: 'EK', shcCode: 'AVI', description: 'LIVE ANIMALS PROHIBITED ON FLIGHTS EXCEEDING 12 HOURS DURATIONS.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  // QR
  { carrierCode: 'QR', shcCode: 'AVI', description: 'LIVE ANIMALS (AVI) STRICTLY PROHIBITED ON FLIGHTS QR001 TO QR199.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  { carrierCode: 'QR', shcCode: 'DIP', description: 'DIPLOMATIC MAIL REQUIRES PRIOR APPROVAL FROM QATAR AIRWAYS SECURITY.', isBlocking: false, ruleCategory: 'RESTRICTION' },
  // EY
  { carrierCode: 'EY', shcCode: 'PER', description: 'ETIHAD DOES NOT ACCEPT PERISHABLES WITHOUT CONFIRMED COOL-CHAIN (TEMPCHECK) BOOKING.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  { carrierCode: 'EY', shcCode: 'HUM', description: 'HUMAN REMAINS MUST HAVE FULL EMBASSY CLEARANCE UPLOADED 48H PRIOR.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  // LH
  { carrierCode: 'LH', shcCode: 'ICE', description: 'DRY ICE (ICE) MAX LIMIT IS 200KG PER LOWER DECK COMPARTMENT.', isBlocking: false, ruleCategory: 'RESTRICTION' },
  { carrierCode: 'LH', shcCode: 'ELI', description: 'LITHIUM ION BATTERIES UN3480 SECTION IA/IB NOT ACCEPTED ON LUFTHANSA PASSENGER.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  // BA
  { carrierCode: 'BA', shcCode: 'AVI', description: 'LIVE ANIMALS RESTRICTED ON BA SHORT-HAUL A319/A320 DUE TO NON-VENTILATED HOLDS.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  { carrierCode: 'BA', shcCode: 'WEA', description: 'FIREARMS AND AMMUNITION STRICTLY EMBARGOED ON ALL TRANSITS VIA LHR TERMINAL 5.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  // CX
  { carrierCode: 'CX', shcCode: 'ELI', description: 'CATHAY PACIFIC STRICTLY EMBARGOES UN3480 LITHIUM ION BATTERIES ON ALL PASSENGER FLIGHTS.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  { carrierCode: 'CX', shcCode: 'RRY', description: 'RADIOACTIVE MATERIALS (CATEGORY II/III) PROHIBITED ON CX PASSENGER AIRCRAFT.', isBlocking: true, ruleCategory: 'RESTRICTION' },
  // SQ
  { carrierCode: 'SQ', shcCode: 'VAL', description: 'VALUABLE CARGO (VAL) MUST HAVE ARMED SECURITY ESCORT ARRANGED AT TRANSIT HUB (SIN).', isBlocking: false, ruleCategory: 'RESTRICTION' },
  // AI
  { carrierCode: 'AI', shcCode: 'HUM', description: 'HUMAN REMAINS CARRIAGE SUBJECT TO SPACE AVAILABILITY AND AIRPORT HEALTH OFFICER CLEARANCE.', isBlocking: false, ruleCategory: 'RESTRICTION' },
  { carrierCode: 'AI', shcCode: 'DGR', description: 'EXPLOSIVES (CLASS 1) COMPLETELY EMBARGOED ON ALL AIR INDIA ROUTES.', isBlocking: true, ruleCategory: 'RESTRICTION' }
];

const equipmentRules = [
  // Freighters
  { aircraftType: '747-8F', iataCode: '747', manufacturer: 'Boeing', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: '747-8 Freighter', maxPayloadKgs: 137700, maxVolumeCbm: 853, compatibleUlds: 'Q7, PMC, PAG, AKE, ALF, AMA, AMD, ULD', doorSize: '120x134 in (Main)', maxLengthCm: 605, maxWidthCm: 244, maxHeightCm: 300, isFreighter: true, remarks: 'Nose door loading capable for out-of-gauge.' },
  { aircraftType: '777F', iataCode: '77F', manufacturer: 'Boeing', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: '777 Freighter', maxPayloadKgs: 102000, maxVolumeCbm: 653, compatibleUlds: 'PMC, PAG, AKE, ALF, AMA', doorSize: '146x122 in (Main)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 300, isFreighter: true, remarks: 'Large side door allows massive oversize cargo.' },
  { aircraftType: 'A330-200F', iataCode: '33X', manufacturer: 'Airbus', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: 'A330-200 Freighter', maxPayloadKgs: 70000, maxVolumeCbm: 475, compatibleUlds: 'PMC, PAG, AKE, ALF', doorSize: '141x101 in (Main)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 244, isFreighter: true, remarks: 'Standard widebody freighter.' },
  
  // Passenger Widebodies (Belly)
  { aircraftType: 'A350-900', iataCode: '359', manufacturer: 'Airbus', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: 'A350-900', maxPayloadKgs: 20000, maxVolumeCbm: 150, compatibleUlds: 'LD3 (AKE), LD6 (ALF), PMC (up to 11)', doorSize: '96x64 in (Lower)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 162, isFreighter: false, remarks: 'Temperature controlled holds ideal for Pharma.' },
  { aircraftType: 'A380-800', iataCode: '388', manufacturer: 'Airbus', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: 'A380-800', maxPayloadKgs: 15000, maxVolumeCbm: 175, compatibleUlds: 'LD3 (AKE) ONLY', doorSize: '96x64 in (Lower)', maxLengthCm: 153, maxWidthCm: 153, maxHeightCm: 162, isFreighter: false, remarks: 'No PMC/PAG allowed. LD3 only due to deck curvature.' },
  { aircraftType: '787-9', iataCode: '789', manufacturer: 'Boeing', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: '787-9 Dreamliner', maxPayloadKgs: 18000, maxVolumeCbm: 140, compatibleUlds: 'PMC, PAG, AKE', doorSize: '105x66 in (Lower)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 162, isFreighter: false, remarks: 'High composite fuselage, check strict DGR limitations.' },
  { aircraftType: '777-300ER', iataCode: '77W', manufacturer: 'Boeing', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: '777-300ER', maxPayloadKgs: 25000, maxVolumeCbm: 200, compatibleUlds: 'PMC, PAG, AKE', doorSize: '105x66 in (Lower)', maxLengthCm: 318, maxWidthCm: 244, maxHeightCm: 162, isFreighter: false, remarks: 'Excellent belly capacity for passenger flight.' },
  
  // Passenger Narrowbodies (Belly)
  { aircraftType: 'A320neo', iataCode: '32N', manufacturer: 'Airbus', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: 'A320neo', maxPayloadKgs: 3500, maxVolumeCbm: 37, compatibleUlds: 'LD3-45 (AKH)', doorSize: '49x47 in (Lower)', maxLengthCm: 153, maxWidthCm: 114, maxHeightCm: 114, isFreighter: false, remarks: 'Loose cargo or specialized AKH containers only. NO PMC.' },
  { aircraftType: '737-800', iataCode: '738', manufacturer: 'Boeing', maxKgsPerPiece: 4000, bodyType: 'Wide Body', model: '737-800', maxPayloadKgs: 2500, maxVolumeCbm: 44, compatibleUlds: 'LOOSE BULK ONLY', doorSize: '48x35 in (Lower)', maxLengthCm: 120, maxWidthCm: 80, maxHeightCm: 80, isFreighter: false, remarks: 'No ULDs. Manual loading only. Strictly bulk.' }
];

async function seed() {
  try {
    await sequelize.authenticate();
    
    await TactCountryRule.destroy({ where: {} });
    await TactCarrierRule.destroy({ where: {} });
    await TactEquipmentRule.destroy({ where: {} });

    await TactCountryRule.bulkCreate(countryRules);
    await TactCarrierRule.bulkCreate(carrierRules);
    await TactEquipmentRule.bulkCreate(equipmentRules);

    console.log(`Successfully seeded ${countryRules.length} Country Rules, ${carrierRules.length} Carrier Embargoes, and ${equipmentRules.length} Aircraft Equipment Profiles!`);
    
  } catch(e) {
    console.error('Error seeding MDM data:', e);
  } finally {
    process.exit();
  }
}

seed();
