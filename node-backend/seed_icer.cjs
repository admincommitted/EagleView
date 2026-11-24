const { sequelize } = require('./db');
const IataExchangeRate = require('./models/IataExchangeRate');

const rates = [
  { billingMonth: '2026-09', currencyCode: 'USD', iataRoe: 1.00, sdrValue: 0.75 },
  { billingMonth: '2026-09', currencyCode: 'INR', iataRoe: 83.50, sdrValue: 62.62 },
  { billingMonth: '2026-09', currencyCode: 'EUR', iataRoe: 0.92, sdrValue: 0.69 },
  { billingMonth: '2026-09', currencyCode: 'GBP', iataRoe: 0.78, sdrValue: 0.58 },
  { billingMonth: '2026-09', currencyCode: 'AED', iataRoe: 3.67, sdrValue: 2.75 },
  { billingMonth: '2026-09', currencyCode: 'SGD', iataRoe: 1.34, sdrValue: 1.00 },
  { billingMonth: '2026-09', currencyCode: 'HKD', iataRoe: 7.82, sdrValue: 5.86 },
  { billingMonth: '2026-09', currencyCode: 'JPY', iataRoe: 151.20, sdrValue: 113.40 },
  { billingMonth: '2026-09', currencyCode: 'AUD', iataRoe: 1.52, sdrValue: 1.14 },
  { billingMonth: '2026-09', currencyCode: 'CNY', iataRoe: 7.23, sdrValue: 5.42 },
];

async function seed() {
  try {
    await sequelize.authenticate();
    await IataExchangeRate.destroy({ where: {} });
    await IataExchangeRate.bulkCreate(rates);
    console.log('Successfully seeded 10 IATA Exchange Rates (ICER)!');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
