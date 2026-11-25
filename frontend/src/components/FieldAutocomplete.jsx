import { Input } from '@/components/ui';
import CustomAutocomplete from './CustomAutocomplete';

const firstBranchCity = (branchesJson) => {
  try {
    const branches = JSON.parse(branchesJson);
    return branches?.length > 0 ? branches[0].city : '';
  } catch {
    return '';
  }
};

// one option per airport code, the one with the fullest name
const airportOptions = (airports) => {
  const byCode = new Map();
  airports.forEach((airport) => {
    const code = airport.iataCode || airport.code;
    if (!code) return;
    const subtitle = `${airport.cityName || airport.name} - ${airport.airportName || airport.name}`;
    if (!byCode.has(code) || subtitle.length > byCode.get(code).subtitle.length) {
      byCode.set(code, { title: code, subtitle, searchKey: airport.cityName || airport.name, countryCode: airport.countryCode || airport.country || '' });
    }
  });
  return Array.from(byCode.values());
};

const LISTS = {
  airport: { url: '/locations/airports', toOptions: airportOptions },
  city: {
    url: '/locations/cities',
    toOptions: (cities) => cities.map((city) => ({ title: city.cityName, subtitle: city.iataCode || '', searchKey: city.cityName })),
  },
  state: {
    url: '/locations/states',
    toOptions: (states) => states.map((state) => ({ title: state.stateCode, subtitle: state.stateName, searchKey: state.stateName })),
  },
  'airline-code': {
    url: '/masters/airlines',
    toOptions: (airlines) => airlines.map((airline) => ({ title: airline.code2 || airline.code, subtitle: airline.name, searchKey: airline.name })),
  },
  'airline-name': {
    url: '/masters/airlines',
    toOptions: (airlines) => airlines.map((airline) => ({
      title: airline.name,
      subtitle: `${airline.code2 || airline.code} - ${airline.prefix}`,
      searchKey: airline.code2 || airline.code,
    })),
  },
  'awb-stock': {
    url: ({ airlinePrefix }) => (airlinePrefix?.length >= 3 ? `/stock/list?prefix=${airlinePrefix}&status=AVAILABLE` : null),
    toOptions: (stock) => stock.map((awb) => ({ title: `${awb.sequenceNumber}${awb.checkDigit}`, searchKey: `${awb.sequenceNumber}${awb.checkDigit}` })),
  },
  'hawb-stock': {
    url: '/stock/hawb/list?status=AVAILABLE',
    toOptions: (stock) => stock.map((hawb) => ({ title: hawb.fullHawbNumber, searchKey: hawb.fullHawbNumber })),
  },
  'awb-existing': {
    url: '/awb/list',
    toOptions: (waybills) => waybills.map((awb) => ({
      title: awb.hawbNumber ? awb.hawbNumber : awb.awbNumber,
      subtitle: awb.type + (awb.hawbNumber ? ` (Master: ${awb.awbNumber})` : ''),
      searchKey: awb.hawbNumber ? awb.hawbNumber : awb.awbNumber,
    })),
  },
  currency: {
    url: '/masters/currencies',
    toOptions: (currencies) => currencies.map((currency) => ({
      title: currency.currencyCode || currency.code,
      subtitle: currency.currencyName || currency.name,
      searchKey: currency.currencyName || currency.name,
    })),
  },
  country: {
    url: '/masters/countries',
    toOptions: (countries) => countries.map((country) => ({ title: country.code, subtitle: country.name, searchKey: country.name })),
  },
  charge: {
    url: '/masters/charges',
    toOptions: (charges) => charges.filter((charge) => charge.isActive !== false).map((charge) => ({
      title: charge.awbChargeCode || charge.code,
      subtitle: charge.awbChargeName || charge.name,
      searchKey: charge.awbChargeName || charge.name,
    })),
  },
  sph: {
    url: '/masters/specialhandlingcodes',
    toOptions: (codes) => codes.map((code) => ({ title: code.code, subtitle: code.description, searchKey: code.description })),
  },
  'iata-agent': {
    url: '/masters/iataagents',
    toOptions: (agents) => agents.map((agent) => ({
      title: agent.name,
      subtitle: agent.iataCode,
      iataCode: agent.iataCode,
      place: firstBranchCity(agent.branches),
      searchKey: agent.name,
    })),
  },
  party: {
    url: '/masters/parties',
    toOptions: (parties) => parties.map((party) => ({ ...party, title: party.name, subtitle: party.city, searchKey: party.name })),
  },
};

const MUST_PICK_FROM_LIST = ['airport', 'airline-code', 'currency', 'country'];

export default function FieldAutocomplete({ listType, ...props }) {
  const list = LISTS[listType];
  if (!list) return <Input {...props} />;
  const fetchUrl = typeof list.url === 'function' ? list.url(props) : list.url;
  return (
    <CustomAutocomplete
      fetchUrl={fetchUrl}
      mapData={list.toOptions}
      enforceSelection={MUST_PICK_FROM_LIST.includes(listType)}
      {...props}
    />
  );
}
