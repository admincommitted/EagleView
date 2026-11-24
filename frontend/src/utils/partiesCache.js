// 09-Nov-2026: the full Party master list (/api/masters/parties, ~28,000 parties with their addresses - about 50 MB
// of JSON) was fetched twice each time the Import job screen opened (JobContext + Job Header), and again on every
// visit: the browser spent seconds reading it while the page waited. One shared copy now, kept for 2 minutes, in the
// compact form (no null values / timestamps, routes/masters.js ?compact=1).
let cache = null; // { at, promise }
const TTL = 120000;
const rows = (d) => (Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []));
export function getParties() {
  if (cache && Date.now() - cache.at < TTL) return cache.promise;
  const promise = fetch('/api/masters/parties?compact=1').then(r => r.json()).then(rows).catch((e) => { cache = null; throw e; });
  cache = { at: Date.now(), promise };
  return promise;
}
// call after a party is added / changed so the next screen reads the new list
export function clearPartiesCache() { cache = null; }
// a party saved anywhere (Party Master, Add Party, KYC...) through fetch clears it too - the same rule the backend
// uses for its own copy (routes/masters.js: any non-GET call on a party / KYC path)
if (typeof window !== 'undefined' && window.fetch && !window.fetch.__partiesCache) {
  const orig = window.fetch.bind(window);
  const wrapped = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (method !== 'GET' && /\/api\/masters\/.*(part|kyc)/i.test(url)) cache = null;
    } catch (e) { /* never block a request */ }
    return orig(input, init);
  };
  wrapped.__partiesCache = true;
  window.fetch = wrapped;
}
