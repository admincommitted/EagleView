// 04-Nov-2026: foreign port codes (UN/LOCODE - AEJEA, CNSHA, USNYC ...) for the foreign port boxes of import and export
// jobs, sea and air. About 45,000 rows read from iCAFFE, so the list is fetched once per page load and shared.
let cache = null;

export function loadForeignPorts() {
  if (!cache) {
    cache = fetch('/api/locations/foreign-ports')
      .then(r => (r.ok ? r.json() : []))
      .then(rows => (Array.isArray(rows) ? rows : []).map(([portCode, portName, countryCode]) => ({ portCode, portName, countryCode, category: 'PORT' })))
      .catch(() => { cache = null; return []; });
  }
  return cache;
}
