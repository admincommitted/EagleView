// The same working as the server (routes/salesDeals.js workLine), so the screen shows what will be saved.
export const toNumber = (value) => {
  const number = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
};
export const round2 = (amount) => Math.round((Number(amount) || 0) * 100) / 100;

// "2x40HC, 1x20GP" -> 3
const containerCount = (text) => String(text || '').split(/[,+]/).reduce((sum, part) => {
  const match = /(\d+)\s*[Xx×*]/.exec(part);
  return sum + (match ? Number(match[1]) : 0);
}, 0);

export function autoQty(basis, cargo) {
  switch (basis) {
    case 'KG': return toNumber(cargo.chargeableWt) || toNumber(cargo.grossWt);
    case 'CBM': return toNumber(cargo.cbm);
    case 'CONTAINER': return containerCount(cargo.containers);
    case 'PKG': return toNumber(cargo.pkgs);
    case 'PCT': return toNumber(cargo.cargoValue);
    default: return 1;
  }
}

export function workLine(line, cargo) {
  const qty = line.autoQty ? autoQty(line.basis, cargo) : toNumber(line.qty);
  const factor = line.basis === 'PCT' ? qty / 100 : qty;
  const sell = round2(Math.max(toNumber(line.sellRate) * factor, toNumber(line.minSell)));
  const buy = round2(Math.max(toNumber(line.buyRate) * factor, toNumber(line.minBuy)));
  const roe = line.currency === 'INR' ? 1 : toNumber(line.roe);
  return { qty, sell, buy, roe, sellInr: round2(sell * roe), buyInr: round2(buy * roe) };
}

let lastLineKey = 0;
export const newLineKey = () => { lastLineKey += 1; return lastLineKey; };

const isFreight = (section) => section === 'FREIGHT';
const isLocalService = (serviceType) => /CUSTOMS|TRANSPORT/.test(serviceType);

function defaultBasis(section, serviceType) {
  if (!isFreight(section)) return 'FLAT';
  if (String(serviceType).includes('FCL')) return 'CONTAINER';
  return String(serviceType).startsWith('AIR') ? 'KG' : 'CBM';
}

/** A new charge line: freight of an air / sea service is in USD at today's rate, everything else a flat INR amount. */
export function newLine(section, serviceType, rateOf) {
  const foreign = isFreight(section) && !isLocalService(serviceType);
  return {
    key: newLineKey(),
    section,
    basis: defaultBasis(section, serviceType),
    currency: foreign ? 'USD' : 'INR',
    roe: foreign ? rateOf('USD') : 1,
    autoQty: true,
    head: '',
    chargeId: null,
  };
}

export const pdfFileName = (quoteNo) => `${String(quoteNo).replace(/[\\/]+/g, '-')}.pdf`;
