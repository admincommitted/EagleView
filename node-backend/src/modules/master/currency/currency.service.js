import { ApiError } from '../../../core/http/index.js';
import { AppSetting, Currency } from '../../../models/index.js';
import * as cbicExchangeRates from '../../../utils/customs/cbicExchangeRates.js';

// MARKET rates (not the CBIC customs rates): import 1 % above, export 1 % below the market value, 4 decimals
const MARKET_RATES_URL = 'https://open.er-api.com/v6/latest/INR';
const MARKET_RATES_TIMEOUT_MS = 10000;
const IMPORT_RATE_FACTOR = 1.01;
const EXPORT_RATE_FACTOR = 0.99;
const RATE_DECIMALS = 4;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CBIC_AUTO_SETTING = {
  key: 'cbic_exrate_auto',
  value: '1',
  group: 'icegate',
  label: 'Auto-sync CBIC exchange rates from ICEGATE',
};

const failedWith = (status, message) => new ApiError(status, message, { body: { error: message } });

async function fetchMarketRates() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MARKET_RATES_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(MARKET_RATES_URL, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw failedWith(504, 'Exchange rate API timed out after 10 seconds');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) throw failedWith(502, `Exchange rate API answered HTTP ${response.status}`);
  const data = await response.json();
  return data.rates || {};
}

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/** POST /currencies/sync-live: every currency's rates from today's market rate, marked "MARKET RATE <date>". */
export async function syncLiveRates() {
  const rates = await fetchMarketRates();
  const today = startOfToday();
  const label = `MARKET RATE ${today.toLocaleDateString('en-GB')}`;
  const currencies = await Currency.findAll();
  let updatedCount = 0;
  for (const currency of currencies) {
    const rate = rates[currency.currencyCode];
    if (!(rate && rate > 0)) continue;
    const inrValue = 1 / rate;
    await currency.update({
      importRate: parseFloat((inrValue * IMPORT_RATE_FACTOR).toFixed(RATE_DECIMALS)),
      exportRate: parseFloat((inrValue * EXPORT_RATE_FACTOR).toFixed(RATE_DECIMALS)),
      effectiveDate: today,
      notificationNo: label,
    });
    updatedCount++;
  }
  return { success: true, updatedCount };
}

/**
 * GET /currencies/cbic-status: the CBIC notification in force today (from the history read from ICEGATE), the next
 * one published that comes into force later, and what the master has.
 */
export async function cbicStatus() {
  const [last, auto] = await Promise.all([cbicExchangeRates.lastSync(), cbicExchangeRates.autoEnabled()]);
  let current = null;
  let next = null;
  let error = null;
  try {
    current = await cbicExchangeRates.notificationInForce();
    next = await cbicExchangeRates.nextNotification();
  } catch (problem) {
    error = problem.message;
  }
  if (!current) {
    try {
      current = await cbicExchangeRates.notificationFor();
    } catch (problem) {
      error = error || problem.message;
    }
  }
  return {
    success: true,
    last,
    auto,
    current,
    next,
    today: cbicExchangeRates.todayIST(),
    upToDate: !!(last && current && last.number === current.number),
    error,
  };
}

const rateRowOf = (rate) => ({
  currencyCode: rate.currencyCode,
  currencyName: rate.currencyName,
  importRate: Number(rate.importRate),
  exportRate: Number(rate.exportRate),
  effectiveDate: rate.effectiveDate,
  notificationNo: rate.notificationNo,
});

/** GET /currencies/in-force?date=YYYY-MM-DD: the CBIC rates in force that day (default today, India); no history yet: the master. */
export async function ratesInForce(dateText) {
  const date = ISO_DAY.test(String(dateText || '')) ? String(dateText) : cbicExchangeRates.todayIST();
  const fromHistory = await cbicExchangeRates.ratesInForce(date);
  if (fromHistory.rates.length) {
    return { success: true, date: fromHistory.date, source: 'history', rates: fromHistory.rates.map(rateRowOf) };
  }
  const rows = await Currency.findAll({ raw: true });
  return { success: true, date, source: 'master', rates: rows.map(rateRowOf) };
}

/** GET /currencies/history?code=HKD: the notifications kept (newest first), or one currency's rates. */
export async function rateHistory(codeText) {
  const code = String(codeText || '')
    .trim()
    .toUpperCase();
  if (code) {
    const historyByCode = await cbicExchangeRates.historyOf([code]);
    return { success: true, code, rows: historyByCode.get(code) || [] };
  }
  return {
    success: true,
    notifications: await cbicExchangeRates.historyNotifications(),
    today: cbicExchangeRates.todayIST(),
  };
}

/** POST /currencies/sync-cbic: puts the notification in force today into the master ({ force: true } re-applies). */
export async function syncCbicRates({ force, user }) {
  const result = await cbicExchangeRates.syncNow({ force, user });
  return { success: true, ...result };
}

/** POST /currencies/cbic-auto { enabled } */
export async function setCbicAutoSync(enabled) {
  const [setting] = await AppSetting.findOrCreate({
    where: { key: CBIC_AUTO_SETTING.key },
    defaults: { ...CBIC_AUTO_SETTING },
  });
  await setting.update({ value: enabled ? '1' : '0' });
  return { success: true, auto: enabled };
}
