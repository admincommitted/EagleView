const { sequelize } = require('./db');
const Drawback = require('./models/Drawback');
const Rodtep = require('./models/Rodtep');
const Rosctl = require('./models/Rosctl');

async function seedCarpets() {
    await sequelize.sync();
    
    const hsnData = [
        { tariffItem: '57011010', description: 'Hand-made carpets of wool', uqc: 'SQM' },
        { tariffItem: '57011090', description: 'Other carpets of wool', uqc: 'SQM' },
        { tariffItem: '57019011', description: 'Hand-made carpets of silk', uqc: 'SQM' },
        { tariffItem: '57019019', description: 'Other carpets of silk', uqc: 'SQM' },
        { tariffItem: '57019020', description: 'Carpets of coir including geo textile', uqc: 'SQM' },
        { tariffItem: '57019031', description: 'Hand-made carpets of synthetic fibres', uqc: 'SQM' },
        { tariffItem: '57019039', description: 'Other carpets of synthetic fibres', uqc: 'SQM' },
        { tariffItem: '57019090', description: 'Other carpets of other textile materials', uqc: 'SQM' },
        { tariffItem: '57021000', description: '"Kelem", "Schumacks", "Karamanie" and similar hand-woven rugs', uqc: 'SQM' },
        { tariffItem: '57022010', description: 'Coir matting, woven', uqc: 'SQM' },
        { tariffItem: '57022020', description: 'Coir carpets and other rugs', uqc: 'SQM' }
    ];

    // Seed Drawback
    for (let item of hsnData) {
        await Drawback.create({
            tariffItem: item.tariffItem,
            description: item.description,
            schemeCode: '19',
            drawbackRate: 5.0,
            drawbackCap: 250,
            isActive: true,
            uqc: item.uqc
        });
    }

    // Seed RoDTEP
    for (let item of hsnData) {
        await Rodtep.create({
            tariffItem: item.tariffItem,
            description: item.description,
            rate: 2.5,
            cap: 50,
            isActive: true,
            uqc: item.uqc
        });
    }

    // Seed RoSCTL (Usually apparel/made-ups, but let's add just to show)
    for (let item of hsnData) {
        await Rosctl.create({
            tariffItem: item.tariffItem,
            description: item.description,
            rate: 8.2,
            cap: 300,
            isActive: true,
            uqc: item.uqc
        });
    }

    console.log('Seeded Carpet HSNs into Export Schedules');
}

seedCarpets().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
