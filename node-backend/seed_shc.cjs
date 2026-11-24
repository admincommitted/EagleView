const { sequelize } = require('./db');
const IataShcConflict = require('./models/IataShcConflict');

const conflicts = [
  { shcCode1: 'AVI', shcCode2: 'ICE', isProhibited: true, reason: 'Live animals cannot be stored with Dry Ice due to CO2 emissions.' },
  { shcCode1: 'AVI', shcCode2: 'RRY', isProhibited: true, reason: 'Radioactive materials cannot be stored near Live Animals.' },
  { shcCode1: 'PER', shcCode2: 'HUM', isProhibited: true, reason: 'Perishables and Human Remains must be stored in separate holds.' },
  { shcCode1: 'VAL', shcCode2: 'AVI', isProhibited: false, reason: 'Valuables should not be mixed with live animals if possible (Warning).' },
  { shcCode1: 'DGR', shcCode2: 'PER', isProhibited: true, reason: 'Dangerous goods must be segregated from perishables/foodstuffs.' },
];

async function seed() {
  try {
    await sequelize.authenticate();
    await IataShcConflict.destroy({ where: {} });
    await IataShcConflict.bulkCreate(conflicts);
    console.log('Successfully seeded SHC Conflicts!');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
