// Customs > BE Amendments - register of BE amendments (iCAFFE "Submit BE Amend"), 10-Nov-2026.
// Not sent / Sent / All, search, and one amendment at a time on the right: changes, codes, file
// (unsigned, signed with the DSC token, or sent straight to ICEGATE by mail).
import React from 'react';
import toast from 'react-hot-toast';
import { api, dmy, MODE_LABEL } from '../components/BeAmendment/beAmendApi';
import AmendmentDetail, { StatusChip } from '../components/BeAmendment/AmendmentDetail';

const TABS = [['open', 'Not sent'], ['submitted', 'Sent'], ['all', 'All'], ['void', 'Void']];
const inp = { padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: '#fff' };

export default function BeAmendments() {
  const [tab, setTab] = React.useState('open');
  const [q, setQ] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [rows, setRows] = React.useState([]);
  const [counts, setCounts] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [sel, setSel] = React.useState(null);
  const [showSet, setShowSet] = React.useState(false);
  const [settings, setSettings] = React.useState(null);
  const [mailTo, setMailTo] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ status: tab }); if (q.trim()) p.set('q', q.trim()); if (from) p.set('from', from); if (to) p.set('to', to);
      const d = await api('/?' + p.toString());
      setRows(d.data || []); setCounts(d.counts || {});
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [tab, q, from, to]);
  React.useEffect(() => { load(); }, [tab]); // eslint-disable-line
  React.useEffect(() => { api('/settings').then(d => { setSettings(d); setMailTo(d.mailTo || ''); }).catch(() => {}); }, []);

  const n = (k) => k === 'open' ? (counts.Draft || 0) + (counts.Ready || 0) : k === 'submitted' ? (counts.Submitted || 0) + (counts.Accepted || 0) + (counts.Rejected || 0) : k === 'void' ? (counts.Void || 0) : Object.entries(counts).filter(([s]) => s !== 'Void').reduce((t, [, v]) => t + v, 0);
  const openJob = (id) => { window.location.assign('/job-entry?openJob=' + id); };
  const saveMail = async () => {
    try { const d = await api('/settings', { method: 'PUT', body: { mailTo } }); setSettings(s => ({ ...s, mailTo: d.mailTo })); toast.success('ICEGATE mail address saved'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div style={{ padding: '12px 16px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>BE Amendments</h2>
        <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          {TABS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setTab(k); setSel(null); }} style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer', background: tab === k ? '#0f766e' : '#fff', color: tab === k ? '#fff' : '#334155' }}>
              {l} <span style={{ opacity: 0.75, fontWeight: 500 }}>{n(k)}</span>
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...inp, width: '240px' }} placeholder="Amend no, BE no, job no, importer, code" value={q} onChange={e => setQ(e.target.value)} />
          <input style={inp} type="date" value={from} onChange={e => setFrom(e.target.value)} title="From" />
          <input style={inp} type="date" value={to} onChange={e => setTo(e.target.value)} title="To" />
          <button type="submit" style={{ ...inp, cursor: 'pointer', fontWeight: 600 }}>{loading ? 'Loading…' : 'Search'}</button>
        </form>
        <button type="button" onClick={() => setShowSet(v => !v)} style={{ ...inp, marginLeft: 'auto', cursor: 'pointer', fontWeight: 600 }}>Settings</button>
      </div>

      {showSet && settings && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', marginBottom: '10px', fontSize: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Direct to ICEGATE (mail)</div>
            <div style={{ color: '#64748b', marginBottom: '6px' }}>The signed file is mailed to this address from {settings.smtpUser || 'the Settings > Email account'}.</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input style={{ ...inp, flex: 1 }} type="email" placeholder="ICEGATE mail address" value={mailTo} onChange={e => setMailTo(e.target.value)} />
              <button type="button" onClick={saveMail} style={{ ...inp, cursor: 'pointer', fontWeight: 600 }}>Save</button>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Amendment numbers</div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr style={{ color: '#475569', textAlign: 'left' }}><th style={{ padding: '2px 6px' }}>Branch</th><th style={{ padding: '2px 6px' }}>Div</th><th style={{ padding: '2px 6px' }}>FY</th><th style={{ padding: '2px 6px' }}>Last</th><th style={{ padding: '2px 6px' }}>Next</th></tr></thead>
              <tbody>{(settings.series || []).map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: '2px 6px' }}>{s.branchCode}</td><td style={{ padding: '2px 6px' }}>{s.division}</td><td style={{ padding: '2px 6px' }}>{s.fyCode}</td><td style={{ padding: '2px 6px' }}>{s.lastNo || '-'} {s.lastDate ? 'dt ' + dmy(s.lastDate) : ''}</td><td style={{ padding: '2px 6px', fontWeight: 700 }}>{s.nextNo}</td></tr>
              ))}</tbody>
            </table>
            <div style={{ color: '#64748b', marginTop: '4px' }}>Continues the iCAFFE series. Change it in Settings &gt; Number Series (BE_AMEND).</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
        <div style={{ flex: sel ? '0 0 44%' : '1 1 auto', minWidth: 0, overflow: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 1 }}><tr style={{ color: '#475569', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Amend No</th><th style={{ padding: '6px 8px' }}>Date</th><th style={{ padding: '6px 8px' }}>BE No / Date</th><th style={{ padding: '6px 8px' }}>BE Job</th>
              {!sel && <th style={{ padding: '6px 8px' }}>Importer</th>}<th style={{ padding: '6px 8px' }}>Codes</th>{!sel && <th style={{ padding: '6px 8px' }}>Reason</th>}<th style={{ padding: '6px 8px' }}>Status</th>{!sel && <th style={{ padding: '6px 8px' }}>Sent</th>}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} onClick={() => setSel(r.id)} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer', background: sel === r.id ? '#ecfeff' : undefined }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>{r.amendNo}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{dmy(r.amendDate)}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{r.beNo} <span style={{ color: '#64748b' }}>{dmy(r.beDate)}</span></td>
                  <td style={{ padding: '6px 8px' }}>{r.parentJobNo}</td>
                  {!sel && <td style={{ padding: '6px 8px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.importer}>{r.importer}</td>}
                  <td style={{ padding: '6px 8px' }}>{(r.codes || []).join(', ') || '-'}</td>
                  {!sel && <td style={{ padding: '6px 8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason}>{r.reason}</td>}
                  <td style={{ padding: '6px 8px' }}><StatusChip status={r.status} /></td>
                  {!sel && <td style={{ padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{r.submittedAt ? `${dmy(String(r.submittedAt).slice(0, 10))} · ${MODE_LABEL[r.transferMode] ? r.transferMode === 'MAIL' ? 'mail' : r.transferMode === 'DOWNLOAD' ? 'signed' : 'unsigned' : ''}` : ''}</td>}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>{loading ? 'Loading…' : tab === 'open' ? 'Nothing waiting. A new amendment is made from the BE job: Job Entry > open the job > BE Amendment.' : 'No amendment here.'}</td></tr>}
            </tbody>
          </table>
        </div>
        {sel && (
          <div style={{ flex: '1 1 56%', minWidth: 0, overflow: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
            <div style={{ textAlign: 'right', marginBottom: '-22px' }}><button type="button" aria-label="Close" onClick={() => setSel(null)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button></div>
            <AmendmentDetail key={sel} id={sel} onOpenJob={openJob} onChanged={(d) => { if (d) setRows(rs => rs.map(r => r.id === d.id ? { ...r, ...d } : r)); }} />
          </div>
        )}
      </div>
    </div>
  );
}
