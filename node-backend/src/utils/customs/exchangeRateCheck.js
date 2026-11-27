// BE checks on the exchange rates: a CBIC (standard) currency should go with the rate in force on the BE date, or
// on the day the BE is filed. The master can already hold the next day's notification, and a rate taken then, typed,
// or kept from an older job would otherwise be filed without a word. Warnings only: a bank rate for a non-standard
// currency, or a rate ICEGATE has for another date, can be right.
import * as cbic from './cbicExchangeRates.js';

const RATE_TOLERANCE = 1e-6;

const ymd8 = (value) => {
  const text = String(value || '').trim();
  let m;
  if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(text))) return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
};
const dmy = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
};

async function checkExchangeRates(validation, jobData, file) {
  if (!validation || !file || !file.master) return validation;
  const rows = (file.master.exchangeModel || []).filter(
    (r) => r && String(r.currencyCode || '').toUpperCase() !== 'INR',
  );
  if (!rows.length) return validation;
  // a BE that already has its BE date (filed earlier and keyed in now) is checked against the rates of that date;
  // otherwise against today's, the day the BE is filed
  const beDay = ymd8(jobData && jobData.beDate);
  const jobDay = beDay || cbic.todayIST();
  const on = beDay ? 'on the BE date ' + dmy(jobDay) : 'today (' + dmy(jobDay) + ')';
  let inForce;
  try {
    inForce = await cbic.ratesInForce(jobDay);
  } catch {
    return validation;
  }
  if (!inForce || !inForce.rates.length) return validation; // no history yet
  const cbicRateByCode = new Map(inForce.rates.map((r) => [String(r.currencyCode).toUpperCase(), r]));
  for (const row of rows) {
    const code = String(row.currencyCode).toUpperCase();
    const cbicRate = cbicRateByCode.get(code);
    if (!cbicRate) continue; // not a CBIC currency
    const per = Number(row.unitInRs) || 1;
    const want = +(Number(cbicRate.importRate) * per).toFixed(4);
    const effectiveDay = ymd8(row.effectiveDate);
    if (Math.abs(Number(row.rate) - want) > RATE_TOLERANCE) {
      validation.warnings.push(
        `Exchange rate: ${code} ${row.rate}${per !== 1 ? ' per ' + per : ''} is not the CBIC rate in force ${on} (${cbicRate.notificationNo}, from ${dmy(cbicRate.effectiveDate)}: ${want}) - check it, or take it with Invoices > Update Exchange Rate`,
      );
    } else if (effectiveDay && effectiveDay > jobDay) {
      validation.warnings.push(
        `Exchange rate: ${code} is dated ${dmy(effectiveDay)}, after ${beDay ? 'the BE date ' + dmy(jobDay) : 'today (' + dmy(jobDay) + ')'} - the rate in force ${on} is ${cbicRate.notificationNo} from ${dmy(cbicRate.effectiveDate)}`,
      );
    }
  }
  return validation;
}

export { checkExchangeRates };
