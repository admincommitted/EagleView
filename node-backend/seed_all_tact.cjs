const { sequelize } = require('./db');
const TactSurcharge = require('./models/TactSurcharge');

const exhaustiveTactData = [
  // A
  { chargeCode: 'AC', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 35.0, minimumAmount: 35 },
  { chargeCode: 'AS', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.50, minimumAmount: 15 },
  { chargeCode: 'AT', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 200.0, minimumAmount: 200 },
  { chargeCode: 'AW', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 25.0, minimumAmount: 25 }, // AWB Fee
  // B
  { chargeCode: 'BA', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 50.0, minimumAmount: 50 }, // Brokerage
  { chargeCode: 'BL', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 15.0, minimumAmount: 15 }, // Blacklist Cert
  { chargeCode: 'BR', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 45.0, minimumAmount: 45 }, // Bank Release
  // C
  { chargeCode: 'CA', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 1.0, minimumAmount: 25 }, // Cartage Origin
  { chargeCode: 'CB', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 1.0, minimumAmount: 25 }, // Cartage Dest
  { chargeCode: 'CC', carrierCode: 'ALL', chargeBasis: 'PERCENTAGE', amount: 5.0, minimumAmount: 20 }, // Collect Charge Fee
  { chargeCode: 'CD', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 45.0, minimumAmount: 45 }, // Clearance Dest
  { chargeCode: 'CG', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 15.0, minimumAmount: 15 }, // e-AWB / EDI
  { chargeCode: 'CH', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 45.0, minimumAmount: 45 }, // Clearance Origin
  // D
  { chargeCode: 'DB', carrierCode: 'ALL', chargeBasis: 'PERCENTAGE', amount: 10.0, minimumAmount: 25 }, // Disbursement
  // E
  { chargeCode: 'EA', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 20.0, minimumAmount: 20 }, // Export Customs
  // F
  { chargeCode: 'FC', carrierCode: 'ALL', chargeBasis: 'PERCENTAGE', amount: 5.0, minimumAmount: 15 },
  { chargeCode: 'FD', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 25.0, minimumAmount: 25 },
  { chargeCode: 'FE', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 100.0, minimumAmount: 100 }, // First Flight Out
  // G
  { chargeCode: 'GT', carrierCode: 'ALL', chargeBasis: 'PERCENTAGE', amount: 18.0, minimumAmount: 0 }, // Gov Tax
  // H
  { chargeCode: 'HR', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 150.0, minimumAmount: 150 }, // Human Remains
  // I
  { chargeCode: 'IN', carrierCode: 'ALL', chargeBasis: 'PERCENTAGE', amount: 1.5, minimumAmount: 20 }, // Insurance
  // L
  { chargeCode: 'LA', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 120.0, minimumAmount: 120 }, // Live Animals
  // M
  { chargeCode: 'MA', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 35.0, minimumAmount: 35 }, // Misc Due Agent
  { chargeCode: 'MB', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 35.0, minimumAmount: 35 }, // Misc Dest
  { chargeCode: 'MC', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 35.0, minimumAmount: 35 }, // Misc Due Carrier
  { chargeCode: 'MY', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 1.25, minimumAmount: 0 }, // FSC
  // P
  { chargeCode: 'PK', carrierCode: 'ALL', chargeBasis: 'PER_BOX', amount: 5.0, minimumAmount: 5 }, // Packaging
  { chargeCode: 'PU', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 1.5, minimumAmount: 30 }, // Pick-up
  // R
  { chargeCode: 'RA', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 65.0, minimumAmount: 65 }, // DGR Fee
  { chargeCode: 'RC', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 25.0, minimumAmount: 25 }, // Routing
  // S
  { chargeCode: 'SC', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.15, minimumAmount: 15 }, // SSC
  { chargeCode: 'SD', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.85, minimumAmount: 50 }, // Surface Dest
  { chargeCode: 'SI', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 40.0, minimumAmount: 40 }, // Stop in Transit
  { chargeCode: 'SO', carrierCode: 'ALL', chargeBasis: 'PER_DAY_KG', amount: 0.50, minimumAmount: 50 }, // Storage Origin
  { chargeCode: 'SR', carrierCode: 'ALL', chargeBasis: 'PER_DAY_KG', amount: 0.50, minimumAmount: 50 }, // Storage Dest
  { chargeCode: 'SU', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.85, minimumAmount: 100 }, // Surface Origin
  // T
  { chargeCode: 'TX', carrierCode: 'ALL', chargeBasis: 'PERCENTAGE', amount: 5.0, minimumAmount: 0 }, // Tax
  // U
  { chargeCode: 'UD', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 20.0, minimumAmount: 20 }, // Unitized Consignment
  // X
  { chargeCode: 'XB', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.12, minimumAmount: 10 }, // Security Screening
  { chargeCode: 'XD', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.10, minimumAmount: 10 }, // X-Ray

  // Overrides for specific carriers
  { chargeCode: 'MY', carrierCode: 'EK', chargeBasis: 'PER_KG', amount: 1.50, minimumAmount: 0 },
  { chargeCode: 'MY', carrierCode: 'QR', chargeBasis: 'PER_KG', amount: 1.45, minimumAmount: 0 },
  { chargeCode: 'AW', carrierCode: 'EK', chargeBasis: 'FLAT', amount: 30.0, minimumAmount: 30 },
  { chargeCode: 'SC', carrierCode: 'EK', chargeBasis: 'PER_KG', amount: 0.20, minimumAmount: 15 },
  { chargeCode: 'RA', carrierCode: 'LH', chargeBasis: 'FLAT', amount: 85.0, minimumAmount: 85 }, // Lufthansa High DGR Fee
  { chargeCode: 'XD', carrierCode: 'AF', chargeBasis: 'PER_KG', amount: 0.15, minimumAmount: 15 },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('DB connected.');
    
    await TactSurcharge.destroy({ where: {} });
    console.log('Old TACT Surcharge data cleared.');

    await TactSurcharge.bulkCreate(exhaustiveTactData);
    console.log(`Successfully seeded ${exhaustiveTactData.length} comprehensive IATA TACT Surcharge records!`);
    
  } catch(e) {
    console.error('Error seeding exhaustive TACT Surcharges:', e);
  } finally {
    process.exit();
  }
}

seed();
