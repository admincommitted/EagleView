const { sequelize } = require('./db');
const TactRateSector = require('./models/TactRateSector');
const TactRateDetail = require('./models/TactRateDetail');

const sectors = [
  { originCode: 'DEL', destinationCode: 'JFK', carrierCode: 'ALL', currencyCode: 'INR' },
  { originCode: 'DEL', destinationCode: 'LHR', carrierCode: 'ALL', currencyCode: 'INR' },
  { originCode: 'DEL', destinationCode: 'FRA', carrierCode: 'LH', currencyCode: 'INR' },
  { originCode: 'BOM', destinationCode: 'JFK', carrierCode: 'ALL', currencyCode: 'INR' },
  { originCode: 'BOM', destinationCode: 'DXB', carrierCode: 'EK', currencyCode: 'INR' },
  { originCode: 'MAA', destinationCode: 'SIN', carrierCode: 'ALL', currencyCode: 'INR' },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('DB connected.');
    
    await TactRateDetail.destroy({ where: {} });
    await TactRateSector.destroy({ where: {} });
    console.log('Old TACT Rates data cleared.');

    for (const s of sectors) {
      const sector = await TactRateSector.create(s);
      
      // Generate some realistic sliding scale rates based on destination
      let baseN = s.destinationCode === 'DXB' || s.destinationCode === 'SIN' ? 250 : 850;
      let minFee = s.destinationCode === 'DXB' || s.destinationCode === 'SIN' ? 5000 : 12000;
      
      const details = [
        { sectorId: sector.id, rateClassCode: 'M', weightBreak: 0, rateAmount: minFee },
        { sectorId: sector.id, rateClassCode: 'N', weightBreak: 0, rateAmount: baseN },
        { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 45, rateAmount: baseN * 0.90 },
        { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 100, rateAmount: baseN * 0.82 },
        { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 300, rateAmount: baseN * 0.75 },
        { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 500, rateAmount: baseN * 0.68 },
        { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 1000, rateAmount: baseN * 0.60 },
      ];
      
      // Add Specific Commodity Rate (SCR) example
      if(s.destinationCode === 'JFK') {
         details.push({ sectorId: sector.id, rateClassCode: 'C', commodityItemNo: '0300', weightBreak: 100, rateAmount: baseN * 0.70 }); // Fish
      }

      await TactRateDetail.bulkCreate(details);
    }

    console.log(`Successfully seeded ${sectors.length} IATA TACT Rate Sectors with full weight breaks!`);
    
  } catch(e) {
    console.error('Error seeding TACT Rates:', e);
  } finally {
    process.exit();
  }
}

seed();
