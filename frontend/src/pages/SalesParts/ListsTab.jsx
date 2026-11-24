// Sales > Lists: the pick lists used on customers and enquiries (industries, sources, competitors, lost reasons,
// departments, commodities). A value in use is switched off, not deleted. 11-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { api, C, inp, btn } from './salesUi';

const NAMES = { INDUSTRY: 'Industries', SOURCE: 'Lead sources', COMPETITOR: 'Competitors', LOST_REASON: 'Lost reasons', DEPARTMENT: 'Contact departments', COMMODITY: 'Commodities' };

function KindBox({ kind, rows, canManage, onChange }) {
  const [v, setV] = React.useState(''); const [edit, setEdit] = React.useState({});
  const add = async () => { try { await api('/lookups', { method: 'POST', body: { kind, value: v } }); setV(''); onChange(); } catch (e) { toast.error(e.message); } };
  const put = async (r, body) => { try { await api('/lookups/' + r.id, { method: 'PUT', body }); setEdit(o => ({ ...o, [r.id]: undefined })); onChange(); } catch (e) { toast.error(e.message); } };
  return (
    <section style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '6px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <h4 style={{ margin: 0, padding: '8px 12px', fontSize: '12.5px', color: C.head, borderBottom: '1px solid ' + C.line }}>{NAMES[kind] || kind} <span style={{ color: C.mute, fontWeight: 400 }}>({rows.filter(r => r.isActive).length})</span></h4>
      <div style={{ maxHeight: '320px', overflow: 'auto', padding: '4px 0' }}>
        {rows.length === 0 && <div style={{ padding: '6px 12px', fontSize: '12px', color: C.mute }}>Empty - add the first one below.</div>}
        {rows.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 12px', fontSize: '12px', opacity: r.isActive ? 1 : 0.5 }}>
            {edit[r.id] !== undefined
              ? <input style={{ ...inp, padding: '3px 6px' }} autoFocus value={edit[r.id]} onChange={e => setEdit(o => ({ ...o, [r.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') put(r, { value: edit[r.id] }); if (e.key === 'Escape') setEdit(o => ({ ...o, [r.id]: undefined })); }} onBlur={() => put(r, { value: edit[r.id] })} />
              : <span style={{ flex: 1, cursor: canManage ? 'text' : 'default', textDecoration: r.isActive ? 'none' : 'line-through' }} onClick={() => canManage && setEdit(o => ({ ...o, [r.id]: r.value }))} title={canManage ? 'Click to rename' : ''}>{r.value}</span>}
            {canManage && edit[r.id] === undefined && <button type="button" style={{ ...btn('ghost'), padding: '1px 6px', fontSize: '11px' }} onClick={() => put(r, { isActive: !r.isActive })}>{r.isActive ? 'Switch off' : 'Switch on'}</button>}
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', borderTop: '1px solid ' + C.line, marginTop: 'auto' }}>
          <input style={inp} value={v} placeholder="New value" onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) add(); }} />
          <button type="button" style={btn()} disabled={!v.trim()} onClick={add}><Plus size={12} /> Add</button>
        </div>
      )}
    </section>
  );
}

export default function ListsTab({ meta, reloadMeta }) {
  const kinds = meta.lookupKinds || Object.keys(NAMES);
  return (
    <div>
      <div style={{ fontSize: '12px', color: C.grey, marginBottom: '10px' }}>These lists fill the drop-downs on customers, contacts, lanes and (next) enquiries and quotations. Click a value to rename it; a value no longer used is switched off so old records keep it.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
        {kinds.map(k => <KindBox key={k} kind={k} rows={(meta.lookups || {})[k] || []} canManage={meta.canManage} onChange={reloadMeta} />)}
      </div>
    </div>
  );
}
