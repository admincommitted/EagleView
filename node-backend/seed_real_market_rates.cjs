const { sequelize } = require('./db');
const TactRateSector = require('./models/TactRateSector');
const TactRateDetail = require('./models/TactRateDetail');

const origins = ['DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU'];
const dests = [
  { code: 'JFK', region: 'USA', min: 7500, baseN: 450, q45: 350, q100: 310, q300: 290, q500: 275, q1000: 260, carrier: 'ALL' },
  { code: 'ORD', region: 'USA', min: 7500, baseN: 440, q45: 340, q100: 300, q300: 280, q500: 265, q1000: 250, carrier: 'ALL' },
  { code: 'LHR', region: 'EUR', min: 4500, baseN: 280, q45: 220, q100: 195, q300: 180, q500: 165, q1000: 150, carrier: 'BA' },
  { code: 'FRA', region: 'EUR', min: 4500, baseN: 270, q45: 215, q100: 190, q300: 175, q500: 160, q1000: 145, carrier: 'LH' },
  { code: 'CDG', region: 'EUR', min: 4500, baseN: 275, q45: 218, q100: 192, q300: 178, q500: 162, q1000: 148, carrier: 'AF' },
  { code: 'AMS', region: 'EUR', min: 4500, baseN: 265, q45: 210, q100: 185, q300: 170, q500: 155, q1000: 140, carrier: 'KL' },
  { code: 'DXB', region: 'MEA', min: 2500, baseN: 150, q45: 110, q100: 95, q300: 85, q500: 75, q1000: 65, carrier: 'EK' },
  { code: 'DOH', region: 'MEA', min: 2500, baseN: 155, q45: 115, q100: 98, q300: 88, q500: 78, q1000: 68, carrier: 'QR' },
  { code: 'SIN', region: 'ASIA', min: 3000, baseN: 180, q45: 140, q100: 125, q300: 110, q500: 100, q1000: 90, carrier: 'SQ' },
  { code: 'HKG', region: 'ASIA', min: 3000, baseN: 190, q45: 145, q100: 130, q300: 115, q500: 105, q1000: 95, carrier: 'CX' },
  { code: 'NRT', region: 'ASIA', min: 3500, baseN: 240, q45: 190, q100: 170, q300: 155, q500: 145, q1000: 135, carrier: 'JL' },
  { code: 'SYD', region: 'OCE', min: 5500, baseN: 550, q45: 450, q100: 410, q300: 380, q500: 350, q1000: 330, carrier: 'QF' }
];

const scrs = [
  { code: '0006', name: 'Fruits & Veg', discount: 0.80 },
  { code: '0300', name: 'Fish/Seafood', discount: 0.75 },
  { code: '0700', name: 'Pharma', discount: 0.90 }, 
  { code: '2200', name: 'Garments', discount: 0.85 },
  { code: '4211', name: 'Auto Parts', discount: 0.88 }
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
        if (origin === 'CCU' && (dest.code === 'SYD' || dest.code === 'CDG' || dest.code === 'NRT')) continue;
        if (origin === 'MAA' && (dest.code === 'ORD' || dest.code === 'AMS')) continue;

        // Specific Carrier Sector
        const sector = await TactRateSector.create({
            originCode: origin, destinationCode: dest.code, carrierCode: dest.carrier, currencyCode: 'INR'
        });
        sectorCount++;

        // Generic ALL Carrier Sector (10-15% higher than direct carrier as market standard)
        if (dest.carrier !== 'ALL') {
            const genericSector = await TactRateSector.create({
                originCode: origin, destinationCode: dest.code, carrierCode: 'ALL', currencyCode: 'INR'
            });
            sectorCount++;
            
            await TactRateDetail.bulkCreate([
                { sectorId: genericSector.id, rateClassCode: 'M', weightBreak: 0, rateAmount: dest.min * 1.15 },
                { sectorId: genericSector.id, rateClassCode: 'N', weightBreak: 0, rateAmount: dest.baseN * 1.15 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 45, rateAmount: dest.q45 * 1.15 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 100, rateAmount: dest.q100 * 1.15 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 300, rateAmount: dest.q300 * 1.15 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 500, rateAmount: dest.q500 * 1.15 },
                { sectorId: genericSector.id, rateClassCode: 'Q', weightBreak: 1000, rateAmount: dest.q1000 * 1.15 }
            ]);
            detailCount += 7;
        }

        const details = [
          { sectorId: sector.id, rateClassCode: 'M', weightBreak: 0, rateAmount: dest.min },
          { sectorId: sector.id, rateClassCode: 'N', weightBreak: 0, rateAmount: dest.baseN },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 45, rateAmount: dest.q45 },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 100, rateAmount: dest.q100 },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 300, rateAmount: dest.q300 },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 500, rateAmount: dest.q500 },
          { sectorId: sector.id, rateClassCode: 'Q', weightBreak: 1000, rateAmount: dest.q1000 },
        ];

        let scr1 = null;
        if (dest.region === 'MEA') scr1 = scrs[0]; // Fruits
        else if (dest.region === 'ASIA') scr1 = scrs[1]; // Fish
        else if (dest.region === 'EUR') scr1 = scrs[3]; // Garments
        else scr1 = scrs[4]; // Auto parts

        details.push({ sectorId: sector.id, rateClassCode: 'C', commodityItemNo: scr1.code, weightBreak: 100, rateAmount: dest.q100 * scr1.discount });
        
        if (dest.region === 'USA' || dest.region === 'EUR') {
            details.push({ sectorId: sector.id, rateClassCode: 'C', commodityItemNo: scrs[2].code, weightBreak: 100, rateAmount: dest.q100 * scrs[2].discount }); // Pharma
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
