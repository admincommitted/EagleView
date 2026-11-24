const { sequelize } = require('./db');
const Drawback = require('./models/Drawback');
const Rodtep = require('./models/Rodtep');
const Rosctl = require('./models/Rosctl');
const ExportPolicy = require('./models/ExportPolicy');

async function seed() {
    await sequelize.sync();

    // Seed Drawback
    await Drawback.destroy({ where: {} });
    await Drawback.bulkCreate([
        { tariffItem: '61091000', description: 'T-SHIRTS, SINGLETS AND OTHER VESTS, OF COTTON', schemeCode: '19', drawbackRate: 2.5, drawbackCap: 0, isActive: true },
        { tariffItem: '62052000', description: "MEN'S OR BOYS' SHIRTS OF COTTON", schemeCode: '19', drawbackRate: 2.0, drawbackCap: 45, isActive: true },
        { tariffItem: '63022100', description: 'OTHER PRINTED BED LINEN, OF COTTON', schemeCode: '19', drawbackRate: 2.6, drawbackCap: 110, isActive: true },
        { tariffItem: '42023120', description: 'WALLETS AND PURSES, OF LEATHER', schemeCode: '19', drawbackRate: 3.2, drawbackCap: 75, isActive: true },
        { tariffItem: '73269099', description: 'OTHER ARTICLES OF IRON OR STEEL', schemeCode: '19', drawbackRate: 1.5, drawbackCap: 0, isActive: true },
        { tariffItem: '61091000', description: 'T-SHIRTS, SINGLETS AND OTHER VESTS, OF COTTON', schemeCode: '00', drawbackRate: 0, drawbackCap: 0, isActive: true } // Non-drawback
    ]);
    console.log('Seeded Drawbacks');

    // Seed RoDTEP
    await Rodtep.destroy({ where: {} });
    await Rodtep.bulkCreate([
        { tariffItem: '61091000', description: 'T-SHIRTS, SINGLETS AND OTHER VESTS, OF COTTON', rate: 2.0, cap: 24, uqc: 'KGS', isActive: true },
        { tariffItem: '62052000', description: "MEN'S OR BOYS' SHIRTS OF COTTON", rate: 1.8, cap: 30, uqc: 'KGS', isActive: true },
        { tariffItem: '73269099', description: 'OTHER ARTICLES OF IRON OR STEEL', rate: 0.5, cap: 0, uqc: 'KGS', isActive: true },
        { tariffItem: '87089900', description: 'OTHER PARTS AND ACCESSORIES OF MOTOR VEHICLES', rate: 1.0, cap: 15, uqc: 'KGS', isActive: true },
        { tariffItem: '30049099', description: 'OTHER MEDICAMENTS', rate: 0.8, cap: 0, uqc: 'KGS', isActive: true }
    ]);
    console.log('Seeded RoDTEP');

    // Seed RoSCTL
    await Rosctl.destroy({ where: {} });
    await Rosctl.bulkCreate([
        { tariffItem: '61091000', description: 'T-SHIRTS, SINGLETS AND OTHER VESTS, OF COTTON', rate: 4.5, cap: 100, isActive: true },
        { tariffItem: '62052000', description: "MEN'S OR BOYS' SHIRTS OF COTTON", rate: 4.2, cap: 120, isActive: true },
        { tariffItem: '63022100', description: 'OTHER PRINTED BED LINEN, OF COTTON', rate: 5.0, cap: 150, isActive: true },
        { tariffItem: '61102000', description: 'JERSEYS, PULLOVERS, CARDIGANS OF COTTON', rate: 4.8, cap: 110, isActive: true },
        { tariffItem: '62034200', description: "MEN'S OR BOYS' TROUSERS, BIB AND BRACE OVERALLS", rate: 4.0, cap: 90, isActive: true }
    ]);
    console.log('Seeded RoSCTL');

    // Seed Export Policy
    await ExportPolicy.destroy({ where: {} });
    await ExportPolicy.bulkCreate([
        { tariffItem: '10061000', description: 'RICE IN THE HUSK (PADDY OR ROUGH)', exportDuty: 20, dgftPolicy: 'RESTRICTED', isActive: true },
        { tariffItem: '10011900', description: 'DURUM WHEAT: OTHER', exportDuty: 0, dgftPolicy: 'PROHIBITED', isActive: true },
        { tariffItem: '17011490', description: 'OTHER CANE SUGAR', exportDuty: 0, dgftPolicy: 'RESTRICTED', isActive: true },
        { tariffItem: '07031010', description: 'ONIONS, FRESH OR CHILLED', exportDuty: 40, dgftPolicy: 'RESTRICTED', isActive: true },
        { tariffItem: '61091000', description: 'T-SHIRTS, SINGLETS AND OTHER VESTS, OF COTTON', exportDuty: 0, dgftPolicy: 'FREE', isActive: true },
        { tariffItem: '72071210', description: 'BILLETS OF IRON OR NON-ALLOY STEEL', exportDuty: 15, dgftPolicy: 'FREE', isActive: true }
    ]);
    console.log('Seeded Export Policy');
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
