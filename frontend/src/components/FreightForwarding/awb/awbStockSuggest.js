// AWB number box suggestions (29-Oct-2026). Before, the list came from the whole stock of every airline and was matched
// only on the typed digits, so 176-... showed unused numbers of other airlines too. Now: only the airline prefix typed in
// the first box, serial starting with what is typed, numbers already on a live AWB left out, newest request wins.
let lastReq = 0;

export function loadStockSuggest(prefix, typed, setList, setShow) {
  const my = ++lastReq;
  const p = String(prefix || '').trim();
  if (!/^\d{3}$/.test(p)) { setList([]); setShow(false); return; }
  const q = String(typed || '').replace(/\D/g, '');
  fetch(`/api/stock/list?status=AVAILABLE&prefix=${p}&unused=1&order=seq&limit=50${q ? `&suffix=${q}` : ''}`)
    .then((r) => r.json())
    .catch(() => [])
    .then((rows) => {
      if (my !== lastReq) return; // an older answer arrived after a newer one
      const list = (Array.isArray(rows) ? rows : [])
        .filter((s) => s.fullAwbNumber && s.fullAwbNumber.startsWith(p) && s.fullAwbNumber.slice(3).startsWith(q))
        .map((s) => ({
          awbNumber: `${s.fullAwbNumber.slice(0, 3)}-${s.fullAwbNumber.slice(3)}`,
          status: 'AVAILABLE STOCK', shipperName: 'UNUSED', consigneeName: 'READY TO USE', origin: '', destination: '',
        }));
      setList(list);
      setShow(list.length > 0);
    });
}
