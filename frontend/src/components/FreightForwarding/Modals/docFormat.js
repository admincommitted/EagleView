const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;
export const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const dmy = (value) => {
  const match = ISO_DAY.exec(String(value || ''));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : (value || '');
};
export const dMonY = (value) => {
  const match = ISO_DAY.exec(String(value || ''));
  return match ? `${match[3]}-${MON[Number(match[2]) - 1]}-${match[1]}` : (value || '');
};
export const kg = (value) => (value || value === 0 ? (Number(value) || 0).toFixed(2) : '');
export const money = (value) => (Number(value) ? Number(value).toFixed(2) : '');
export const joinFilled = (parts, separator = ' - ') => parts.filter(Boolean).join(separator);

// what a document shows when the AWB is not saved yet (blank form)
export const EMPTY_DOC = {
  awbNo: '', mawbNo: '', hawbNo: '', date: '', airline: { name: '', code: '', prefix: '' }, flights: [], routing: [], origin: { code: '', name: '', country: '' },
  destination: { code: '', name: '', country: '' }, shipper: {}, consignee: {}, notify: null, shipperBlock: '', consigneeBlock: '', notifyBlock: '', agent: {},
  pieces: '', gross: '', chargeable: '', volume: '', lines: [], dims: [], dimsText: '', goods: '', hsCodes: [], shc: [], handling: '', ssr: '', osi: '', sci: '',
  currency: '', chargeCode: '', declared: {}, charges: { other: [] }, executed: {}, houses: [], company: {}, user: '', today: new Date().toISOString().slice(0, 10),
};

export const flightText = (doc) => (doc.flights || []).map((flight) => `${flight.flight}${flight.date ? ' / ' + dmy(flight.date) : ''}`).join(', ');
export const airportText = (airport) => (airport && airport.code ? `${airport.code}${airport.name ? ' - ' + airport.name : ''}` : '');
export const isPrepaid = (doc) => /^P/i.test(doc.chargeCode || '') || !doc.chargeCode;
export const routeText = (doc) => joinFilled([doc.origin.code, doc.destination.code]);
export const firstLine = (text) => String(text || '').split('\n')[0];
export const placeAndDate = (doc) => `${doc.executed.place || doc.company.city || ''} ${dmy(doc.today)}`;

// a failed call: the server's { error } when it answered, else the network message
export const failText = (error, fallback) => (error.response ? error.response.data?.error || fallback : error.message);
