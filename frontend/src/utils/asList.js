// A list field of a saved job can come back as JSON text ('[]', '[{...}]') - 12-Nov-2026. Opening an item of a
// reopened job crashed the whole app ("old.find is not a function"), so did the Supporting Docs window and
// Duplicate Item. Every screen that walks such a list takes it through asList.
export const asList = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('[')) { try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  }
  return [];
};

// the list fields of an export item
export const ITEM_LISTS = ['swInfos', 'swStatements', 'reExports', 'eSanchitList', 'supportDocs', 'cessRows', 'constRows', 'prodRows', 'ctrlRows'];
export const withItemLists = (it) => {
  if (!it || typeof it !== 'object') return it;
  const out = { ...it };
  ITEM_LISTS.forEach((k) => { if (out[k] !== undefined && out[k] !== null && !Array.isArray(out[k])) out[k] = asList(out[k]); });
  return out;
};
