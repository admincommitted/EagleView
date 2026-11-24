// 09-Nov-2026: small master lists (countries, currencies, UQCs, states, ports, scheme codes, airlines, IATA agents)
// were fetched again by every part of a screen - the Import job screen asked for countries and currencies 3 times on
// each open. One shared answer per list now, kept for 2 minutes; a save in any master (any non-GET call on
// /api/masters/...) drops the kept answers so the next screen reads the new list. The master forms themselves still
// read the list fresh.
const TTL = 120000;
const kept = new Map(); // url -> { at, promise }
export function getMaster(url) {
  const k = kept.get(url);
  if (k && Date.now() - k.at < TTL) return k.promise.then(d => (Array.isArray(d) ? d.slice() : d));
  const promise = fetch(url).then(r => r.json());
  promise.catch(() => kept.delete(url));
  kept.set(url, { at: Date.now(), promise });
  return promise.then(d => (Array.isArray(d) ? d.slice() : d));
}
export function clearMasterCache() { kept.clear(); }
if (typeof window !== 'undefined' && window.fetch && !window.fetch.__masterCache) {
  const orig = window.fetch.bind(window);
  const wrapped = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (method !== 'GET' && /\/api\/(masters|locations)\//i.test(url)) kept.clear();
    } catch (e) { /* never block a request */ }
    return orig(input, init);
  };
  wrapped.__masterCache = true;
  if (window.fetch.__partiesCache) wrapped.__partiesCache = true;
  window.fetch = wrapped;
}
