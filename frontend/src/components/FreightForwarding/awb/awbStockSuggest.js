import { freightApi } from '../freightApi';

// AWB number box suggestions: only the airline prefix typed in the first box, serial starting with what is typed,
// numbers already on a live AWB left out; the newest request wins.
let latestRequest = 0;

const SUGGESTION_LIMIT = 50;

const toSuggestion = (stock) => ({
  awbNumber: `${stock.fullAwbNumber.slice(0, 3)}-${stock.fullAwbNumber.slice(3)}`,
  status: 'AVAILABLE STOCK',
  shipperName: 'UNUSED',
  consigneeName: 'READY TO USE',
  origin: '',
  destination: '',
});

export async function loadStockSuggest(prefix, typed, setList, setShow) {
  const request = ++latestRequest;
  const airlinePrefix = String(prefix || '').trim();
  if (!/^\d{3}$/.test(airlinePrefix)) { setList([]); setShow(false); return; }
  const serialStart = String(typed || '').replace(/\D/g, '');
  let rows = [];
  try {
    rows = await freightApi.awbStockSuggestions({
      status: 'AVAILABLE', prefix: airlinePrefix, unused: 1, order: 'seq', limit: SUGGESTION_LIMIT,
      ...(serialStart ? { suffix: serialStart } : {}),
    });
  } catch {
    rows = [];
  }
  if (request !== latestRequest) return;
  const list = (Array.isArray(rows) ? rows : [])
    .filter((stock) => stock.fullAwbNumber && stock.fullAwbNumber.startsWith(airlinePrefix) && stock.fullAwbNumber.slice(3).startsWith(serialStart))
    .map(toSuggestion);
  setList(list);
  setShow(list.length > 0);
}
