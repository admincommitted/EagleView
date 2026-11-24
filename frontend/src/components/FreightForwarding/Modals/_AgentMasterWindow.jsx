// Sub Agent / Overseas Agent master window (29-Oct-2026). Before, the list was 8 fixed sample names and "Save" did
// nothing. Now the agents come from and are saved to the Party master (flag isSubAgent / isOverseasAgent, address in
// the party's default branch), and "Use on this AWB" puts the agent into the AWB's Sub Agent / Overseas Agent party.
import React, { useEffect, useState } from 'react';
import { getParties } from '../../../utils/partiesCache'; // shared copy of the party list, 09-Nov-2026
import ModalFrame, { inp, lab, addBtn } from './_ModalFrame';

const EMPTY = { id: null, name: '', marketingPerson1: '', panNumber: '', street: '', address2: '', city: '', state: '', country: 'IN', zip: '', email: '', mobile: '', phone: '', gstin: '' };

export default function AgentMasterWindow({ isOpen, onClose, kind, setParties }) {
  const flag = kind === 'OVERSEAS' ? 'isOverseasAgent' : 'isSubAgent';
  const label = kind === 'OVERSEAS' ? 'Overseas Agent' : 'Sub Agent';
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const token = () => localStorage.getItem('token');
  const load = () => getParties().then(d => setList((Array.isArray(d) ? d : (d && d.data) || []).filter(p => p[flag]))).catch(() => setList([]));
  useEffect(() => { if (isOpen) { load(); setMsg(null); } }, [isOpen]);
  if (!isOpen) return null;

  const pick = (p) => {
    const b = (p.branches || []).find(x => x.isDefault) || (p.branches || [])[0] || {};
    setF({ ...EMPTY, id: p.id, name: p.name || '', marketingPerson1: p.marketingPerson1 || '', panNumber: p.panNumber || '', street: b.address1 || p.street || '', address2: b.address2 || '', city: b.city || p.city || '',
      state: b.state || p.stateProvince || '', country: b.country || p.countryCode || 'IN', zip: b.pinCode || p.zipPostcode || '', email: b.email1 || p.email || '', mobile: b.mobile || p.phoneNumber || '', phone: b.phone || '', gstin: b.regNo || '' });
    setMsg(null);
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const name = f.name.trim().toUpperCase();
    if (!name) return setMsg({ err: true, t: 'Name is required' });
    if (!f.street.trim() || !f.city.trim()) return setMsg({ err: true, t: 'Address line 1 and City are required' });
    if (!/^[A-Za-z]{2}$/.test(f.country.trim())) return setMsg({ err: true, t: 'Country must be a 2-letter code (IN, AE ...)' });
    if (f.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(f.panNumber.trim())) return setMsg({ err: true, t: 'PAN must be like ABCDE1234F' });
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setMsg({ err: true, t: 'Email is not valid' });
    const country = f.country.trim().toUpperCase();
    const body = { name, [flag]: true, partyType: 'MULTI', street: f.street.trim().toUpperCase().slice(0, 70), city: f.city.trim().toUpperCase().slice(0, 17), stateProvince: f.state.trim().toUpperCase(), countryCode: country,
      zipPostcode: f.zip.trim().toUpperCase().slice(0, 9), phoneNumber: f.mobile.trim(), email: f.email.trim(), panNumber: f.panNumber.trim().toUpperCase(), marketingPerson1: f.marketingPerson1.trim().toUpperCase(), iecNoReqd: false,
      branches: [{ branchSrNo: '1', branchName: 'HEAD OFFICE', isDefault: true, address1: f.street.trim().toUpperCase(), address2: f.address2.trim().toUpperCase(), city: f.city.trim().toUpperCase(), state: f.state.trim().toUpperCase(),
        country, pinCode: f.zip.trim().toUpperCase(), email1: f.email.trim(), mobile: f.mobile.trim(), phone: f.phone.trim(), regNo: f.gstin.trim().toUpperCase() }] };
    setBusy(true);
    try {
      const res = await fetch(f.id ? `/api/masters/parties/${f.id}` : '/api/masters/parties', { method: f.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || d.error || 'Save failed');
      const saved = (d && (d.data || d)) || {};
      setF(prev => ({ ...prev, id: prev.id || saved.id || null }));
      setMsg({ t: `${label} ${name} saved in Party Master` });
      load();
    } catch (e) { setMsg({ err: true, t: e.message }); } finally { setBusy(false); }
  };
  const useOnAwb = () => {
    if (!f.name.trim()) return setMsg({ err: true, t: 'Pick or enter an agent first' });
    setParties && setParties(p => ({ ...p, [label]: { name: f.name.trim().toUpperCase(), street: [f.street, f.address2].filter(Boolean).join(' ').trim().toUpperCase(), city: f.city.trim().toUpperCase(), state: f.state.trim().toUpperCase(),
      country: f.country.trim().toUpperCase(), zip: f.zip.trim(), phone: f.mobile.trim() || f.phone.trim(), email: f.email.trim(), gstin: f.gstin.trim().toUpperCase(), panNumber: f.panNumber.trim().toUpperCase(), partyId: f.id || undefined } }));
    onClose && onClose();
  };
  const shown = list.filter(p => !q || String(p.name || '').toUpperCase().includes(q.toUpperCase()));
  const F = (k, l, extra = {}) => <div><label style={lab}>{l}</label><input value={f[k]} onChange={set(k)} style={inp} {...extra} /></div>;

  return (
    <ModalFrame title={`${label} Master`} width={860} onClose={onClose} footer={msg ? <span style={{ color: msg.err ? '#dc2626' : '#166534', fontWeight: 700 }}>{msg.t}</span> : 'Saved in Party Master'}>
      <div style={{ display: 'flex', gap: '10px', minHeight: '360px' }}>
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input placeholder={`Search ${label.toLowerCase()}...`} value={q} onChange={e => setQ(e.target.value)} style={inp} />
          <button onClick={() => { setF(EMPTY); setMsg(null); }} style={{ ...inp, cursor: 'pointer', background: '#fff', fontWeight: 700 }}>+ New {label}</button>
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #cbd5e1', background: '#fff' }}>
            {shown.map(p => <div key={p.id} onClick={() => pick(p)} style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: p.id === f.id ? '#e0f2fe' : '#fff', fontSize: '12px' }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: '10px', color: '#64748b' }}>{[p.city, p.countryCode].filter(Boolean).join(', ')}</div></div>)}
            {shown.length === 0 && <div style={{ padding: '8px', fontSize: '11px', color: '#64748b' }}>No {label.toLowerCase()} in Party Master yet</div>}
          </div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignContent: 'start' }}>
          <div style={{ gridColumn: 'span 2' }}>{F('name', 'Name *')}</div>
          {F('marketingPerson1', 'Marketing Person')}{F('panNumber', 'PAN Number', { maxLength: 10 })}
          <div style={{ gridColumn: 'span 2' }}>{F('street', 'Address Line 1 *')}</div>
          <div style={{ gridColumn: 'span 2' }}>{F('address2', 'Address Line 2')}</div>
          {F('city', 'City *')}{F('state', 'State')}
          {F('country', 'Country (2 letters) *', { maxLength: 2 })}{F('zip', 'PIN / ZIP')}
          {F('email', 'Email')}{F('mobile', 'Mobile')}
          {F('phone', 'Phone')}{F('gstin', 'GST No')}
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={save} disabled={busy} style={addBtn}>{busy ? 'Saving...' : (f.id ? 'Update' : 'Save')}</button>
            <button onClick={useOnAwb} style={{ ...addBtn, backgroundColor: '#16a34a' }}>Use on this AWB</button>
          </div>
        </div>
      </div>
    </ModalFrame>
  );
}
