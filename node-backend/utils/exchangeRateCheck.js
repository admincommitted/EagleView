// BE checks on the exchange rates (18-Nov-2026): a CBIC (standard) currency should go with the rate in force on the
// BE date / the day the BE is filed (20-Nov-2026; was the job date) - the master once held the next day's notification (CBIC 32/2026 on 18-Nov), and a rate taken then, or
// typed, or kept from an older job, would be filed without a word. Warnings only: a bank rate for a non-standard
// currency, or a rate ICEGATE has for another date, can be right.
const cbic = require('./cbicExchangeRates');

const ymd8 = (v) => { const t = String(v || '').trim(); let m; if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`; if ((m = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(t))) return `${m[3]}-${m[2]}-${m[1]}`; return ''; };
const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : iso; };

async function checkExchangeRates(validation, jobData, file) {
  if (!validation || !file || !file.master) return validation;
  const rows = (file.master.exchangeModel || []).filter(r => r && String(r.currencyCode || '').toUpperCase() !== 'INR');
  if (!rows.length) return validation;
  // 20-Nov-2026: a BE with its BE date (filed earlier and keyed in now) is checked against the rates of that date;
  // else against today's, the day the BE is filed (was the job date - iCAFFE 7675 of job date 16-10 filed 16-11's rate)
  const beDay = ymd8(jobData && jobData.beDate);
  const jobDay = beDay || cbic.todayIST();
  const on = beDay ? 'on the BE date ' + dmy(jobDay) : 'today (' + dmy(jobDay) + ')';
  let inForce;
  try { inForce = await cbic.ratesInForce(jobDay); } catch (e) { return validation; }
  if (!inForce || !inForce.rates.length) return validation;   // no history yet
  const by = new Map(inForce.rates.map(r => [String(r.currencyCode).toUpperCase(), r]));
  for (const r of rows) {
    const code = String(r.currencyCode).toUpperCase();
    const h = by.get(code);
    if (!h) continue;                                          // not a CBIC currency
    const per = Number(r.unitInRs) || 1;
    const want = +(Number(h.importRate) * per).toFixed(4);
    const eff = ymd8(r.effectiveDate);
    if (Math.abs(Number(r.rate) - want) > 1e-6) {
      validation.warnings.push(`Exchange rate: ${code} ${r.rate}${per !== 1 ? ' per ' + per : ''} is not the CBIC rate in force ${on} (${h.notificationNo}, from ${dmy(h.effectiveDate)}: ${want}) - check it, or take it with Invoices > Update Exchange Rate`);
    } else if (eff && eff > jobDay) {
      validation.warnings.push(`Exchange rate: ${code} is dated ${dmy(eff)}, after ${beDay ? 'the BE date ' + dmy(jobDay) : 'today (' + dmy(jobDay) + ')'} - the rate in force ${on} is ${h.notificationNo} from ${dmy(h.effectiveDate)}`);
    }
  }
  return validation;
}

module.exports = { checkExchangeRates };
