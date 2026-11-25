// The full Party master list (~28,000 parties with their addresses) is big, and several screens need it. One shared
// copy, kept for 2 minutes, in the compact form (no null values / timestamps, routes/masters.js ?compact=1).
import axiosInstance from '@/services/axiosInstance';

const KEEP_MS = 120000;
let cache = null; // { at, promise }

const rows = (data) => (Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));

// answers like fetch did: an error status still gives the server's body (read as no parties); 401 is left to
// axiosInstance (log out). A failed answer is not kept.
async function loadParties(entry) {
  try {
    const response = await axiosInstance.get('/masters/parties', { params: { compact: 1 }, validateStatus: (status) => status !== 401 });
    if (response.status >= 400 && cache === entry) cache = null;
    return rows(response.data);
  } catch (error) {
    if (cache === entry) cache = null;
    throw error;
  }
}

export function getParties() {
  if (cache && Date.now() - cache.at < KEEP_MS) return cache.promise;
  const entry = { at: Date.now() };
  entry.promise = loadParties(entry);
  cache = entry;
  return entry.promise;
}

// call after a party is added / changed so the next screen reads the new list
export function clearPartiesCache() { cache = null; }

// a party saved anywhere (Party Master, Add Party, KYC...) clears it too - the same rule the backend uses for its own
// copy (routes/masters.js: any non-GET call on a party / KYC path)
const isPartySave = (method, url) => String(method || 'GET').toUpperCase() !== 'GET' && /(^|\/api)\/masters\/.*(part|kyc)/i.test(url);

axiosInstance.interceptors.request.use((config) => {
  if (isPartySave(config.method, config.url)) cache = null;
  return config;
});

// screens that still save parties through window.fetch
if (typeof window !== 'undefined' && window.fetch && !window.fetch.__partiesCache) {
  const nativeFetch = window.fetch.bind(window);
  const watchedFetch = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (isPartySave(init?.method || input?.method, url)) cache = null;
    } catch {
      // never block a request
    }
    return nativeFetch(input, init);
  };
  watchedFetch.__partiesCache = true;
  window.fetch = watchedFetch;
}
