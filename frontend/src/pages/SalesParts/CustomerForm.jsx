// Sales > Customer profile: who the customer is, who looks after it (KAM + team, with history), what it ships (services,
// lanes), how much it could give us (potential, share, competitors), its people (contacts), the ledgers it is billed on,
// and what the books / dockets say. 11-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, X, BookOpen } from 'lucide-react';
import { api, Layer, C, inr, crore, dmy, inp, btn, th, td, Field, Section, grid, MultiPick, StatusChip, ActivityChip } from './salesUi';

const EMPTY = { name: '', status: 'PROSPECT', customerType: '', industry: '', segment: '', source: '', sourceDetail: '', kamId: '', secondaryIds: '', branchCode: '', services: '',
  address: '', city: '', state: '', country: 'IN', pinCode: '', gstin: '', pan: '', iec: '', website: '', phone: '', email: '', turnoverBand: '', employees: '',
  potentialAirKg: '', potentialSeaFclTeu: '', potentialSeaLclCbm: '', potentialCustomsJobs: '', potentialTrucks: '', potentialRevenue: '', currentSharePct: '', competitors: '',
  creditTerm: '', creditDaysAsked: '', creditLimitAsked: '', firstContactDate: '', nextReviewDate: '', lostReason: '', lostTo: '', lostDate: '', remarks: '',
  ledgerId: null, contacts: [], lanes: [], ledgers: [] };
const NEW_CONTACT = { name: '', designation: '', department: '', mobile: '', phone: '', email: '', whatsapp: '', isPrimary: false, isDecisionMaker: false, sendQuotes: true, birthday: '', anniversary: '', linkedin: '', remarks: '', isActive: true };
const NEW_LANE = { service: '', origin: '', originCountry: '', destination: '', destinationCountry: '', commodity: '', hsCode: '', incoterm: '', containerType: '', shipmentsPerMonth: '', volumePerShipment: '', volumeUnit: '', isDg: false, isTempControlled: false, currentVendor: '', currentRate: '', rateCurrency: 'INR', rateBasis: '', targetRate: '', status: 'OPEN', remarks: '', isActive: true };

