// Sales > enquiry form: who asks (customer or a new prospect, contact), what (service, lane, cargo, dates), the
// quotations made from it, and closing it (lost / dropped) or reopening. 14-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { FilePlus2, Save, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import { api, C, crore, dmy, inp, btn, Field, Section, grid, Modal, StatusChip } from './salesUi';
import { DealChip, ENQ_STYLE, QT_STYLE } from './EnquiriesTab';

const today = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
const blank = () => ({ date: today(), priority: 'NORMAL', receivedVia: 'E-mail', serviceType: '', origin: '', destination: '', customerId: null, contactId: '', isDg: false, isTemp: false });

// customer / prospect search box
function CustomerPick({ value, label, onPick, disabled }) {
  const [text, setText] = React.useState('');
  const [list, setList] = React.useState([]);
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (text.trim().length < 2) { setList([]); return undefined; }
    const t = setTimeout(async () => { try { const d = await api('/customers?limit=15&q=' + encodeURIComponent(text.trim())); setList(d.data || []); setShow(true); } catch (e) { /* typed again */ } }, 250);
    return () => clearTimeout(t);
  }, [text]);
  if (value && !show) return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <b style={{ fontSize: '13px' }}>{label}</b>
      {!disabled && <button type="button" style={btn('ghost')} onClick={() => { setShow(true); setText(''); }}>Change</button>}
    </div>
  );
  return (
    <div style={{ position: 'relative' }}>
      <input autoFocus={!!value} style={inp} placeholder="Type 2+ letters of the customer / prospect name, GSTIN, city" value={text} onChange={e => setText(e.target.value)} aria-label="Find customer" />
      {show && list.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid ' + C.line, borderRadius: '4px', boxShadow: '0 8px 20px rgba(0,0,0,.12)', maxHeight: '260px', overflow: 'auto' }}>
          {list.map(c => (
            <button key={c.id} type="button" onClick={() => { onPick(c); setShow(false); setText(''); }}
              style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center', padding: '6px 10px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '12px' }}>
              <span style={{ flex: 1 }}>{c.name}<span style={{ color: C.mute }}>{c.city ? ', ' + c.city : ''}</span></span>
              <StatusChip status={c.status} />
              <span style={{ color: C.mute, fontSize: '11px' }}>{c.kamName || 'no KAM'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EnquiryForm({ id, meta, deal, onClose, onSaved, openQuote }) {
  const [e, setE] = React.useState(blank());
  const [cust, setCust] = React.useState(null); // the customer's profile (contacts, lanes)
  const [busy, setBusy] = React.useState(false);
  const [prospect, setProspect] = React.useState(null); // new prospect mini form
  const [close, setClose] = React.useState(null); // { status }
  const [copyFrom, setCopyFrom] = React.useState(null); // list of quotations to copy charges from
  const closed = ['WON', 'LOST', 'DROPPED'].includes(e.status);
  const load = React.useCallback(async () => {
    if (!id) return;
    try { const d = await api('/enquiries/' + id); setE({ ...d.data, isDg: !!d.data.isDg, isTemp: !!d.data.isTemp }); } catch (err) { toast.error(err.message); }
  }, [id]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    if (!e.customerId) { setCust(null); return; }
    api('/customers/' + e.customerId).then(d => setCust(d.data)).catch(() => setCust(null));
  }, [e.customerId]);
  const set = (k, v) => setE(o => ({ ...o, [k]: v }));
  const air = String(e.serviceType || '').startsWith('AIR');
  // air chargeable weight: the higher of gross and volume weight (1 CBM = 167 kg)
  const volWt = air && Number(e.cbm) > 0 ? Math.round(Number(e.cbm) * 167 * 10) / 10 : null;
  const pickCustomer = (c) => setE(o => ({ ...o, customerId: c.id, clientName: c.name, contactId: '', salesPersonId: o.salesPersonId || c.kamId || '' }));
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...e, contactId: e.contactId || null };
      if (id) { await api('/enquiries/' + id, { method: 'PUT', body }); toast.success('Enquiry saved'); onSaved(id); load(); }
      else { const d = await api('/enquiries', { method: 'POST', body }); toast.success('Enquiry ' + d.enquiryNo + ' saved'); onSaved(d.id); }
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const makeProspect = async () => {
    const p = prospect || {};
    if (!String(p.name || '').trim()) { toast.error('Type the prospect name'); return; }
    try {
      const contacts = p.contact ? [{ name: p.contact, email: p.email || null, mobile: p.mobile || null, isPrimary: 1 }] : [];
      const d = await api('/customers', { method: 'POST', body: { name: p.name, status: 'PROSPECT', city: p.city || null, email: p.email || null, phone: p.mobile || null, source: 'Website / email enquiry', contacts, allowDuplicate: !!p.allowDuplicate } });
      toast.success('Prospect added'); pickCustomer({ id: d.id, name: String(p.name).toUpperCase(), kamId: null }); setProspect(null);
    } catch (err) {
      if (err.duplicate) { if (window.confirm(err.error + '\n\nAdd it anyway?')) { setProspect({ ...p, allowDuplicate: true }); } } else toast.error(err.message);
    }
  };
  const makeQuote = async (copyFromId) => {
    setBusy(true);
    try { const d = await api('/quotes', { method: 'POST', body: { enquiryId: id, copyFromId: copyFromId || null } }); toast.success('Quotation ' + d.quoteNo + ' made'); setCopyFrom(null); onSaved(id); load(); openQuote(d.id); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const loadCopy = async () => {
    try { const p = new URLSearchParams({ customerId: e.customerId || '', service: e.serviceType || '', origin: e.origin || '', destination: e.destination || '' }); const d = await api('/quotes-to-copy?' + p.toString()); setCopyFrom(d.data || []); }
    catch (err) { toast.error(err.message); }
  };
  const setStatus = async (status, reason, lostTo) => {
    try { await api('/enquiries/' + id + '/status', { method: 'POST', body: { status, reason, lostTo } }); toast.success(status === 'OPEN' ? 'Enquiry reopened' : 'Enquiry closed'); setClose(null); onSaved(id); load(); }
    catch (err) { toast.error(err.message); }
  };
  const del = async () => {
    if (!window.confirm('Delete enquiry ' + e.enquiryNo + '?')) return;
    try { await api('/enquiries/' + id, { method: 'DELETE' }); toast.success('Enquiry deleted'); onSaved(null); onClose(); } catch (err) { toast.error(err.message); }
  };
  const persons = (meta.persons || []).filter(p => p.isActive !== 0);
  const contacts = (cust && cust.contacts || []).filter(c => c.isActive !== 0);
  const dis = closed || busy;
  const I = (k, props = {}) => <input style={inp} value={e[k] ?? ''} disabled={dis} onChange={ev => set(k, props.upper ? ev.target.value.toUpperCase() : ev.target.value)} {...props} upper={undefined} />;
  const N = (k, props = {}) => <input style={inp} type="number" min="0" step="any" value={e[k] ?? ''} disabled={dis} onChange={ev => set(k, ev.target.value)} {...props} />;
  const footer = <>
    {id && !closed && <button type="button" style={btn('danger')} onClick={() => setClose({ status: 'LOST' })}><XCircle size={13} /> Lost / dropped</button>}
    {id && closed && e.status !== 'WON' && <button type="button" style={btn()} onClick={() => setStatus('OPEN')}><RotateCcw size={13} /> Reopen</button>}
    {id && !closed && !(e.quotes || []).length && <button type="button" style={btn('danger')} onClick={del}><Trash2 size={13} /> Delete</button>}
    <span style={{ flex: 1 }} />
    <button type="button" style={btn()} onClick={onClose}>Close</button>
    {!closed && <button type="button" style={btn('primary')} disabled={busy} onClick={save}><Save size={13} /> {busy ? 'Saving…' : 'Save enquiry'}</button>}
  </>;
  return (
    <Modal title={id ? `Enquiry ${e.enquiryNo || ''}` : 'New enquiry'} onClose={onClose} width={1040} footer={footer}>
      {id && <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '12px' }}>
        <DealChip status={e.status} map={ENQ_STYLE} labels={Object.fromEntries((deal.enquiryStatus || []).map(s => [s[0], s[1]]))} />
        {e.lostReason && <span style={{ color: C.mute }}>{e.lostReason}{e.lostTo ? ' (to ' + e.lostTo + ')' : ''}</span>}
      </div>}
      <Section title="Customer">
        <div style={grid(220)}>
          <Field label="Customer / prospect *" span={2}>
            <CustomerPick value={e.customerId} label={e.clientName} onPick={pickCustomer} disabled={dis} />
            {!e.customerId && !prospect && <button type="button" style={{ ...btn('ghost'), padding: '4px 0' }} onClick={() => setProspect({})}>+ New prospect (not in the list)</button>}
          </Field>
          {e.customerId && <Field label="Contact">
            <select style={inp} value={e.contactId || ''} disabled={dis} onChange={ev => set('contactId', ev.target.value)}>
              <option value="">{contacts.length ? '- pick -' : 'none on the profile - type below'}</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.designation ? ' (' + c.designation + ')' : ''}</option>)}
            </select>
          </Field>}
          {e.customerId && !e.contactId && <><Field label="Contact name">{I('contactPerson')}</Field><Field label="E-mail">{I('email')}</Field><Field label="Phone">{I('phone')}</Field></>}
        </div>
        {prospect && (
          <div style={{ marginTop: '8px', padding: '8px', border: '1px dashed ' + C.line, borderRadius: '6px', background: C.soft }}>
            <div style={grid(180)}>
              <Field label="Prospect name *"><input style={inp} value={prospect.name || ''} onChange={ev => setProspect({ ...prospect, name: ev.target.value })} /></Field>
              <Field label="City"><input style={inp} value={prospect.city || ''} onChange={ev => setProspect({ ...prospect, city: ev.target.value })} /></Field>
              <Field label="Contact person"><input style={inp} value={prospect.contact || ''} onChange={ev => setProspect({ ...prospect, contact: ev.target.value })} /></Field>
              <Field label="E-mail"><input style={inp} value={prospect.email || ''} onChange={ev => setProspect({ ...prospect, email: ev.target.value })} /></Field>
              <Field label="Mobile"><input style={inp} value={prospect.mobile || ''} onChange={ev => setProspect({ ...prospect, mobile: ev.target.value })} /></Field>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button type="button" style={btn('primary')} onClick={makeProspect}>Add prospect</button>
              <button type="button" style={btn()} onClick={() => setProspect(null)}>Cancel</button>
              <span style={{ fontSize: '11px', color: C.mute, alignSelf: 'center' }}>Saved in Customers &amp; prospects; complete its profile there later.</span>
            </div>
          </div>
        )}
      </Section>
      <Section title="Enquiry">
        <div style={grid(170)}>
          <Field label="Date">{I('date', { type: 'date' })}</Field>
          <Field label="Received by"><select style={inp} value={e.receivedVia || ''} disabled={dis} onChange={ev => set('receivedVia', ev.target.value)}>{(deal.via || []).map(v => <option key={v}>{v}</option>)}</select></Field>
          <Field label="Quote by" hint="When the customer wants the rates">{I('quoteBy', { type: 'date' })}</Field>
          <Field label="Priority"><select style={inp} value={e.priority || 'NORMAL'} disabled={dis} onChange={ev => set('priority', ev.target.value)}>{(deal.priority || []).map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}</select></Field>
          <Field label="Sales person" hint="Blank = the customer's KAM">
            <select style={inp} value={e.salesPersonId || ''} disabled={dis} onChange={ev => set('salesPersonId', ev.target.value)}><option value="">-</option>{persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </Field>
          <Field label="Branch"><select style={inp} value={e.branchCode || ''} disabled={dis} onChange={ev => set('branchCode', ev.target.value)}><option value="">(customer's)</option>{(meta.branches || []).map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}</select></Field>
        </div>
      </Section>
      <Section title="Shipment">
        <div style={grid(170)}>
          <Field label="Service *"><select style={inp} value={e.serviceType || ''} disabled={dis} onChange={ev => set('serviceType', ev.target.value)}><option value="">- pick -</option>{(meta.services || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></Field>
          <Field label={String(e.serviceType || '').startsWith('CUSTOMS') ? 'Port of clearance *' : 'Origin *'}>{I('origin', { upper: true, placeholder: 'City / port / airport' })}</Field>
          <Field label="Destination">{I('destination', { upper: true, placeholder: 'City / port / airport' })}</Field>
          <Field label="Incoterm"><select style={inp} value={e.incoterms || ''} disabled={dis} onChange={ev => set('incoterms', ev.target.value)}><option value="">-</option>{(meta.incoterms || []).map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Commodity" span={2}>{I('commodity')}</Field>
          <Field label="HS code">{I('hsCode')}</Field>
          <Field label="Cargo ready">{I('readinessDate', { type: 'date' })}</Field>
          <Field label="Frequency" hint="e.g. one-off, 2 per month">{I('frequency')}</Field>
          <Field label="Pick-up at">{I('pickupAt')}</Field>
          <Field label="Deliver to">{I('deliveryAt')}</Field>
        </div>
      </Section>
      <Section title="Cargo">
        <div style={grid(140)}>
          <Field label="Packages">{N('pkgs')}</Field>
          <Field label="Gross wt (kg)">{N('grossWt')}</Field>
          <Field label="Volume (CBM)">{N('cbm')}</Field>
          <Field label="Chargeable wt (kg)" hint={volWt ? `Volume wt ${volWt} kg` : undefined}>
            <div style={{ display: 'flex', gap: '4px' }}>{N('chargeableWt')}{air && !dis && <button type="button" style={btn()} title="Higher of gross and volume weight" onClick={() => set('chargeableWt', Math.max(Number(e.grossWt) || 0, volWt || 0) || '')}>Calc</button>}</div>
          </Field>
          <Field label={/_FCL$/.test(e.serviceType || '') ? 'Containers *' : 'Containers'} hint="e.g. 2x40HC, 1x20GP">{I('containers', { upper: true })}</Field>
          <Field label="Cargo value">{N('cargoValue')}</Field>
          <Field label="Currency"><select style={inp} value={e.cargoCurrency || ''} disabled={dis} onChange={ev => set('cargoCurrency', ev.target.value)}><option value="">-</option>{(meta.currencies || []).map(c => <option key={c}>{c}</option>)}<option>INR</option></select></Field>
          <Field label="Special">
            <label style={{ fontSize: '12px', display: 'flex', gap: '6px' }}><input type="checkbox" disabled={dis} checked={!!e.isDg} onChange={ev => set('isDg', ev.target.checked)} /> Dangerous goods</label>
            <label style={{ fontSize: '12px', display: 'flex', gap: '6px' }}><input type="checkbox" disabled={dis} checked={!!e.isTemp} onChange={ev => set('isTemp', ev.target.checked)} /> Temperature controlled</label>
          </Field>
          <Field label="Target rate" hint="As told by the customer">{I('targetRate')}</Field>
          <Field label="Competitor quoting">{I('competitor')}</Field>
          <Field label="Remarks" span={3}><textarea style={{ ...inp, minHeight: '44px' }} value={e.remarks || ''} disabled={dis} onChange={ev => set('remarks', ev.target.value)} /></Field>
        </div>
      </Section>
      {id && (
        <Section title="Quotations" right={!closed && <>
          <button type="button" style={btn()} disabled={busy} onClick={loadCopy}>Copy charges from…</button>
          <button type="button" style={btn('primary')} disabled={busy} onClick={() => makeQuote(null)}><FilePlus2 size={13} /> Make quotation</button>
        </>}>
          {(e.quotes || []).length === 0 ? <div style={{ fontSize: '12px', color: C.mute }}>No quotation yet. Save the enquiry, then "Make quotation".</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}><tbody>
              {(e.quotes || []).map(qq => (
                <tr key={qq.id} onClick={() => openQuote(qq.id)} style={{ cursor: 'pointer', borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '5px 6px', fontWeight: 600, color: C.accent }}>{qq.quoteNo}</td>
                  <td style={{ padding: '5px 6px' }}>{dmy(qq.date)}</td>
                  <td style={{ padding: '5px 6px' }}>valid {dmy(qq.validUntil)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>{crore(qq.totalSellInr)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: Number(qq.marginPct) < (deal.marginWarnPct || 10) ? C.red : C.green }}>{qq.marginPct != null ? qq.marginPct + '%' : ''}</td>
                  <td style={{ padding: '5px 6px' }}><DealChip status={qq.status} map={QT_STYLE} labels={Object.fromEntries((deal.quoteStatus || []).map(s => [s[0], s[1]]))} /></td>
                  <td style={{ padding: '5px 6px', color: C.mute }}>{qq.docketNo || ''}</td>
                </tr>
              ))}
            </tbody></table>
          )}
          {copyFrom && (
            <div style={{ marginTop: '8px', border: '1px solid ' + C.line, borderRadius: '6px', maxHeight: '220px', overflow: 'auto' }}>
              {copyFrom.length === 0 ? <div style={{ padding: '8px', fontSize: '12px', color: C.mute }}>No other quotation to copy from.</div> : copyFrom.map(c => (
                <button key={c.id} type="button" onClick={() => makeQuote(c.id)} style={{ display: 'flex', gap: '8px', width: '100%', padding: '6px 8px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>
                  <b>{c.quoteNo}</b><span>{c.clientName}</span><span style={{ color: C.mute }}>{c.serviceLabel}, {[c.origin, c.destination].filter(Boolean).join(' > ')}</span><span style={{ marginLeft: 'auto' }}>{crore(c.totalSellInr)}</span>
                </button>
              ))}
            </div>
          )}
        </Section>
      )}
      {close && (
        <Modal title={'Close enquiry ' + e.enquiryNo} onClose={() => setClose(null)} width={460} footer={<>
          <button type="button" style={btn()} onClick={() => setClose(null)}>Cancel</button>
          <button type="button" style={btn('danger')} onClick={() => setStatus(close.status, close.reason, close.lostTo)}>Close as {close.status === 'LOST' ? 'lost' : 'dropped'}</button>
        </>}>
          <div style={grid(200)}>
            <Field label="Closed as"><select style={inp} value={close.status} onChange={ev => setClose({ ...close, status: ev.target.value })}><option value="LOST">Lost (went elsewhere)</option><option value="DROPPED">Dropped (no shipment)</option></select></Field>
            <Field label="Reason *"><select style={inp} value={close.reason || ''} onChange={ev => setClose({ ...close, reason: ev.target.value })}><option value="">- pick -</option>{((meta.lookups || {}).LOST_REASON || []).filter(r => r.isActive !== 0).map(r => <option key={r.id}>{r.value}</option>)}</select></Field>
            {close.status === 'LOST' && <Field label="Lost to (competitor)"><input style={inp} value={close.lostTo || ''} onChange={ev => setClose({ ...close, lostTo: ev.target.value })} /></Field>}
          </div>
          <div style={{ fontSize: '11px', color: C.mute, marginTop: '6px' }}>Open quotations of this enquiry are marked lost too.</div>
        </Modal>
      )}
    </Modal>
  );
}
