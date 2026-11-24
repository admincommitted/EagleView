const { sequelize } = require('./db');
const TactProportionalRate = require('./models/TactProportionalRate');

const addons = [
  { gatewayAirport: 'DEL', localAirport: 'JAI', addonAmount: 15.50, currencyCode: 'INR' },
  { gatewayAirport: 'DEL', localAirport: 'ATQ', addonAmount: 18.00, currencyCode: 'INR' },
  { gatewayAirport: 'DEL', localAirport: 'LKO', addonAmount: 20.00, currencyCode: 'INR' },
  { gatewayAirport: 'BOM', localAirport: 'PNQ', addonAmount: 12.00, currencyCode: 'INR' },
  { gatewayAirport: 'BOM', localAirport: 'AMD', addonAmount: 16.50, currencyCode: 'INR' },
  { gatewayAirport: 'MAA', localAirport: 'CJB', addonAmount: 14.00, currencyCode: 'INR' },
  { gatewayAirport: 'MAA', localAirport: 'TRZ', addonAmount: 17.00, currencyCode: 'INR' },
  { gatewayAirport: 'BLR', localAirport: 'MYQ', addonAmount: 10.50, currencyCode: 'INR' },
  { gatewayAirport: 'CCU', localAirport: 'PAT', addonAmount: 22.00, currencyCode: 'INR' },
  { gatewayAirport: 'HYD', localAirport: 'VGA', addonAmount: 15.00, currencyCode: 'INR' },
];

async function seed() {
  try {
    await sequelize.authenticate();
    await TactProportionalRate.destroy({ where: {} });
    await TactProportionalRate.bulkCreate(addons);
    console.log('Successfully seeded 10 Proportional Rates!');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
