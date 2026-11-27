import { BadRequestError } from '../../../../core/http/index.js';
import { x, clean, upper, numOrNull } from '../../../../utils/common/salesHub.js';
import { queryOrEmpty } from '../../shared/salesHelpers.js';
import { CHARGE_BASIS, CHARGE_SECTIONS, dbNow, round2 } from '../shared/dealsShared.js';

const PERCENT = 100;

/** "2x40HC, 1x20GP" -> 3 */
const containerCount = (containers) =>
  String(containers || '')
    .split(/[,+]/)
    .reduce((total, part) => {
      const match = /(\d+)\s*[Xx×*]/.exec(part);
      return total + (match ? Number(match[1]) : 0);
    }, 0);

function quantityForBasis(basis, head) {
  if (basis === 'KG') return head.chargeableWt || head.grossWt || 0;
  if (basis === 'CBM') return head.cbm || 0;
  if (basis === 'CONTAINER') return containerCount(head.containers);
  if (basis === 'PKG') return head.pkgs || 0;
  if (basis === 'PCT') return head.cargoValue || 0;
  return 1;
}

function rateOfExchange(line, currency, rates) {
  let roe = currency === 'INR' ? 1 : numOrNull(line.roe);
  if (currency !== 'INR' && !(roe > 0)) roe = rates.get(currency) || null;
  if (!(roe > 0)) {
    throw new BadRequestError(
      `No rate of exchange for ${currency} - add it in the Currency master or type it on the line`,
    );
  }
  return roe;
}

/** One charge line worked out: qty from the basis, amounts with the minimum, INR at the line's rate of exchange. */
function workOutLine(line, head, rates) {
  const basis = CHARGE_BASIS.some((entry) => entry[0] === upper(line.basis)) ? upper(line.basis) : 'FLAT';
  let qty = numOrNull(line.qty);
  if (qty == null || line.autoQty) qty = quantityForBasis(basis, head);
  const currency = upper(line.currency) || 'INR';
  const roe = rateOfExchange(line, currency, rates);
  const sellRate = numOrNull(line.sellRate) || 0;
  const buyRate = numOrNull(line.buyRate) || 0;
  const factor = basis === 'PCT' ? qty / PERCENT : qty;
  const sellAmount = round2(Math.max(sellRate * factor, numOrNull(line.minSell) || 0));
  const buyAmount = round2(Math.max(buyRate * factor, numOrNull(line.minBuy) || 0));
  return {
    basis,
    qty: round2(qty * 1000) / 1000,
    currency,
    roe,
    sellRate,
    buyRate,
    minSell: numOrNull(line.minSell),
    minBuy: numOrNull(line.minBuy),
    sellAmount,
    buyAmount,
    sellInr: round2(sellAmount * roe),
    buyInr: round2(buyAmount * roe),
  };
}

/** Currency master rates: the export rate for an export service, else the import rate. */
async function currencyRates(serviceType) {
  const isExport = /EXP/.test(String(serviceType || ''));
  const rows = await queryOrEmpty('SELECT currencyCode code, importRate, exportRate FROM Currencies');
  return new Map(
    rows.map((row) => [
      String(row.code).toUpperCase(),
      Number(isExport ? row.exportRate || row.importRate : row.importRate || row.exportRate) || null,
    ]),
  );
}

function pricedLines(lines, head, gstCharges, rates) {
  const priced = [];
  (lines || []).forEach((line, index) => {
    if (!line || (!line.chargeId && !clean(line.head))) return;
    const charge = gstCharges.get(numOrNull(line.chargeId));
    if (!charge) {
      throw new BadRequestError(
        `Line ${index + 1}: pick the charge from the GST Charges list ("${line.head || ''}" is not in it)`,
      );
    }
    if (!(numOrNull(line.sellRate) > 0) && !(numOrNull(line.minSell) > 0)) {
      throw new BadRequestError(`Line ${index + 1} (${charge.chargeName}): give the sell rate`);
    }
    priced.push({
      ...workOutLine(line, head, rates),
      chargeId: charge.id,
      head: charge.chargeName,
      sacCode: charge.sacCode || null,
      gstRate: charge.gstRate == null ? null : Number(charge.gstRate),
      section: CHARGE_SECTIONS.some((section) => section[0] === upper(line.section)) ? upper(line.section) : 'OTHER',
      vendor: clean(line.vendor),
      remarks: clean(line.remarks),
      sortOrder: index,
    });
  });
  return priced;
}

async function insertLine(quotationId, line, transaction) {
  await x(
    `INSERT INTO QuotationCharges (quotationId, head, chargeId, sacCode, gstRate, section, basis, qty, currency, roe, buyRate, sellRate,
      minBuy, minSell, buyAmount, sellAmount, buyInr, sellInr, vendor, remarks, sortOrder, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      quotationId,
      line.head,
      line.chargeId,
      line.sacCode,
      line.gstRate,
      line.section,
      line.basis,
      line.qty,
      line.currency,
      line.roe,
      line.buyRate,
      line.sellRate,
      line.minBuy,
      line.minSell,
      line.buyAmount,
      line.sellAmount,
      line.buyInr,
      line.sellInr,
      line.vendor,
      line.remarks,
      line.sortOrder,
      dbNow(),
      dbNow(),
    ],
    transaction,
  );
}

/** Replaces the quotation's charge lines (each checked against Accounts > GST Charges) and stores its totals and margin. */
export async function saveQuotationLines(quotationId, head, lines, transaction) {
  const gstCharges = new Map(
    (await queryOrEmpty('SELECT id, chargeName, sacCode, gstRate FROM AccGstCharges', [], transaction)).map(
      (charge) => [charge.id, charge],
    ),
  );
  const rates = await currencyRates(head.serviceType);
  const priced = pricedLines(lines, head, gstCharges, rates);
  await x('DELETE FROM QuotationCharges WHERE quotationId = ?', [quotationId], transaction);
  for (const line of priced) await insertLine(quotationId, line, transaction);
  const sell = round2(priced.reduce((sum, line) => sum + line.sellInr, 0));
  const buy = round2(priced.reduce((sum, line) => sum + line.buyInr, 0));
  const margin = round2(sell - buy);
  await x(
    'UPDATE Quotations SET totalSellInr = ?, totalBuyInr = ?, marginInr = ?, marginPct = ? WHERE id = ?',
    [sell, buy, margin, sell ? round2((PERCENT * margin) / sell) : null, quotationId],
    transaction,
  );
  return { sell, buy, margin, lines: priced.length };
}
