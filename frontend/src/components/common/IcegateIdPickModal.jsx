// "Which ICEGATE ID?" before a BE file is made (Download JSON, .be flat file, Preview JSON). 17-Nov-2026: these always
// used the default ICEGATE ID (CCCPL1998), so the downloaded file did not match the one sent from the Submit window
// (SHERSINGHDANU). The ID goes in the file as the sender (senderID / .be header) and as the e-Sanchit user ID of the
// documents that have no ID of their own.
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const KEY = 'ev.fileIcegateId';
export const rememberIcegateId = (id) => { try { if (id) localStorage.setItem(KEY, String(id)); } catch (e) { /* storage off */ } };
// the same pick everywhere: the ID used last in this browser, else the one linked to the job's CHA, else the default one
export function defaultIcegateId(profiles, chaCode) {
  const list = profiles || [];
  let last = ''; try { last = localStorage.getItem(KEY) || ''; } catch (e) { last = ''; }
  const p = (last && list.find(x => String(x.id) === last)) || (chaCode && list.find(x => x.linkedChaCode === chaCode)) || list.find(x => x.isDefault) || list[0];
  return p ? String(p.id) : '';
}

export default function IcegateIdPickModal({ open, title, actionLabel, chaCode, onPick, onClose }) {
  const [profiles, setProfiles] = useState(null);
  const [sel, setSel] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    fetch('/api/icegate-profiles').then(r => r.json()).then(j => {
      const list = (j && j.success && j.data) || [];
      setProfiles(list); setSel(defaultIcegateId(list, chaCode));
      if (!list.length) setErr('No ICEGATE ID is set up - add one in Settings > ICEGATE');
    }).catch(() => { setProfiles([]); setErr('Could not load the ICEGATE IDs'); });
  }, [open, chaCode]);

  if (!open) return null;
  const go = () => {
    const p = (profiles || []).find(x => String(x.id) === sel);
    if (!p) return;
    rememberIcegateId(p.id);
    onPick(p.id, p.loginId);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label="Choose ICEGATE ID" style={{ background: '#fff', borderRadius: '8px', width: '420px', maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <strong style={{ fontSize: '14px', color: '#0f172a' }}>{title || 'Choose ICEGATE ID'}</strong>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '12px 14px', display: 'grid', gap: '8px' }}>
          {profiles === null && <div style={{ fontSize: '12px', color: '#64748b' }}>Loading ICEGATE IDs...</div>}
          {err && <div style={{ fontSize: '12px', color: '#991b1b', background: '#fef2f2', padding: '8px', borderRadius: '6px' }}>{err}</div>}
          {(profiles || []).map(p => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid ' + (String(p.id) === sel ? '#0f766e' : '#e2e8f0'), borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: String(p.id) === sel ? '#f0fdfa' : '#fff' }}>
              <input type="radio" name="icegate-id" checked={String(p.id) === sel} onChange={() => setSel(String(p.id))} />
              <span><b>{p.loginId}</b>{p.profileName && p.profileName !== p.loginId ? ' - ' + p.profileName : ''}
                <span style={{ fontSize: '11px', color: '#64748b' }}>{chaCode && p.linkedChaCode === chaCode ? '  (job CHA)' : ''}{p.isDefault ? '  (default)' : ''}</span></span>
            </label>
          ))}
          <div style={{ fontSize: '11px', color: '#64748b' }}>This ID goes in the file as the sender, and as the e-Sanchit user of the documents. Use the ID that uploaded the e-Sanchit documents and whose DSC signs the file.</div>
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} style={{ height: '30px', padding: '0 14px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={go} disabled={!sel} style={{ height: '30px', padding: '0 16px', background: sel ? '#0f766e' : '#94a3b8', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: sel ? 'pointer' : 'not-allowed' }}>{actionLabel || 'Continue'}</button>
        </div>
      </div>
    </div>
  );
}
