import { Airline, AwbStock, HawbStock } from '../../../../models/index.js';
import { findLiveRecordWithNumber } from './awbNumbers.js';

const STOCK_TAKEN_STATUSES = ['USED', 'VOID'];
const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{2}\d/;

const stockNumberOf = (awbNumber) =>
  String(awbNumber || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const isTakenInStock = (stockRow) => STOCK_TAKEN_STATUSES.includes(String(stockRow.status || '').toUpperCase());

/**
 * The airline of the AWB number (its 3-digit prefix) and the first carrier / first flight should match - e.g. a 157
 * (Qatar Airways, QR) AWB with first carrier VS is usually a wrong prefix or carrier. It can be right (interline, the
 * first leg on another airline), so it is a warning: saved after the operator says so (_carrierOk).
 */
export async function carrierWarning(type, awbNumber, formData) {
  if (type === 'HAWB') return '';
  const digits = String(awbNumber || '').replace(/\D/g, '');
  if (digits.length < 3) return '';
  const airline = await Airline.findOne({ where: { prefix: digits.slice(0, 3) } }).catch(() => null);
  const airlineCode = String((airline && airline.code2) || '')
    .trim()
    .toUpperCase();
  if (!airlineCode) return '';

  const firstCarrier = String((formData && formData.by1) || '')
    .trim()
    .toUpperCase();
  const firstFlight = String((formData && (formData.flightNumber1 || formData.flight1)) || '')
    .replace(/\s+/g, '')
    .toUpperCase();
  const flightAirline = firstFlight.slice(0, 2);
  const isFlightNumber = firstFlight && FLIGHT_NUMBER_PATTERN.test(firstFlight);

  const mismatches = [];
  if (firstCarrier && firstCarrier !== airlineCode) mismatches.push(`first carrier (By 1) is ${firstCarrier}`);
  if (isFlightNumber && flightAirline !== airlineCode && flightAirline !== firstCarrier)
    mismatches.push(`first flight is ${firstFlight}`);
  else if (isFlightNumber && flightAirline !== airlineCode && !firstCarrier)
    mismatches.push(`first flight is ${firstFlight}`);

  if (!mismatches.length) return '';
  return (
    `AWB ${digits.slice(0, 3)} is an AWB of ${airline.name} (${airlineCode}), but the ${mismatches.join(' and the ')}` +
    ' - check the AWB prefix or the carrier.'
  );
}

/**
 * The airline's AWB number should come from the AWB stock (Stock Master). A number that is not in the stock, or is
 * already USED / VOID there, is saved only after the operator says so (_stockOk). HAWB: only a number marked USED /
 * VOID in the HAWB stock is asked about (house numbers are often not kept in a stock).
 */
export async function stockWarning(type, awbNumber) {
  const stockNumber = stockNumberOf(awbNumber);
  if (!stockNumber) return '';
  if (type === 'HAWB') {
    const houseStock = await HawbStock.findOne({ where: { fullHawbNumber: stockNumber } }).catch(() => null);
    return houseStock && isTakenInStock(houseStock)
      ? `HAWB ${awbNumber} is marked ${houseStock.status} in the HAWB stock.`
      : '';
  }
  const stock = await AwbStock.findOne({ where: { fullAwbNumber: stockNumber } });
  if (stock && isTakenInStock(stock)) {
    return `AWB ${awbNumber} is marked ${stock.status} in the AWB stock (Stock Master) - it may already be used.`;
  }
  if (stock) return '';
  const prefix = stockNumber.slice(0, 3);
  const airlineStockCount = await AwbStock.count({ where: { airlinePrefix: prefix } });
  return airlineStockCount
    ? `AWB ${awbNumber} is not in the AWB stock of airline ${prefix} (Stock Master) - check the number given by the airline.`
    : `No AWB stock is entered for airline ${prefix} (Stock Master), so this number cannot be checked.`;
}

/** A voided AWB / HAWB number goes back to AVAILABLE in its stock when no live record uses it any more. */
export async function releaseStock(type, awbNumber, Model) {
  try {
    const stockNumber = stockNumberOf(awbNumber);
    if (!stockNumber || (await findLiveRecordWithNumber(Model, awbNumber, type))) return;
    if (type === 'HAWB') {
      await HawbStock.update({ status: 'AVAILABLE' }, { where: { fullHawbNumber: stockNumber, status: 'USED' } });
    } else {
      await AwbStock.update({ status: 'AVAILABLE' }, { where: { fullAwbNumber: stockNumber, status: 'USED' } });
    }
  } catch (error) {
    console.warn('[AWB void] stock:', error.message);
  }
}
