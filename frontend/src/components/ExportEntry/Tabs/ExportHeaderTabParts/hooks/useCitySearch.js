import { useRef, useState } from 'react';
import { exportEntryApi } from '../../../exportEntryApi';

const SEARCH_DELAY_MS = 250;
const MIN_LETTERS = 2;

const distinctCities = (answer) => {
  const seen = new Set();
  return (Array.isArray(answer) ? answer : answer?.data || []).filter((city) => {
    const name = String(city?.cityName || '').toUpperCase();
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
};

// the City master is far too big to load: up to 50 cities matching the typed text are asked for
export default function useCitySearch() {
  const [cities, setCities] = useState([]);
  const latestRequest = useRef(0);

  const searchCities = (typed) => {
    const query = String(typed || '').trim();
    if (query.length < MIN_LETTERS) { setCities([]); return; }
    const request = ++latestRequest.current;
    setTimeout(async () => {
      if (request !== latestRequest.current) return;
      try {
        const answer = await exportEntryApi.headerCities(query);
        if (request === latestRequest.current) setCities(distinctCities(answer));
      } catch {
        // the box keeps working as a plain text box
      }
    }, SEARCH_DELAY_MS);
  };

  return { cities, searchCities };
}
