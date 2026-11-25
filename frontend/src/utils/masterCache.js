// Small master lists (countries, currencies, UQCs, states, ports, scheme codes, airlines, IATA agents) are read by
// many parts of a screen. One shared answer per list, kept for 2 minutes; a save in any master (any non-GET call on
// /masters/... or /locations/...) drops the kept answers so the next screen reads the new list. The master forms
// themselves still read the list fresh.
import axiosInstance from '@/services/axiosInstance';

const KEEP_MS = 120000;
const kept = new Map(); // path -> { at, promise }

// older callers still put the '/api' prefix in front of '/masters/x'; it is the same list
const apiPath = (url) => String(url).replace(/^\/api(?=\/)/, '');
const copyOf = (data) => (Array.isArray(data) ? data.slice() : data);
const forget = (path, entry) => { if (kept.get(path) === entry) kept.delete(path); };

// answers like fetch did: an error status still gives the server's body ({ success: false, error }); 401 is left to
// axiosInstance (log out). A failed answer is not kept.
async function loadMaster(path, entry) {
  try {
    const response = await axiosInstance.get(path, { validateStatus: (status) => status !== 401 });
    if (response.status >= 400) forget(path, entry);
    return response.data;
  } catch (error) {
    forget(path, entry);
    throw error;
  }
}

export async function getMaster(url) {
  const path = apiPath(url);
  let entry = kept.get(path);
  if (!entry || Date.now() - entry.at >= KEEP_MS) {
    entry = { at: Date.now() };
    entry.promise = loadMaster(path, entry);
    kept.set(path, entry);
  }
  return copyOf(await entry.promise);
}

export function clearMasterCache() { kept.clear(); }

const isMasterSave = (method, url) => String(method || 'GET').toUpperCase() !== 'GET' && /(^|\/api)\/(masters|locations)\//i.test(url);

axiosInstance.interceptors.request.use((config) => {
  if (isMasterSave(config.method, config.url)) kept.clear();
  return config;
});

// screens that still save masters through window.fetch
if (typeof window !== 'undefined' && window.fetch && !window.fetch.__masterCache) {
  const nativeFetch = window.fetch.bind(window);
  const watchedFetch = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (isMasterSave(init?.method || input?.method, url)) kept.clear();
    } catch {
      // never block a request
    }
    return nativeFetch(input, init);
  };
  watchedFetch.__masterCache = true;
  if (window.fetch.__partiesCache) watchedFetch.__partiesCache = true;
  window.fetch = watchedFetch;
}
