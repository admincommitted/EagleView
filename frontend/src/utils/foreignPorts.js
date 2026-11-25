// Foreign port codes (UN/LOCODE - AEJEA, CNSHA, USNYC ...) for the foreign port boxes of import and export jobs, sea and
// air. About 45,000 rows, so the list is read once per page load and shared.
import axiosInstance from '@/services/axiosInstance';

let cache = null;

async function readForeignPorts() {
  try {
    const { data: rows } = await axiosInstance.get('/locations/foreign-ports');
    return (Array.isArray(rows) ? rows : []).map(([portCode, portName, countryCode]) => ({ portCode, portName, countryCode, category: 'PORT' }));
  } catch {
    cache = null;
    return [];
  }
}

export function loadForeignPorts() {
  if (!cache) cache = readForeignPorts();
  return cache;
}
