import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// Customer shipment updates settings (29-Oct-2026). OFF until an admin switches it on.
// GET / PUT /api/awb/notify-settings (node-backend/utils/awbNotify.js)
const CODES = [['RCS', 'Received by airline'], ['DEP', 'Departed'], ['ARR', 'Arrived'], ['RCF', 'Received at destination'], ['NFD', 'Consignee notified'], ['DLV', 'Delivered'], ['FNA', 'Rejected (FNA)'], ['FMA', 'Accepted (FMA)'], ['FOH', 'Freight on hand'], ['TFD', 'Transferred']];
const row = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '3px 0' };

export default function CustomerUpdatesModal({ onClose }) {
  const [s, setS] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/awb/notify-settings').then((r) => r.json()).then((j) => { if (j.success) { setS(j.settings); setCanEdit(!!j.canEdit); } else setMsg('Error: ' + (j.error || 'could not load')); }).catch((e) => setMsg('Error: ' + e.message));
  }, []);
  const tog = (k) => setS((p) => ({ ...p, [k]: !p[k] }));
  const togCode = (c) => setS((p) => ({ ...p, milestones: p.milestones.includes(c) ? p.milestones.filter((x) => x !== c) : [...p.milestones, c] }));
  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/awb/notify-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Could not save');
      setS(j.settings); setMsg(j.settings.enabled ? 'Saved - customer updates are ON' : 'Saved - customer updates are OFF');
    } catch (e) { setMsg('Error: ' + e.message); } finally { setSaving(false); }
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-label="Customer updates" style={{ background: '#fff', borderRadius: '8px', width: 'min(520px, 100%)', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, fontWeight: 800 }}>Customer shipment updates</div>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {!s ? <div style={{ padding: '16px', fontSize: '12px' }}>{msg || 'Loading...'}</div> : (
          <fieldset disabled={!canEdit || saving} style={{ border: 'none', margin: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!canEdit && <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '6px 8px', borderRadius: '4px' }}>Only an admin can change these settings.</div>}
            <label style={{ ...row, fontWeight: 800, fontSize: '13px' }}><input type="checkbox" checked={s.enabled} onChange={() => tog('enabled')} /> Send updates to customers automatically</label>
            <div style={{ fontSize: '11px', color: '#64748b' }}>When a chosen milestone comes from the airline (or is entered by hand), the customer of that AWB gets a message. For a MAWB, the shippers of its houses get it. Each milestone is sent only once.</div>
            <div style={{ opacity: s.enabled ? 1 : 0.5 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', margin: '4px 0' }}>Send by</div>
              <label style={row}><input type="checkbox" checked={s.email} onChange={() => tog('email')} /> Email (Settings → Email SMTP)</label>
              <label style={row}><input type="checkbox" checked={s.whatsapp} onChange={() => tog('whatsapp')} /> WhatsApp (Settings → WhatsApp)</label>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', margin: '8px 0 4px' }}>To</div>
              <label style={row}><input type="checkbox" checked={s.toShipper} onChange={() => tog('toShipper')} /> Shipper (email / mobile saved on the AWB)</label>
              <label style={row}><input type="checkbox" checked={s.toConsignee} onChange={() => tog('toConsignee')} /> Consignee</label>
              <label style={{ ...row, flexDirection: 'column', alignItems: 'stretch' }}>
                <span>Also email (CC), comma separated</span>
                <input value={s.ccEmails} onChange={(e) => setS((p) => ({ ...p, ccEmails: e.target.value }))} placeholder="ops@yourcompany.com" style={{ padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
              </label>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', margin: '8px 0 4px' }}>On these milestones</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                {CODES.map(([c, n]) => <label key={c} style={row}><input type="checkbox" checked={s.milestones.includes(c)} onChange={() => togCode(c)} /> <b>{c}</b> {n}</label>)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={save} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 16px', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save'}</button>
              {msg && <span style={{ fontSize: '12px', color: msg.startsWith('Error') ? '#dc2626' : '#059669' }}>{msg}</span>}
            </div>
          </fieldset>
        )}
      </div>
    </div>
  );
}
