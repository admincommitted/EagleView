// 04-Nov-2026: iCAFFE voucher extras shared by the voucher screens -
//   AttachDocs - supporting documents on a voucher (before save they sit under a draft key and move to the voucher on save)
//   readExcel / ExcelButtons - "Read Excel": fill the grid from a sheet; "Sample" downloads the columns it expects
import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Upload, Trash2, FileSpreadsheet, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { T, api, Box, Btn, fmtDate } from './ui';

export const newDraftKey = () => 'acc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

// ------------------------------------------------------------------ attachments
export function AttachDocs({ voucherId, draftKey, compact }) {
  const [rows, setRows] = useState([]); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const [type, setType] = useState('SUPPORTING');
  const input = useRef(null);
  const qs = voucherId ? 'voucherId=' + voucherId : draftKey ? 'draftKey=' + encodeURIComponent(draftKey) : '';
  const load = () => { if (qs) api('/api/vouchers/documents?' + qs).then(r => setRows(r.data || [])).catch(() => setRows([])); };
  useEffect(() => { setRows([]); load(); }, [qs]);
  // another part of the screen (e.g. OCR of the bill) attached a file
  useEffect(() => { const f = () => load(); window.addEventListener('acc-docs-changed', f); return () => window.removeEventListener('acc-docs-changed', f); }, [qs]);
  const upload = async (files) => {
    if (!files || !files.length || !qs) return;
    setBusy(true); setMsg('');
    try {
      const fd = new FormData(); [...files].forEach(f => fd.append('files', f));
      if (voucherId) fd.append('voucherId', voucherId); else fd.append('draftKey', draftKey);
      fd.append('documentType', type);
      const r = await fetch('/api/vouchers/documents', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(j.error || 'HTTP ' + r.status);
      setMsg((j.data || []).length + ' file' + ((j.data || []).length === 1 ? '' : 's') + ' attached'); load();
    } catch (e) { setMsg('Not attached: ' + e.message); }
    setBusy(false); if (input.current) input.current.value = '';
  };
  const del = async (d) => {
    if (!window.confirm('Remove ' + d.originalName + '?')) return;
    try { await api('/api/vouchers/documents/' + d.id, { method: 'DELETE' }); load(); } catch (e) { setMsg('Not removed: ' + e.message); }
  };
  if (!qs) return null;
  return (
    <Box title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Paperclip size={12} /> Attached documents ({rows.length})</span>}
      right={<>
        <select value={type} onChange={e => setType(e.target.value)} style={{ height: 24, fontSize: 11, border: `1px solid ${T.headBorder}`, borderRadius: 4, background: '#fff', color: T.head }}>
          {['SUPPORTING', 'VENDOR BILL', 'BANK ADVICE', 'CHALLAN', 'APPROVAL', 'OTHER'].map(t => <option key={t}>{t}</option>)}
        </select>
        <Btn small kind="ghost" onClick={() => input.current && input.current.click()} disabled={busy}><Upload size={11} /> {busy ? 'Attaching' : 'Attach files'}</Btn>
        <input ref={input} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={e => upload(e.target.files)} />
      </>}>
      <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: compact ? 0 : 28, alignItems: 'center' }}>
        {rows.map(d => (
          <div key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', border: `1px solid ${T.headBorder}`, borderRadius: 6, background: '#fff', fontSize: 11.5, maxWidth: 340 }}>
            {/^image\//.test(d.mimeType || '') ? <ImageIcon size={13} color={T.head} /> : <FileText size={13} color={T.head} />}
            <a href={d.filePath} target="_blank" rel="noreferrer" style={{ color: T.head, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }} title={d.originalName}>{d.originalName}</a>
            <span style={{ color: T.muted, fontSize: 10 }}>{d.documentType !== 'SUPPORTING' ? d.documentType + ' - ' : ''}{kb(d.size || 0)}{d.uploadedByName ? ' - ' + d.uploadedByName : ''}{d.createdAt ? ', ' + fmtDate(d.createdAt) : ''}</span>
            <span onClick={() => del(d)} style={{ cursor: 'pointer', color: T.dr, display: 'inline-flex' }} title="Remove"><Trash2 size={12} /></span>
          </div>
        ))}
        {!rows.length && <span style={{ fontSize: 11, color: T.muted }}>{voucherId ? 'No documents yet.' : 'Files attached now are kept with the voucher when you Save.'} Drop files here or use Attach files - PDF, image, Word, Excel, up to 10 MB each.</span>}
        {msg && <span style={{ fontSize: 11, fontWeight: 700, color: /^Not/.test(msg) ? T.dr : T.cr }}>{msg}</span>}
      </div>
    </Box>
  );
}
// files parked under a draft key move to the voucher once it is saved
export const claimDocs = (draftKey, voucherId) => (draftKey && voucherId
  ? fetch('/api/vouchers/documents/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftKey, voucherId }) }).catch(() => null)
  : Promise.resolve(null));

// ------------------------------------------------------------------ Read Excel
const keyOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%]/g, '');
// Excel keeps a date as a day number (1 = 1-Jan-1900); converting it ourselves avoids the time-zone shift of JS dates
const isoOf = (v) => {
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const t = String(v || '').trim(); if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return t;
};
// cols: [{ key, label, aliases: [], date: bool }] -> rows of { key: value } (first sheet, header row = first row with 2+ known columns)
export async function readExcel(file, cols) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  const want = cols.map(c => ({ ...c, keys: [c.label, c.key, ...(c.aliases || [])].map(keyOf) }));
  let hr = -1; let map = {};
  for (let i = 0; i < Math.min(grid.length, 15) && hr < 0; i++) {
    const m = {}; (grid[i] || []).forEach((h, j) => { const c = want.find(w => w.keys.includes(keyOf(h))); if (c && m[c.key] == null) m[c.key] = j; });
    if (Object.keys(m).length >= 2) { hr = i; map = m; }
  }
  if (hr < 0) throw new Error('No header row found - the first row should have the column names of the sample (' + cols.map(c => c.label).join(', ') + ')');
  const out = [];
  for (let i = hr + 1; i < grid.length; i++) {
    const r = grid[i] || []; if (!r.some(v => String(v).trim() !== '')) continue;
    const o = { _row: i + 1 }; want.forEach(c => { const v = map[c.key] != null ? r[map[c.key]] : ''; o[c.key] = c.date ? isoOf(v) : v instanceof Date ? isoOf(v) : String(v ?? '').trim(); });
    out.push(o);
  }
  return out;
}
export async function sampleExcel(name, cols, example) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([cols.map(c => c.label), ...(example || [])]);
  ws['!cols'] = cols.map(c => ({ wch: Math.max(12, c.label.length + 2) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Lines');
  XLSX.writeFile(wb, name + '.xlsx');
}
// match a name in the sheet to a ledger: exact name (any case), then a unique "starts with"
export const ledgerByName = (list, name) => {
  const n = String(name || '').trim().toLowerCase(); if (!n) return null;
  const exact = list.find(l => String(l.name).trim().toLowerCase() === n); if (exact) return exact;
  const starts = list.filter(l => String(l.name).trim().toLowerCase().startsWith(n));
  return starts.length === 1 ? starts[0] : null;
};
export function ExcelButtons({ onFile, onSample, label = 'Read Excel' }) {
  const input = useRef(null);
  return (
    <>
      <Btn kind="plain" onClick={() => input.current && input.current.click()}><FileSpreadsheet size={13} /> {label}</Btn>
      <Btn kind="ghost" onClick={onSample} title="Download the Excel with the columns Read Excel expects"><Download size={12} /> Sample</Btn>
      <input ref={input} type="file" hidden accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); e.target.value = ''; }} />
    </>
  );
}
