const { sequelize } = require('./db');
const TactSurcharge = require('./models/TactSurcharge');

const tactData = [
  { chargeCode: 'MY', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 1.25, minimumAmount: 0 },
  { chargeCode: 'SC', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.15, minimumAmount: 15 },
  { chargeCode: 'AW', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 25.0, minimumAmount: 25 },
  { chargeCode: 'CG', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 15.0, minimumAmount: 15 },
  { chargeCode: 'RA', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 50.0, minimumAmount: 50 }, // Dangerous Goods
  { chargeCode: 'XD', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.10, minimumAmount: 10 }, // X-Ray
  { chargeCode: 'MC', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 35.0, minimumAmount: 35 }, // Miscellaneous
  { chargeCode: 'XB', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.12, minimumAmount: 10 }, // Security Screening
  { chargeCode: 'CC', carrierCode: 'ALL', chargeBasis: 'PERCENTAGE', amount: 5.0, minimumAmount: 20 }, // Collect Charge Fee
  { chargeCode: 'CH', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 45.0, minimumAmount: 45 }, // Clearance and Handling
  { chargeCode: 'DB', carrierCode: 'ALL', chargeBasis: 'PERCENTAGE', amount: 10.0, minimumAmount: 25 }, // Disbursement
  { chargeCode: 'LA', carrierCode: 'ALL', chargeBasis: 'FLAT', amount: 120.0, minimumAmount: 120 }, // Live Animals
  { chargeCode: 'PK', carrierCode: 'ALL', chargeBasis: 'PER_BOX', amount: 5.0, minimumAmount: 5 }, // Packaging
  { chargeCode: 'SR', carrierCode: 'ALL', chargeBasis: 'PER_DAY_KG', amount: 0.50, minimumAmount: 50 }, // Storage
  { chargeCode: 'SU', carrierCode: 'ALL', chargeBasis: 'PER_KG', amount: 0.85, minimumAmount: 100 }, // Surface Trucking
  
  // Carrier Specific overrides
  { chargeCode: 'MY', carrierCode: 'EK', chargeBasis: 'PER_KG', amount: 1.50, minimumAmount: 0 }, // Emirates specific Fuel
  { chargeCode: 'MY', carrierCode: 'QR', chargeBasis: 'PER_KG', amount: 1.45, minimumAmount: 0 }, // Qatar specific Fuel
  { chargeCode: 'AW', carrierCode: 'EK', chargeBasis: 'FLAT', amount: 30.0, minimumAmount: 30 }, // Emirates AWB fee
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('DB connected.');
    
    // Clear old sample data
    await TactSurcharge.destroy({ where: {} });
    console.log('Old TACT Surcharge data cleared.');

    // Insert new comprehensive data
    await TactSurcharge.bulkCreate(tactData);
    console.log(`Successfully seeded ${tactData.length} comprehensive IATA TACT Surcharge records!`);
    
  } catch(e) {
    console.error('Error seeding TACT Surcharges:', e);
  } finally {
    process.exit();
  }
}

seed();
