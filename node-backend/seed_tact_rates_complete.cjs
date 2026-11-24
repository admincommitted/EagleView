const { sequelize } = require('./db');
const TactRateSector = require('./models/TactRateSector');
const TactRateDetail = require('./models/TactRateDetail');

const origins = ['DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU'];
const dests = [
  { code: 'JFK', region: 'USA', base: 850, min: 12000, carrier: 'ALL' },
  { code: 'ORD', region: 'USA', base: 820, min: 11000, carrier: 'ALL' },
  { code: 'LHR', region: 'EUR', base: 380, min: 6500, carrier: 'BA' },
  { code: 'FRA', region: 'EUR', base: 360, min: 6000, carrier: 'LH' },
  { code: 'CDG', region: 'EUR', base: 375, min: 6200, carrier: 'AF' },
  { code: 'AMS', region: 'EUR', base: 350, min: 5800, carrier: 'KL' },
  { code: 'DXB', region: 'MEA', base: 180, min: 3500, carrier: 'EK' },
  { code: 'DOH', region: 'MEA', base: 190, min: 3800, carrier: 'QR' },
  { code: 'SIN', region: 'ASIA', base: 220, min: 4000, carrier: 'SQ' },
  { code: 'HKG', region: 'ASIA', base: 260, min: 4500, carrier: 'CX' },
  { code: 'NRT', region: 'ASIA', base: 320, min: 5500, carrier: 'JL' },
  { code: 'SYD', region: 'OCE', base: 650, min: 9500, carrier: 'QF' }
];

const scrs = [
  { code: '0006', name: 'Fruits & Veg', discount: 0.65 },
  { code: '0300', name: 'Fish/Seafood', discount: 0.60 },
  { code: '0700', name: 'Pharma', discount: 0.75 }, // specialized, so less discount
  { code: '2200', name: 'Garments', discount: 0.70 },
  { code: '4211', name: 'Auto Parts', discount: 0.68 }
];

async function seed() {
  try {
    await sequelize.authenticate();
    
    await TactRateDetail.destroy({ where: {} });
    await TactRateSector.destroy({ where: {} });

    let sectorCount = 0;
    let detailCount = 0;

    for (const origin of origins) {
      for (const dest of dests) {
        // Skip some combinations just to make it look realistic (not a perfect cartesian product)
        if (origin === 'CCU' && (dest.code === 'SYD' || dest.code === 'CDG')) continue;
        if (origin === 'MAA' && dest.code === 'ORD') continue;

        // Add the primary carrier sector
        const sector = await TactRateSector.create({
            originCode: origin,
            destinationCode: dest.code,
            carrierCode: dest.carrier,
            currencyCode: 'INR'
        });
        sectorCount++;

        // Add a generic 'ALL' sector for the same route if it's not ALL
        if (dest.carrier !== 'ALL') {
            const genericSector = await TactRateSector.create({
                originCode: origin,
                destinationCode: dest.code,
                carrierCode: 'ALL',
                currencyCode: 'INR'
            });
            sectorCount++;
            
            // Build generic rates (slightly more expensive than specific carrier)
            const genBase = dest.base * 1.15;
            const genMin = dest.min * 1.15;
            
            await TactRateDetail.bulkCreate([
                { sectorId: genericSector.id, rateClassCode: 'M', weightBreak: 0, rateAmount: genMin },
                { sectorId: genericSector.id, rateClassCode: 'N', weightBreak: 0, rateAmount: genBase },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 45, rateAmount: genBase * 0.90 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 100, rateAmount: genBase * 0.82 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 300, rateAmount: genBase * 0.75 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 500, rateAmount: genBase * 0.68 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 1000, rateAmount: genBase * 0.60 }
            ]);
            detailCount += 7;
        }

        // Build specific rates
        const details = [
          { sectorId: sector.id, rateClassCode: 'M', weightBreak: 0, rateAmount: dest.min },
          { sectorId: sector.id, rateClassCode: 'N', weightBreak: 0, rateAmount: dest.base },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 45, rateAmount: dest.base * 0.90 },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 100, rateAmount: dest.base * 0.82 },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 300, rateAmount: dest.base * 0.75 },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 500, rateAmount: dest.base * 0.68 },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 1000, rateAmount: dest.base * 0.60 },
        ];

        // Randomly assign 1 or 2 SCRs based on region
        let scr1 = null;
        if (dest.region === 'MEA') scr1 = scrs[0]; // Fruits
        else if (dest.region === 'ASIA') scr1 = scrs[1]; // Fish
        else if (dest.region === 'EUR') scr1 = scrs[3]; // Garments
        else scr1 = scrs[4]; // Auto parts

        details.push({ sectorId: sector.id, rateClassCode: 'C', commodityItemNo: scr1.code, weightBreak: 100, rateAmount: dest.base * scr1.discount });
        
        if (dest.region === 'USA' || dest.region === 'EUR') {
            details.push({ sectorId: sector.id, rateClassCode: 'C', commodityItemNo: scrs[2].code, weightBreak: 100, rateAmount: dest.base * scrs[2].discount }); // Pharma
        }

        await TactRateDetail.bulkCreate(details);
        detailCount += details.length;
      }
    }

    console.log(`Successfully seeded ${sectorCount} IATA TACT Rate Sectors with ${detailCount} rate details!`);
    
  } catch(e) {
    console.error('Error seeding TACT Rates:', e);
  } finally {
    process.exit();
  }
}

seed();