function LedgerPick({ value, label, onPick, keep, all }) {
  const [q, setQ] = React.useState(''); const [list, setList] = React.useState([]); const [open, setOpen] = React.useState(false); const tm = React.useRef(null);
  const ask = (s) => { clearTimeout(tm.current); tm.current = setTimeout(async () => { try { const d = await api(`/ledgers?q=${encodeURIComponent(s)}${keep ? '&keep=' + keep : ''}${all ? '&all=1' : ''}`); setList(d.data || []); setOpen(true); } catch (e) { setList([]); } }, 250); };
  return (
    <div style={{ position: 'relative' }}>
      <input style={inp} value={open ? q : (label || q)} placeholder="Type the ledger name or GSTIN" onFocus={() => { setQ(''); ask(''); }} onBlur={() => setTimeout(() => setOpen(false), 200)} onChange={e => { setQ(e.target.value); ask(e.target.value); }} />
      {open && list.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 40, top: '32px', left: 0, right: 0, maxHeight: '260px', overflow: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 8px 20px rgba(15,23,42,.15)' }}>
          {list.map(l => (
            <div key={l.id} onMouseDown={() => { if (l.profileId && String(l.profileId) !== String(keep || '')) { toast.error('That ledger already belongs to another customer'); return; } onPick(l); setOpen(false); }}
              style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '12px', opacity: l.profileId && String(l.profileId) !== String(keep || '') ? 0.5 : 1 }}>
              <b>{l.name}</b> <span style={{ color: C.mute, fontSize: '10.5px' }}>{[l.gstin, l.groupName, l.profileId && String(l.profileId) !== String(keep || '') ? 'has a profile' : ''].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
        </div>
      )}
      {value && !open && <div style={{ fontSize: '10.5px', color: C.mute, marginTop: '2px' }}>Ledger #{value}</div>}
    </div>
  );
}

export default function CustomerForm({ id, meta, onClose, onSaved }) {
  const [c, setC] = React.useState(id ? null : { ...EMPTY, kamId: meta.me ? meta.me.id : '' });
  const [orig, setOrig] = React.useState(null);
  const [errs, setErrs] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [kamReason, setKamReason] = React.useState('');
  const [bal, setBal] = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const d = (await api('/customers/' + id)).data;
      const v = { ...EMPTY, ...Object.fromEntries(Object.entries(d).map(([k, x]) => [k, x == null ? (EMPTY[k] ?? '') : x])), contacts: d.contacts || [], lanes: d.lanes || [], ledgers: d.ledgers || [] };
      setC(v); setOrig(v);
      if (d.ledgerId) fetch('/api/accounts-hub/ledger-balance/' + d.ledgerId).then(r => r.json()).then(setBal).catch(() => setBal(null));
    } catch (e) { toast.error(e.message); onClose(); }
  }, [id]); // eslint-disable-line
  React.useEffect(() => { if (id) load(); }, [id, load]);
  if (!c) return <Layer><div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Loading…</div></Layer>;

  const set = (k, v) => setC(o => ({ ...o, [k]: v }));
  const setRow = (list, i, k, v) => setC(o => ({ ...o, [list]: o[list].map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const addRow = (list, row) => setC(o => ({ ...o, [list]: [...o[list], { ...row }] }));
  const delRow = (list, i) => setC(o => ({ ...o, [list]: o[list].filter((r, j) => j !== i) }));
  const look = (kind) => ((meta.lookups || {})[kind] || []).filter(x => x.isActive);
  const persons = (meta.persons || []).filter(p => p.isActive !== 0);
  const kamChanged = id && orig && String(orig.kamId || '') !== String(c.kamId || '') && orig.kamId;
  const f = c.figures || {};

  const save = async (allowDuplicate) => {
    setBusy(true); setErrs([]);
    try {
      const body = { ...c, kamReason, allowDuplicate: !!allowDuplicate };
      delete body.figures; delete body.history; delete body.ledger; delete body.kamName;
      body.ledgers = (c.ledgers || []).map(l => ({ ledgerId: l.ledgerId, kind: l.kind }));
      const d = id ? await api('/customers/' + id, { method: 'PUT', body }) : await api('/customers', { method: 'POST', body });
      toast.success(id ? 'Customer saved' : 'Customer added');
      setKamReason('');
      if (id) await load();
      onSaved(d.id);
    } catch (e) {
      if (e.duplicate && window.confirm(e.message + '\n\nSave it anyway as a separate customer?')) { setBusy(false); return save(true); }
      setErrs(e.errors || [e.message]); toast.error(e.message);
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the prospect ${c.name}? This cannot be undone.`)) return;
    try { await api('/customers/' + id, { method: 'DELETE' }); toast.success('Prospect deleted'); onSaved(null); onClose(); } catch (e) { toast.error(e.message); }
  };
  const pickMainLedger = (l) => setC(o => ({ ...o, ledgerId: l.id, ledgerName: l.name, name: o.name || l.name.replace(/^XX+\s*/i, '').replace(/\s*XX+$/i, '').replace(/\s*[-_]\s*DR\.?$/i, ''),
    gstin: o.gstin || l.gstin || '', pan: o.pan || l.pan || '', state: o.state || l.state || '', address: o.address || l.address || '', pinCode: o.pinCode || l.pinCode || '',
    email: o.email || l.email || '', phone: o.phone || l.phone || '', branchCode: o.branchCode || l.dealingBranch || '', creditDaysAsked: o.creditDaysAsked || l.creditDays || '' }));
  // every month from the start of last FY to this month, empty ones too
  const months = (() => {
    const got = new Map((f.months || []).map(m => [m.month, m]));
    const now = new Date(); let y = now.getFullYear(), mo = now.getMonth() + 1; const fy = mo < 4 ? y - 1 : y;
    const out = []; let cy = fy - 1, cm = 4;
    while (cy < y || (cy === y && cm <= mo)) { const k = `${cy}-${String(cm).padStart(2, '0')}`; out.push(got.get(k) || { month: k, billed: 0, reimb: 0, bills: 0 }); cm++; if (cm > 12) { cm = 1; cy++; } }
    return (f.months || []).length ? out : [];
  })();
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const maxM = Math.max(1, ...months.map(m => Math.max(m.billed || 0, 0) + Math.max(m.reimb || 0, 0)));

  return (<Layer>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9000, display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-label="Customer" style={{ width: '1100px', maxWidth: '100%', height: '100%', background: C.soft, display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: '#fff', borderBottom: '1px solid ' + C.line, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: C.ink }}>{c.name || 'New customer / prospect'}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px', alignItems: 'center' }}>
              <StatusChip status={c.status} label={(meta.statuses || []).find(s => s[0] === c.status)?.[1]} />
              {id && <ActivityChip activity={f.activity} last={f.lastBill} />}
              {c.kamName && <span style={{ fontSize: '11px', color: C.grey }}>KAM {c.kamName}</span>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            {id && c.status === 'PROSPECT' && !c.ledgerId && meta.canManage && <button type="button" style={btn('danger')} onClick={remove}><Trash2 size={13} /> Delete prospect</button>}
            <button type="button" style={btn()} onClick={onClose} disabled={busy}><X size={13} /> Close</button>
            <button type="button" style={btn('primary')} onClick={() => save(false)} disabled={busy}><Save size={13} /> {busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: '12px 16px', flex: 1 }}>
          {errs.length > 0 && <div style={{ background: C.redBg, color: C.red, padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '12px' }}>{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}

          {id && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              {[['Billed this FY', crore(f.billedCy), f.billsCy ? `${f.billsCy} bills` : ''], ['Billed last FY', crore(f.billedLy), ''], ['Duty / DO this FY', crore(f.reimbCy), f.reimbLy ? 'last FY ' + crore(f.reimbLy) : ''],
                ['Last bill', dmy(f.lastBill) || '-', ''], ['Dockets this FY', (f.dockets || {}).cy || 0, Object.entries((f.dockets || {}).byDivision || {}).map(([k, v]) => `${k} ${v}`).join(' · ')],
                ['Outstanding', bal ? inr(bal.balance) + ' ' + (bal.side || '') : '-', bal && bal.creditDays ? `credit ${bal.creditDays} days` : '']].map(([k, v, s]) => (
                <div key={k} style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '6px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '10.5px', color: C.mute }}>{k}</div><div style={{ fontSize: '16px', fontWeight: 800, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{v}</div>{s && <div style={{ fontSize: '10.5px', color: C.mute }}>{s}</div>}
                </div>
              ))}
            </div>
          )}
          {id && months.length > 0 && (
            <Section title="Billing by month (last FY and this FY)" right={<span style={{ fontSize: '11px', color: C.mute }}><span style={{ display: 'inline-block', width: 10, height: 10, background: C.accent, marginRight: 4 }} />service <span style={{ display: 'inline-block', width: 10, height: 10, background: '#94a3b8', margin: '0 4px 0 8px' }} />duty / DO</span>}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '90px' }}>
                {months.map(m => (
                  <div key={m.month} title={`${m.month}: service ${inr(m.billed)}${m.reimb ? ', duty / DO ' + inr(m.reimb) : ''}, ${m.bills} bills`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', minWidth: '10px' }}>
                    <div style={{ background: '#94a3b8', height: `${Math.max(m.reimb, 0) / maxM * 80}px` }} />
                    <div style={{ background: C.accent, height: `${Math.max(m.billed, 0) / maxM * 80}px` }} />
                    <div style={{ fontSize: '9px', color: C.mute, textAlign: 'center', marginTop: '2px' }}>{MN[Number(m.month.slice(5, 7)) - 1]}{m.month.slice(5, 7) === '04' || m.month.slice(5, 7) === '01' ? ' ' + m.month.slice(2, 4) : ''}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Customer">
            <div style={grid(190)}>
              <Field label="Name *" span={2}><input style={inp} value={c.name} onChange={e => set('name', e.target.value)} /></Field>
              <Field label="Status *"><select style={inp} value={c.status} onChange={e => set('status', e.target.value)}>{(meta.statuses || []).map(s => <option key={s[0]} value={s[0]} title={s[2]}>{s[1]}</option>)}</select></Field>
              <Field label="Type"><select style={inp} value={c.customerType} onChange={e => set('customerType', e.target.value)}><option value="">-</option>{(meta.customerTypes || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></Field>
              <Field label="Segment"><select style={inp} value={c.segment} onChange={e => set('segment', e.target.value)}><option value="">-</option>{(meta.segments || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></Field>
              <Field label="Industry"><select style={inp} value={c.industry} onChange={e => set('industry', e.target.value)}><option value="">-</option>{look('INDUSTRY').map(x => <option key={x.id} value={x.value}>{x.value}</option>)}{c.industry && !look('INDUSTRY').some(x => x.value === c.industry) && <option value={c.industry}>{c.industry}</option>}</select></Field>
              <Field label="Source"><select style={inp} value={c.source} onChange={e => set('source', e.target.value)}><option value="">-</option>{look('SOURCE').map(x => <option key={x.id} value={x.value}>{x.value}</option>)}{c.source && !look('SOURCE').some(x => x.value === c.source) && <option value={c.source}>{c.source}</option>}</select></Field>
              <Field label="Source detail" hint="Who referred / which fair / which agent"><input style={inp} value={c.sourceDetail} onChange={e => set('sourceDetail', e.target.value)} /></Field>
              <Field label="Branch"><select style={inp} value={c.branchCode} onChange={e => set('branchCode', e.target.value)}><option value="">-</option>{(meta.branches || []).map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}</select></Field>
              <Field label="First contact"><input type="date" style={inp} value={c.firstContactDate} onChange={e => set('firstContactDate', e.target.value)} /></Field>
              <Field label="Next review" hint="Account review / visit due"><input type="date" style={inp} value={c.nextReviewDate} onChange={e => set('nextReviewDate', e.target.value)} /></Field>
            </div>
            {c.status === 'LOST' && (
              <div style={{ ...grid(190), marginTop: '8px', background: C.greyBg, padding: '8px', borderRadius: '6px' }}>
                <Field label="Lost reason *"><select style={inp} value={c.lostReason} onChange={e => set('lostReason', e.target.value)}><option value="">-</option>{look('LOST_REASON').map(x => <option key={x.id} value={x.value}>{x.value}</option>)}</select></Field>
                <Field label="Lost to (competitor)"><input style={inp} list="sales-competitors" value={c.lostTo} onChange={e => set('lostTo', e.target.value)} /></Field>
                <Field label="Lost on"><input type="date" style={inp} value={c.lostDate} onChange={e => set('lostDate', e.target.value)} /></Field>
              </div>
            )}
            <div style={{ marginTop: '10px' }}><label style={{ fontSize: '11px', fontWeight: 600, color: C.grey }}>Services it uses / can use</label><MultiPick options={meta.services || []} value={c.services} onChange={v => set('services', v.join(','))} cols={190} /></div>
          </Section>

          <Section title="Sales team">
            <div style={grid(220)}>
              <Field label="KAM (main sales person)">
                <select style={inp} value={c.kamId || ''} disabled={!!id && !meta.canManage} onChange={e => set('kamId', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">- No KAM -</option>{persons.map(p => <option key={p.id} value={p.id}>{p.name}{p.role ? ` (${p.role.toLowerCase()})` : ''}</option>)}
                </select>
              </Field>
              {kamChanged && <Field label="Why is the KAM changed? *" span={2}><input style={inp} value={kamReason} onChange={e => setKamReason(e.target.value)} placeholder="e.g. Deepak left, re-allocated to Atul" /></Field>}
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: C.grey }}>Other sales persons on this account</label>
              <MultiPick options={persons.filter(p => String(p.id) !== String(c.kamId)).map(p => [String(p.id), p.name])} value={c.secondaryIds} onChange={v => set('secondaryIds', v.join(','))} cols={180} />
            </div>
            {(c.history || []).length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
                <thead><tr><th style={th}>KAM</th><th style={th}>From</th><th style={th}>To</th><th style={th}>Reason</th><th style={th}>By</th></tr></thead>
                <tbody>{c.history.map(h => <tr key={h.id}><td style={td}>{h.personName}</td><td style={td}>{dmy(h.fromDate)}</td><td style={td}>{h.toDate ? dmy(h.toDate) : 'now'}</td><td style={td}>{h.reason}</td><td style={td}>{h.changedBy}</td></tr>)}</tbody>
              </table>
            )}
            {(f.marketingNames || []).length > 0 && <div style={{ fontSize: '11px', color: C.mute, marginTop: '6px' }}>Marketing person on its dockets: {f.marketingNames.map(m => `${m.name} (${m.dockets})`).join(', ')}</div>}
          </Section>

          <Section title="Accounts ledgers" right={<span style={{ fontSize: '11px', color: C.mute }}>Billing is read from these ledgers</span>}>
            <div style={grid(260)}>
              <Field label={c.status === 'ACTIVE' ? 'Main ledger *' : 'Main ledger (when it is billed)'} span={2}>
                <LedgerPick value={c.ledgerId} label={c.ledgerName || (c.ledger && c.ledger.name) || ''} keep={id} onPick={pickMainLedger} />
              </Field>
              {c.ledger && <Field label="Ledger group"><div style={{ fontSize: '12px', paddingTop: '6px' }}>{c.ledger.groupName}{c.ledger.creditDays ? ` · credit ${c.ledger.creditDays} days` : ''}{c.ledger.creditLimit ? ` · limit ${inr(c.ledger.creditLimit)}` : ''}{c.ledger.isBlacklisted ? ' · BLACKLISTED' : ''}</div></Field>}
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: C.grey }}>Other ledgers of this customer (duty account, DO account, another state / GSTIN)</label>
              {(c.ledgers || []).map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ flex: 1, fontSize: '12px' }}>{l.name} <span style={{ color: C.mute, fontSize: '10.5px' }}>{[l.gstin, l.groupName].filter(Boolean).join(' · ')}</span></div>
                  <select style={{ ...inp, width: '220px' }} value={l.kind} onChange={e => setRow('ledgers', i, 'kind', e.target.value)}><option value="REIMB">Duty / DO / reimbursement</option><option value="OTHER">Service (other state / branch)</option></select>
                  <button type="button" style={btn('danger')} onClick={() => delRow('ledgers', i)} aria-label="Remove ledger"><Trash2 size={12} /></button>
                </div>
              ))}
              <div style={{ marginTop: '6px', maxWidth: '520px' }}>
                <LedgerPick all keep={id} label="" onPick={(l) => { if (l.id === c.ledgerId || (c.ledgers || []).some(x => x.ledgerId === l.id)) { toast.error('Already linked'); return; } addRow('ledgers', { ledgerId: l.id, name: l.name, gstin: l.gstin, groupName: l.groupName, kind: /DUTY|\bDO\b|DIRECT PARTY/i.test(l.name + ' ' + (l.groupName || '')) ? 'REIMB' : 'OTHER' }); }} />
              </div>
            </div>
          </Section>

          <Section title="Address and registration">
            <div style={grid(170)}>
              <Field label="Address" span={3}><input style={inp} value={c.address} onChange={e => set('address', e.target.value)} /></Field>
              <Field label="City"><input style={inp} value={c.city} onChange={e => set('city', e.target.value)} /></Field>
              <Field label="State"><input style={inp} value={c.state} onChange={e => set('state', e.target.value)} /></Field>
              <Field label="Country"><select style={inp} value={c.country} onChange={e => set('country', e.target.value)}><option value="">-</option>{(meta.countries || []).map(x => <option key={x.code} value={x.code}>{x.code} - {x.name}</option>)}</select></Field>
              <Field label="PIN"><input style={inp} value={c.pinCode} onChange={e => set('pinCode', e.target.value)} /></Field>
              <Field label="GSTIN"><input style={inp} value={c.gstin} maxLength={15} onChange={e => { const g = e.target.value.toUpperCase(); set('gstin', g); if (g.length === 15 && !c.pan) set('pan', g.slice(2, 12)); }} /></Field>
              <Field label="PAN"><input style={inp} value={c.pan} maxLength={10} onChange={e => set('pan', e.target.value.toUpperCase())} /></Field>
              <Field label="IEC"><input style={inp} value={c.iec} maxLength={10} onChange={e => set('iec', e.target.value.toUpperCase())} /></Field>
              <Field label="Website"><input style={inp} value={c.website} onChange={e => set('website', e.target.value)} /></Field>
              <Field label="Office phone"><input style={inp} value={c.phone} onChange={e => set('phone', e.target.value)} /></Field>
              <Field label="Office e-mail"><input style={inp} value={c.email} onChange={e => set('email', e.target.value)} /></Field>
              <Field label="Turnover"><select style={inp} value={c.turnoverBand} onChange={e => set('turnoverBand', e.target.value)}><option value="">-</option>{(meta.turnover || []).map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
              <Field label="Employees"><input style={inp} value={c.employees} onChange={e => set('employees', e.target.value)} placeholder="e.g. 50-200" /></Field>
            </div>
          </Section>

          <Section title="Potential and competition" right={<span style={{ fontSize: '11px', color: C.mute }}>Per month</span>}>
            <div style={grid(160)}>
              <Field label="Air (kg)"><input style={inp} inputMode="decimal" value={c.potentialAirKg} onChange={e => set('potentialAirKg', e.target.value)} /></Field>
              <Field label="Sea FCL (TEU)"><input style={inp} inputMode="decimal" value={c.potentialSeaFclTeu} onChange={e => set('potentialSeaFclTeu', e.target.value)} /></Field>
              <Field label="Sea LCL (CBM)"><input style={inp} inputMode="decimal" value={c.potentialSeaLclCbm} onChange={e => set('potentialSeaLclCbm', e.target.value)} /></Field>
              <Field label="Customs jobs"><input style={inp} inputMode="numeric" value={c.potentialCustomsJobs} onChange={e => set('potentialCustomsJobs', e.target.value)} /></Field>
              <Field label="Trucks"><input style={inp} inputMode="numeric" value={c.potentialTrucks} onChange={e => set('potentialTrucks', e.target.value)} /></Field>
              <Field label="Revenue (Rs)"><input style={inp} inputMode="decimal" value={c.potentialRevenue} onChange={e => set('potentialRevenue', e.target.value)} /></Field>
              <Field label="Our share (%)"><input style={inp} inputMode="decimal" value={c.currentSharePct} onChange={e => set('currentSharePct', e.target.value)} /></Field>
              <Field label="Competitors working with it" span={2}><input style={inp} list="sales-competitors" value={c.competitors} onChange={e => set('competitors', e.target.value)} placeholder="Comma between names" /></Field>
            </div>
            <datalist id="sales-competitors">{look('COMPETITOR').map(x => <option key={x.id} value={x.value} />)}</datalist>
          </Section>

          <Section title="Credit asked by the customer" right={<span style={{ fontSize: '11px', color: C.mute }}>Approved terms are on the ledger</span>}>
            <div style={grid(170)}>
              <Field label="Terms"><select style={inp} value={c.creditTerm} onChange={e => set('creditTerm', e.target.value)}><option value="">-</option>{(meta.creditTerms || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></Field>
              <Field label="Days asked"><input style={inp} inputMode="numeric" value={c.creditDaysAsked} onChange={e => set('creditDaysAsked', e.target.value)} /></Field>
              <Field label="Limit asked (Rs)"><input style={inp} inputMode="decimal" value={c.creditLimitAsked} onChange={e => set('creditLimitAsked', e.target.value)} /></Field>
            </div>
          </Section>

          <Section title={`Contacts (${(c.contacts || []).length})`} right={<button type="button" style={btn()} onClick={() => addRow('contacts', { ...NEW_CONTACT, isPrimary: !(c.contacts || []).length })}><Plus size={12} /> Contact</button>}>
            {(c.contacts || []).length === 0 && <div style={{ fontSize: '12px', color: C.mute }}>No contact yet.</div>}
            {(c.contacts || []).map((r, i) => (
              <div key={i} style={{ border: '1px solid ' + C.line, borderRadius: '6px', padding: '8px', marginBottom: '6px', background: r.isActive === false || r.isActive === 0 ? C.greyBg : '#fff' }}>
                <div style={grid(150)}>
                  <Field label="Name *"><input style={inp} value={r.name || ''} onChange={e => setRow('contacts', i, 'name', e.target.value)} /></Field>
                  <Field label="Designation"><input style={inp} value={r.designation || ''} onChange={e => setRow('contacts', i, 'designation', e.target.value)} /></Field>
                  <Field label="Department"><input style={inp} list="sales-depts" value={r.department || ''} onChange={e => setRow('contacts', i, 'department', e.target.value)} /></Field>
                  <Field label="Mobile"><input style={inp} value={r.mobile || ''} onChange={e => setRow('contacts', i, 'mobile', e.target.value)} /></Field>
                  <Field label="WhatsApp"><input style={inp} value={r.whatsapp || ''} placeholder="if not the mobile" onChange={e => setRow('contacts', i, 'whatsapp', e.target.value)} /></Field>
                  <Field label="Phone / ext"><input style={inp} value={r.phone || ''} onChange={e => setRow('contacts', i, 'phone', e.target.value)} /></Field>
                  <Field label="E-mail"><input style={inp} value={r.email || ''} onChange={e => setRow('contacts', i, 'email', e.target.value)} /></Field>
                  <Field label="Birthday"><input type="date" style={inp} value={r.birthday || ''} onChange={e => setRow('contacts', i, 'birthday', e.target.value)} /></Field>
                  <Field label="Anniversary"><input type="date" style={inp} value={r.anniversary || ''} onChange={e => setRow('contacts', i, 'anniversary', e.target.value)} /></Field>
                  <Field label="LinkedIn"><input style={inp} value={r.linkedin || ''} onChange={e => setRow('contacts', i, 'linkedin', e.target.value)} /></Field>
                  <Field label="Remarks" span={2}><input style={inp} value={r.remarks || ''} onChange={e => setRow('contacts', i, 'remarks', e.target.value)} /></Field>
                </div>
                <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label><input type="radio" name="primary-contact" checked={!!r.isPrimary} onChange={() => setC(o => ({ ...o, contacts: o.contacts.map((x, j) => ({ ...x, isPrimary: j === i })) }))} /> Primary</label>
                  <label><input type="checkbox" checked={!!r.isDecisionMaker} onChange={e => setRow('contacts', i, 'isDecisionMaker', e.target.checked)} /> Decision maker</label>
                  <label><input type="checkbox" checked={r.sendQuotes !== false && r.sendQuotes !== 0} onChange={e => setRow('contacts', i, 'sendQuotes', e.target.checked)} /> Gets quotations</label>
                  <label><input type="checkbox" checked={r.isActive !== false && r.isActive !== 0} onChange={e => setRow('contacts', i, 'isActive', e.target.checked)} /> Still there</label>
                  <button type="button" style={{ ...btn('danger'), marginLeft: 'auto' }} onClick={() => delRow('contacts', i)}><Trash2 size={12} /> Remove</button>
                </div>
              </div>
            ))}
            <datalist id="sales-depts">{look('DEPARTMENT').map(x => <option key={x.id} value={x.value} />)}</datalist>
          </Section>

          <Section title={`Lanes - what it ships (${(c.lanes || []).length})`} right={<button type="button" style={btn()} onClick={() => addRow('lanes', NEW_LANE)}><Plus size={12} /> Lane</button>}>
            {(c.lanes || []).length === 0 && <div style={{ fontSize: '12px', color: C.mute }}>No lane yet. A lane is a regular movement: service, from - to, commodity, how often and how much, who moves it now and at what rate.</div>}
            {(c.lanes || []).map((r, i) => (
              <div key={i} style={{ border: '1px solid ' + C.line, borderRadius: '6px', padding: '8px', marginBottom: '6px', background: r.isActive === false || r.isActive === 0 ? C.greyBg : '#fff' }}>
                <div style={grid(140)}>
                  <Field label="Service *"><select style={inp} value={r.service || ''} onChange={e => setRow('lanes', i, 'service', e.target.value)}><option value="">-</option>{(meta.services || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></Field>
                  <Field label="From (port / city) *"><input style={inp} value={r.origin || ''} onChange={e => setRow('lanes', i, 'origin', e.target.value.toUpperCase())} placeholder="DEL, INNSA1…" /></Field>
                  <Field label="From country"><select style={inp} value={r.originCountry || ''} onChange={e => setRow('lanes', i, 'originCountry', e.target.value)}><option value="">-</option>{(meta.countries || []).map(x => <option key={x.code} value={x.code}>{x.code}</option>)}</select></Field>
                  <Field label="To (port / city) *"><input style={inp} value={r.destination || ''} onChange={e => setRow('lanes', i, 'destination', e.target.value.toUpperCase())} placeholder="FRA, USNYC…" /></Field>
                  <Field label="To country"><select style={inp} value={r.destinationCountry || ''} onChange={e => setRow('lanes', i, 'destinationCountry', e.target.value)}><option value="">-</option>{(meta.countries || []).map(x => <option key={x.code} value={x.code}>{x.code}</option>)}</select></Field>
                  <Field label="Commodity"><input style={inp} value={r.commodity || ''} onChange={e => setRow('lanes', i, 'commodity', e.target.value)} /></Field>
                  <Field label="HS code"><input style={inp} value={r.hsCode || ''} onChange={e => setRow('lanes', i, 'hsCode', e.target.value)} /></Field>
                  <Field label="Incoterm"><select style={inp} value={r.incoterm || ''} onChange={e => setRow('lanes', i, 'incoterm', e.target.value)}><option value="">-</option>{(meta.incoterms || []).map(x => <option key={x} value={x}>{x}</option>)}</select></Field>
                  {/SEA/.test(r.service || '') && <Field label={/FCL/.test(r.service || '') ? 'Container *' : 'Container'}><select style={inp} value={r.containerType || ''} onChange={e => setRow('lanes', i, 'containerType', e.target.value)}><option value="">-</option>{(meta.containerTypes || []).map(x => <option key={x} value={x}>{x}</option>)}</select></Field>}
                  <Field label="Shipments / month"><input style={inp} inputMode="decimal" value={r.shipmentsPerMonth ?? ''} onChange={e => setRow('lanes', i, 'shipmentsPerMonth', e.target.value)} /></Field>
                  <Field label="Volume / shipment"><input style={inp} inputMode="decimal" value={r.volumePerShipment ?? ''} onChange={e => setRow('lanes', i, 'volumePerShipment', e.target.value)} /></Field>
                  <Field label="Unit"><select style={inp} value={r.volumeUnit || ''} onChange={e => setRow('lanes', i, 'volumeUnit', e.target.value)}><option value="">-</option>{(meta.volumeUnits || []).map(u => <option key={u[0]} value={u[0]}>{u[1]}</option>)}</select></Field>
                  <Field label="Moved now by"><input style={inp} list="sales-competitors" value={r.currentVendor || ''} onChange={e => setRow('lanes', i, 'currentVendor', e.target.value)} /></Field>
                  <Field label="Their rate"><input style={inp} inputMode="decimal" value={r.currentRate ?? ''} onChange={e => setRow('lanes', i, 'currentRate', e.target.value)} /></Field>
                  <Field label="Target rate"><input style={inp} inputMode="decimal" value={r.targetRate ?? ''} onChange={e => setRow('lanes', i, 'targetRate', e.target.value)} /></Field>
                  <Field label="Currency"><select style={inp} value={r.rateCurrency || 'INR'} onChange={e => setRow('lanes', i, 'rateCurrency', e.target.value)}>{['INR', ...(meta.currencies || []).filter(x => x !== 'INR')].map(x => <option key={x} value={x}>{x}</option>)}</select></Field>
                  <Field label="Rate per"><input style={inp} value={r.rateBasis || ''} onChange={e => setRow('lanes', i, 'rateBasis', e.target.value)} placeholder="kg, container, shipment" /></Field>
                  <Field label="Status"><select style={inp} value={r.status || 'OPEN'} onChange={e => setRow('lanes', i, 'status', e.target.value)}><option value="OPEN">Open (not quoted)</option><option value="QUOTED">Quoted</option><option value="WON">Won</option><option value="LOST">Lost</option></select></Field>
                  <Field label="Remarks" span={2}><input style={inp} value={r.remarks || ''} onChange={e => setRow('lanes', i, 'remarks', e.target.value)} /></Field>
                </div>
                <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '12px', alignItems: 'center' }}>
                  <label><input type="checkbox" checked={!!r.isDg} onChange={e => setRow('lanes', i, 'isDg', e.target.checked)} /> Dangerous goods</label>
                  <label><input type="checkbox" checked={!!r.isTempControlled} onChange={e => setRow('lanes', i, 'isTempControlled', e.target.checked)} /> Temperature controlled</label>
                  <label><input type="checkbox" checked={r.isActive !== false && r.isActive !== 0} onChange={e => setRow('lanes', i, 'isActive', e.target.checked)} /> Running</label>
                  <button type="button" style={{ ...btn('danger'), marginLeft: 'auto' }} onClick={() => delRow('lanes', i)}><Trash2 size={12} /> Remove</button>
                </div>
              </div>
            ))}
          </Section>

          <Section title="Remarks"><textarea style={{ ...inp, minHeight: '60px' }} value={c.remarks} onChange={e => set('remarks', e.target.value)} /></Section>
          {id && <div style={{ fontSize: '11px', color: C.mute, display: 'flex', gap: '6px', alignItems: 'center' }}><BookOpen size={12} /> Added {dmy(String(c.createdAt || '').slice(0, 10))} by {c.createdBy || '-'}; changed {dmy(String(c.updatedAt || '').slice(0, 10))} by {c.updatedBy || '-'}</div>}
        </div>
      </div>
    </div>
  </Layer>);
}
