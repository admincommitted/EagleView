const { sequelize } = require('./db');
const PenaltyRule = require('./models/PenaltyRule');

async function seed() {
  await sequelize.sync();
  
  const count = await PenaltyRule.count();
  if (count === 0) {
    await PenaltyRule.bulkCreate([
      { tradeType: 'IMPORT', type: 'DEMURRAGE', mode: 'SEA', basis: 'DISCHARGE_DATE', freeDays: 5, slab1Rate: 2500, slab2Rate: 4000, slab3Rate: 7000 },
      { tradeType: 'IMPORT', type: 'DEMURRAGE', mode: 'AIR', basis: 'DISCHARGE_DATE', freeDays: 2, slab1Rate: 1500, slab2Rate: 3000, slab3Rate: 6000 },
      { tradeType: 'IMPORT', type: 'DETENTION', mode: 'SEA', basis: 'DISCHARGE_DATE', freeDays: 14, slab1Rate: 4500, slab2Rate: 9000, slab3Rate: 9000 },
      { tradeType: 'IMPORT', type: 'CUSTOMS_LATE_FEE', mode: 'ALL', basis: 'IGM_DATE', freeDays: 1, slab1Rate: 5000, slab2Rate: 10000, slab3Rate: 10000 },
      { tradeType: 'EXPORT', type: 'GROUND_RENT', mode: 'SEA', basis: 'GATE_IN_DATE', freeDays: 7, slab1Rate: 2000, slab2Rate: 3500, slab3Rate: 5000 },
      { tradeType: 'EXPORT', type: 'LATE_LEO_FEE', mode: 'ALL', basis: 'SHIPPING_BILL_DATE', freeDays: 3, slab1Rate: 1000, slab2Rate: 2000, slab3Rate: 3000 }
    ]);
    console.log('Seeded 6 rules');
  } else {
    console.log('Rules already exist');
  }
  process.exit();
}
seed();
