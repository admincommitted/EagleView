// CBIC rate of exchange - one place for the per-100 rule.
//
// CBIC notifies the rate of exchange in two schedules. Schedule I is rupees per 1 unit of foreign currency.
// Schedule II is rupees per 100 units and holds exactly two currencies - Japanese Yen and Korean Won. A rate
// read off the notification (or typed from it) for those two is therefore a per-100 figure.
//
// Every rupee figure divides by the unit (exchange-rate rows carry { rate, unitInRs }): 1,000,000 JPY at the
// notified 55.50 per 100 is Rs 5,55,000, not Rs 5,55,00,000.
export const PER_100_CURRENCIES = ['JPY', 'KRW'];

export const normCur = (c) => String(c || '').trim().toUpperCase();

// units the notified rate is quoted for: 100 for Schedule II, else 1
export const unitsOf = (cur) => (PER_100_CURRENCIES.includes(normCur(cur)) ? 100 : 1);

// rupees for one unit of the currency, from a rate in CBIC notation plus its unitInRs.
// unitInRs missing (an invoice saved before the units were kept): there is no way to tell from the row alone
// which of the two figures was stored, so it is taken from the size of the rate. JPY and KRW have never been
// anywhere near Rs 5 a unit - they sit around Rs 0.5 - while the notified per-100 figure is around 55, so the
// two cannot be confused. The SB builder (utils/IcegateJsonBuilder.js) reads an old row the same way.
export const perUnit = (cur, rate, unitInRs) => {
    const r = parseFloat(String(rate ?? '').replace(/,/g, ''));
    if (!isFinite(r) || r === 0) return 0;
    if (normCur(cur) === 'INR') return 1;
    const want = unitsOf(cur);
    const u = parseFloat(unitInRs) || (want === 100 ? (r > 5 ? 100 : 1) : 1);
    return r / (u || 1);
};

// a rate held per 1 unit (the Currency master's importRate / exportRate) put into CBIC notation
export const toNotation = (cur, ratePerUnit) => {
    const r = parseFloat(String(ratePerUnit ?? '').replace(/,/g, ''));
    const u = unitsOf(cur);
    return { rate: isFinite(r) ? +(r * u).toFixed(4) : 0, unitInRs: u };
};

// "55.5000 per 100 JPY" / "88.6500 per USD" - for a tooltip or a report line
export const rateText = (cur, rate, unitInRs) => {
    const c = normCur(cur);
    if (!c || !rate) return '';
    const u = parseFloat(unitInRs) || unitsOf(c);
    return `${parseFloat(rate).toFixed(4)} per ${u > 1 ? u + ' ' : ''}${c}`;
};
