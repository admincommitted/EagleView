// Sales > Sales persons: the sales team (role, reporting, branches, services, login, iCAFFE names), customers moved when one
// leaves, and the names written in iCAFFE (dockets, party masters, debtor groups) that are not a sales person yet. 11-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { Plus, Save, Users, ArrowRightLeft, UserPlus } from 'lucide-react';
import { api, C, dmy, inp, btn, th, td, Field, grid, MultiPick, Modal, Chip } from './salesUi';

const EMPTY = { name: '', code: '', role: 'EXECUTIVE', designation: '', reportingToId: '', userId: '', mobile: '', whatsapp: '', phone: '', email: '', branchCodes: '', services: '', aliases: '', joinDate: '', leaveDate: '', isActive: 1, remarks: '' };

function PersonForm({ person, meta, persons, users, onClose, onSaved }) {
  const [p, setP] = React.useState(person ? { ...EMPTY, ...Object.fromEntries(Object.entries(person).map(([k, v]) => [k, v == null ? '' : v])) } : { ...EMPTY });
  const [busy, setBusy] = React.useState(false);
  const [move, setMove] = React.useState(null);
  const set = (k, v) => setP(o => ({ ...o, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...p, isActive: p.isActive === 0 || p.isActive === false ? 0 : 1 };
      ['customers', 'prospects', 'reportingToName', 'loginName', 'loginEmail'].forEach(k => delete body[k]);
      if (person) await api('/persons/' + person.id, { method: 'PUT', body }); else await api('/persons', { method: 'POST', body });
      toast.success(person ? 'Sales person saved' : 'Sales person added'); onSaved(); onClose();
    } catch (e) {
      if (e.needsMove) setMove({ count: e.customers });
      toast.error(e.message);
    } finally { setBusy(false); }
  };
  const pickUser = (id) => {
    const u = users.find(x => String(x.id) === String(id));
    setP(o => ({ ...o, userId: id, name: o.name || (u && (u.fullName || u.username)) || '', email: o.email || (u && u.email) || '', mobile: o.mobile || (u && u.contactNumber) || '', designation: o.designation || (u && u.designation) || '' }));
  };
  const others = persons.filter(x => !person || x.id !== person.id);
  return (
    <Modal title={person ? `Sales person - ${person.name}` : 'New sales person'} onClose={onClose} width={820}
      footer={<><button type="button" style={btn()} onClick={onClose}>Close</button><button type="button" style={btn('primary')} onClick={save} disabled={busy}><Save size={13} /> {busy ? 'Saving…' : 'Save'}</button></>}>
      <div style={grid(180)}>
        <Field label="Name *" span={2}><input style={inp} value={p.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Code" hint="Left blank: SP001, SP002…"><input style={inp} value={p.code} onChange={e => set('code', e.target.value.toUpperCase())} /></Field>
        <Field label="Role *"><select style={inp} value={p.role} onChange={e => set('role', e.target.value)}>{(meta.roles || []).map(r => <option key={r[0]} value={r[0]}>{r[1]}</option>)}</select></Field>
        <Field label="Designation"><input style={inp} value={p.designation} onChange={e => set('designation', e.target.value)} /></Field>
        <Field label="Reports to"><select style={inp} value={p.reportingToId} onChange={e => set('reportingToId', e.target.value)}><option value="">-</option>{others.filter(x => x.isActive !== 0).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="EagleView login" hint="He then sees his own customers" span={2}>
          <select style={inp} value={p.userId} onChange={e => pickUser(e.target.value)}><option value="">- No login -</option>{users.map(u => <option key={u.id} value={u.id}>{u.fullName || u.username} ({u.username}){u.branch ? ' - ' + u.branch : ''}</option>)}</select>
        </Field>
        <Field label="Mobile"><input style={inp} value={p.mobile} onChange={e => set('mobile', e.target.value)} /></Field>
        <Field label="WhatsApp"><input style={inp} value={p.whatsapp} placeholder="if not the mobile" onChange={e => set('whatsapp', e.target.value)} /></Field>
        <Field label="Phone / ext"><input style={inp} value={p.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="E-mail" hint="Quotations go out with this as reply-to"><input style={inp} value={p.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Joined"><input type="date" style={inp} value={p.joinDate} onChange={e => set('joinDate', e.target.value)} /></Field>
        <Field label="Left on" hint="A past date makes him inactive"><input type="date" style={inp} value={p.leaveDate} onChange={e => set('leaveDate', e.target.value)} /></Field>
        <Field label="Status"><select style={inp} value={String(p.isActive === 0 || p.isActive === false ? 0 : 1)} onChange={e => set('isActive', Number(e.target.value))}><option value="1">Working</option><option value="0">Left / inactive</option></select></Field>
        <Field label="Names written in iCAFFE (aliases)" span={3} hint="Comma between names, as typed on dockets / party masters / debtor groups - e.g. DEEPAK, DEEPAK KR, Mr. Deepak Kumar"><input style={inp} value={p.aliases} onChange={e => set('aliases', e.target.value)} /></Field>
      </div>
      <div style={{ marginTop: '10px' }}><label style={{ fontSize: '11px', fontWeight: 600, color: C.grey }}>Branches he sells for</label>
        <MultiPick options={(meta.branches || []).map(b => [b.code, `${b.code} - ${b.name}`])} value={p.branchCodes} onChange={v => set('branchCodes', v.join(','))} cols={170} /></div>
      <div style={{ marginTop: '10px' }}><label style={{ fontSize: '11px', fontWeight: 600, color: C.grey }}>Services he sells</label>
        <MultiPick options={meta.services || []} value={p.services} onChange={v => set('services', v.join(','))} cols={190} /></div>
      <div style={{ marginTop: '10px' }}><Field label="Remarks"><input style={inp} value={p.remarks} onChange={e => set('remarks', e.target.value)} /></Field></div>
      {move && person && (
        <div style={{ marginTop: '12px', background: C.amberBg, color: C.amber, padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
          {person.name} is still the KAM of {move.count} customer(s). Move them first, then save again.
          <MoveBox from={person} persons={others} onMoved={() => { setMove(null); onSaved(); }} />
        </div>
      )}
    </Modal>
  );
}

function MoveBox({ from, persons, onMoved }) {
  const [to, setTo] = React.useState(''); const [reason, setReason] = React.useState(''); const [date, setDate] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const go = async () => {
    setBusy(true);
    try { const d = await api(`/persons/${from.id}/move-customers`, { method: 'POST', body: { toId: to, reason, fromDate: date } }); toast.success(`${d.moved} customer(s) moved to ${d.to}`); onMoved(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ ...grid(170), marginTop: '8px', alignItems: 'end' }}>
      <Field label="Move his customers to *"><select style={inp} value={to} onChange={e => setTo(e.target.value)}><option value="">-</option>{persons.filter(x => x.isActive !== 0).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Reason"><input style={inp} value={reason} onChange={e => setReason(e.target.value)} placeholder={`${from.name} left`} /></Field>
      <Field label="From date"><input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} /></Field>
      <button type="button" style={btn('primary')} disabled={!to || busy} onClick={go}><ArrowRightLeft size={13} /> {busy ? 'Moving…' : 'Move customers'}</button>
    </div>
  );
}

function NamesBox({ meta, persons, onDone }) {
  const [rows, setRows] = React.useState(null); const [pick, setPick] = React.useState(new Set()); const [busy, setBusy] = React.useState(false); const [alias, setAlias] = React.useState({});
  const load = async () => { try { setRows((await api('/persons/unmatched-names')).data); } catch (e) { toast.error(e.message); setRows([]); } };
  React.useEffect(() => { load(); }, []);
  const add = async () => {
    setBusy(true);
    try { const d = await api('/persons/from-names', { method: 'POST', body: { names: [...pick] } }); toast.success(`${d.added.length} added${d.skipped.length ? `, ${d.skipped.length} already there` : ''}`); setPick(new Set()); await load(); onDone(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const asAlias = async (name) => {
    const pid = alias[name]; const per = persons.find(x => String(x.id) === String(pid)); if (!per) return;
    try { await api('/persons/' + per.id, { method: 'PUT', body: { aliases: [per.aliases, name].filter(Boolean).join(',') } }); toast.success(`"${name}" is now a name of ${per.name}`); await load(); onDone(); }
    catch (e) { toast.error(e.message); }
  };
  if (!rows) return <div style={{ fontSize: '12px', color: C.mute }}>Reading the names…</div>;
  const open = rows.filter(r => !r.matchedTo);
  return (
    <div>
      <div style={{ fontSize: '12px', color: C.grey, marginBottom: '8px' }}>
        Names typed in iCAFFE as the marketing person of dockets and parties, and debtor groups named after a sales person. A name not matched to a sales person here
        is lost in the reports - add it as a new sales person, or tie it to an existing one as another way his name is written.
      </div>
      {meta.canManage && open.length > 0 && <div style={{ marginBottom: '8px' }}><button type="button" style={btn('primary')} disabled={!pick.size || busy} onClick={add}><UserPlus size={13} /> Add {pick.size || ''} selected as sales persons</button></div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}></th><th style={th}>Name in iCAFFE</th><th style={{ ...th, textAlign: 'right' }}>Dockets</th><th style={{ ...th, textAlign: 'right' }}>Parties</th><th style={{ ...th, textAlign: 'right' }}>Ledgers</th><th style={th}>Last docket</th><th style={th}>Sales person</th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.name} style={{ background: r.matchedTo ? undefined : '#fffbeb' }}>
            <td style={td}>{!r.matchedTo && meta.canManage && <input type="checkbox" aria-label={'Pick ' + r.name} checked={pick.has(r.name)} onChange={() => { const n = new Set(pick); n.has(r.name) ? n.delete(r.name) : n.add(r.name); setPick(n); }} />}</td>
            <td style={td}><b>{r.name}</b>{r.groups.length > 0 && <div style={{ fontSize: '10.5px', color: C.mute }}>{r.groups.join(', ')}</div>}</td>
            <td style={{ ...td, textAlign: 'right' }}>{r.dockets || ''}</td><td style={{ ...td, textAlign: 'right' }}>{r.parties || ''}</td><td style={{ ...td, textAlign: 'right' }}>{r.ledgers || ''}</td>
            <td style={td}>{dmy(String(r.last || '').slice(0, 10))}</td>
            <td style={td}>{r.matchedTo ? <Chip text={r.matchedTo} bg={C.greenBg} fg={C.green} /> : meta.canManage ? (
              <span style={{ display: 'flex', gap: '4px' }}>
                <select style={{ ...inp, width: '170px', padding: '3px 6px' }} value={alias[r.name] || ''} onChange={e => setAlias(a => ({ ...a, [r.name]: e.target.value }))}><option value="">same person as…</option>{persons.filter(p => p.isActive !== 0).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <button type="button" style={btn()} disabled={!alias[r.name]} onClick={() => asAlias(r.name)}>Tie</button>
              </span>) : <span style={{ color: C.amber }}>not matched</span>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function PersonsTab({ meta, reloadMeta }) {
  const [rows, setRows] = React.useState([]); const [users, setUsers] = React.useState([]); const [open, setOpen] = React.useState(null); const [names, setNames] = React.useState(false);
  const [showLeft, setShowLeft] = React.useState(false); const [moving, setMoving] = React.useState(null);
  const load = React.useCallback(async () => { try { setRows((await api('/persons')).data); } catch (e) { toast.error(e.message); } }, []);
  React.useEffect(() => { load(); api('/users').then(d => setUsers(d.data)).catch(() => {}); }, [load]);
  const done = () => { load(); reloadMeta && reloadMeta(); };
  const role = (r) => ((meta.roles || []).find(x => x[0] === r) || [r, r])[1];
  const svc = (s) => String(s || '').split(',').filter(Boolean).map(c => ((meta.services || []).find(x => x[0] === c) || [c, c])[1]).join(', ');
  const list = rows.filter(r => showLeft || r.isActive !== 0);
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        {meta.canManage && <button type="button" style={btn('primary')} onClick={() => setOpen('new')}><Plus size={13} /> Sales person</button>}
        <button type="button" style={btn()} onClick={() => setNames(true)}><Users size={13} /> Names found in iCAFFE</button>
        <label style={{ fontSize: '12px', color: C.grey, marginLeft: 'auto' }}><input type="checkbox" checked={showLeft} onChange={e => setShowLeft(e.target.checked)} /> Show those who left</label>
      </div>
      <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Code', 'Name', 'Role', 'Reports to', 'Branches', 'Services', 'Login', 'Mobile / e-mail', 'Customers', 'Prospects', ''].map(h => <th key={h} style={{ ...th, textAlign: ['Customers', 'Prospects'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {list.length === 0 && <tr><td style={{ ...td, color: C.mute }} colSpan={11}>No sales person yet. Add the team, or open "Names found in iCAFFE" and add the names already used there.</td></tr>}
            {list.map(r => (
              <tr key={r.id} style={{ opacity: r.isActive === 0 ? 0.55 : 1 }}>
                <td style={td}>{r.code}</td>
                <td style={td}><button type="button" onClick={() => setOpen(r)} style={{ border: 'none', background: 'none', padding: 0, color: C.accent, fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>{r.name}</button>
                  {r.aliases && <div style={{ fontSize: '10.5px', color: C.mute }}>also {r.aliases.split(',').join(', ')}</div>}{r.isActive === 0 && <div style={{ fontSize: '10.5px', color: C.red }}>left {dmy(r.leaveDate)}</div>}</td>
                <td style={td}>{role(r.role)}{r.designation ? <div style={{ fontSize: '10.5px', color: C.mute }}>{r.designation}</div> : null}</td>
                <td style={td}>{r.reportingToName || ''}</td>
                <td style={td}>{(r.branchCodes || '').split(',').join(', ')}</td>
                <td style={{ ...td, maxWidth: '220px' }}>{svc(r.services)}</td>
                <td style={td}>{r.loginName || <span style={{ color: C.mute }}>-</span>}</td>
                <td style={td}>{r.mobile}{r.email && <div style={{ fontSize: '10.5px', color: C.mute }}>{r.email}</div>}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.customers - r.prospects}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.prospects}</td>
                <td style={td}>{meta.canManage && r.customers > 0 && <button type="button" style={btn('ghost')} onClick={() => setMoving(r)}><ArrowRightLeft size={12} /> Move customers</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <PersonForm person={open === 'new' ? null : open} meta={meta} persons={rows} users={users} onClose={() => setOpen(null)} onSaved={done} />}
      {names && <Modal title="Names found in iCAFFE" width={900} onClose={() => setNames(false)}><NamesBox meta={meta} persons={rows} onDone={done} /></Modal>}
      {moving && <Modal title={`Move the customers of ${moving.name}`} width={720} onClose={() => setMoving(null)}>
        <div style={{ fontSize: '12px', color: C.grey }}>{moving.customers} customer(s) / prospect(s) have {moving.name} as KAM. Lost and blocked ones stay. The change is kept in each customer's KAM history.</div>
        <MoveBox from={moving} persons={rows.filter(x => x.id !== moving.id)} onMoved={() => { setMoving(null); done(); }} />
      </Modal>}
    </div>
  );
}
