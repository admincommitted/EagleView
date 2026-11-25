// Sales > enquiry form: who asks (customer or a new prospect, contact), what (service, lane, cargo, dates), the
// quotations made from it, and closing it (lost / dropped) or reopening.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RotateCcw, Save, Trash2, XCircle } from 'lucide-react';
import { Button, DateInput, Input, Modal, NumberInput, SelectBox, Textarea } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { salesHubApi } from './salesApi';
import { activePersons, labelsOf, pairOptions } from './salesFormat';
import { CheckLabel, DealBadge, FormField, FormSection } from './salesWidgets';
import { ENQUIRY_STATUS, FORM_GRID } from './salesStyles';
import { CloseEnquiryModal, CustomerPick, EnquiryQuotes, ProspectBox } from './EnquiryFormParts';

const IST_OFFSET_MS = 19800000;
const todayInIndia = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
const blankEnquiry = () => ({
  date: todayInIndia(), priority: 'NORMAL', receivedVia: 'E-mail', serviceType: '', origin: '', destination: '', customerId: null, contactId: '', isDg: false, isTemp: false,
});
const CLOSED_STATUSES = ['WON', 'LOST', 'DROPPED'];
// air chargeable weight: the higher of gross and volume weight, 1 CBM = 167 kg
const AIR_KG_PER_CBM = 167;
const PICK = { clearable: true, clearLabel: '-', placeholder: '-' };

export default function EnquiryForm({ id, meta, deal, onClose, onSaved, openQuote }) {
  const [enquiry, setEnquiry] = useState(blankEnquiry);
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [prospect, setProspect] = useState(null);
  const [closing, setClosing] = useState(null);
  const [copyFrom, setCopyFrom] = useState(null);
  const closed = CLOSED_STATUSES.includes(enquiry.status);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const saved = (await salesHubApi.enquiry(id)).data;
      setEnquiry({ ...saved, isDg: Boolean(saved.isDg), isTemp: Boolean(saved.isTemp) });
    } catch (error) {
      toast.error(error.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!enquiry.customerId) { setProfile(null); return; }
    const loadProfile = async () => {
      try {
        setProfile((await salesHubApi.customer(enquiry.customerId)).data);
      } catch {
        setProfile(null);
      }
    };
    loadProfile();
  }, [enquiry.customerId]);

  const set = (field, value) => setEnquiry((current) => ({ ...current, [field]: value }));
  const air = String(enquiry.serviceType || '').startsWith('AIR');
  const volumeWeight = air && Number(enquiry.cbm) > 0 ? Math.round(Number(enquiry.cbm) * AIR_KG_PER_CBM * 10) / 10 : null;
  const pickCustomer = (customer) => setEnquiry((current) => ({
    ...current, customerId: customer.id, clientName: customer.name, contactId: '', salesPersonId: current.salesPersonId || customer.kamId || '',
  }));

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...enquiry, contactId: enquiry.contactId || null };
      if (id) {
        await salesHubApi.updateEnquiry(id, body);
        toast.success('Enquiry saved');
        onSaved(id);
        load();
      } else {
        const saved = await salesHubApi.createEnquiry(body);
        toast.success(`Enquiry ${saved.enquiryNo} saved`);
        onSaved(saved.id);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const addProspect = async () => {
    const typed = prospect || {};
    if (!String(typed.name || '').trim()) { toast.error('Type the prospect name'); return; }
    try {
      const contacts = typed.contact ? [{ name: typed.contact, email: typed.email || null, mobile: typed.mobile || null, isPrimary: 1 }] : [];
      const saved = await salesHubApi.createCustomer({
        name: typed.name, status: 'PROSPECT', city: typed.city || null, email: typed.email || null, phone: typed.mobile || null,
        source: 'Website / email enquiry', contacts, allowDuplicate: Boolean(typed.allowDuplicate),
      });
      toast.success('Prospect added');
      pickCustomer({ id: saved.id, name: String(typed.name).toUpperCase(), kamId: null });
      setProspect(null);
    } catch (error) {
      if (!error.duplicate) { toast.error(error.message); return; }
      if (await askConfirm({ title: 'Possible duplicate', message: `${error.error}\n\nAdd it anyway?`, okLabel: 'Add anyway', tone: 'warn' })) {
        setProspect({ ...typed, allowDuplicate: true });
      }
    }
  };

  const makeQuote = async (copyFromId) => {
    setBusy(true);
    try {
      const made = await salesHubApi.createQuote(id, copyFromId);
      toast.success(`Quotation ${made.quoteNo} made`);
      setCopyFrom(null);
      onSaved(id);
      load();
      openQuote(made.id);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const loadCopy = async () => {
    try {
      const match = { customerId: enquiry.customerId || '', service: enquiry.serviceType || '', origin: enquiry.origin || '', destination: enquiry.destination || '' };
      setCopyFrom((await salesHubApi.quotesToCopy(match)).data || []);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const setStatus = async (status, reason, lostTo) => {
    try {
      await salesHubApi.setEnquiryStatus(id, { status, reason, lostTo });
      toast.success(status === 'OPEN' ? 'Enquiry reopened' : 'Enquiry closed');
      setClosing(null);
      onSaved(id);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const remove = async () => {
    if (!await askConfirm({ title: 'Delete enquiry', message: `Delete enquiry ${enquiry.enquiryNo}?`, okLabel: 'Delete', tone: 'danger' })) return;
    try {
      await salesHubApi.deleteEnquiry(id);
      toast.success('Enquiry deleted');
      onSaved(null);
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const locked = closed || busy;
  const contacts = (profile?.contacts || []).filter((contact) => contact.isActive !== 0);
  const text = (field, { upper, ...props } = {}) => (
    <Input value={enquiry[field] ?? ''} disabled={locked} onChange={(event) => set(field, upper ? event.target.value.toUpperCase() : event.target.value)} {...props} />
  );
  const number = (field) => <NumberInput value={enquiry[field]} disabled={locked} onValueChange={(value) => set(field, value)} />;
  const date = (field) => <DateInput value={enquiry[field] || ''} disabled={locked} onValueChange={(value) => set(field, value)} />;
  const select = (field, options, extra = PICK) => <SelectBox {...extra} value={enquiry[field] || ''} disabled={locked} onValueChange={(value) => set(field, value)} options={options} />;
  const cargoCurrencies = [...new Set([...(meta.currencies || []), 'INR'])];

  const footer = (
    <>
      {id && !closed && <Button variant="destructive" onClick={() => setClosing({ status: 'LOST' })}><XCircle /> Lost / dropped</Button>}
      {id && closed && enquiry.status !== 'WON' && <Button onClick={() => setStatus('OPEN')}><RotateCcw /> Reopen</Button>}
      {id && !closed && !(enquiry.quotes || []).length && <Button variant="destructive" onClick={remove}><Trash2 /> Delete</Button>}
      <span className="tw:flex-1" />
      <Button onClick={onClose}>Close</Button>
      {!closed && <Button variant="default" disabled={busy} onClick={save}><Save /> {busy ? 'Saving…' : 'Save enquiry'}</Button>}
    </>
  );

  return (
    <Modal open onClose={onClose} title={id ? `Enquiry ${enquiry.enquiryNo || ''}` : 'New enquiry'} width={1040} footer={footer}>
      {id && (
        <div className="tw:mb-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-entry">
          <DealBadge status={enquiry.status} variants={ENQUIRY_STATUS} labels={labelsOf(deal.enquiryStatus)} />
          {enquiry.lostReason && <span className="tw:text-muted-foreground">{enquiry.lostReason}{enquiry.lostTo ? ` (to ${enquiry.lostTo})` : ''}</span>}
        </div>
      )}

      <FormSection title="Customer">
        <div className={FORM_GRID.wide}>
          <FormField label="Customer / prospect" required span={2}>
            <div className="tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:items-start tw:gap-1">
              <CustomerPick customerId={enquiry.customerId} label={enquiry.clientName} onPick={pickCustomer} disabled={locked} />
              {!enquiry.customerId && !prospect && <Button variant="link" onClick={() => setProspect({})}>+ New prospect (not in the list)</Button>}
            </div>
          </FormField>
          {enquiry.customerId && (
            <FormField label="Contact">
              <SelectBox
                clearable
                clearLabel={contacts.length ? '- pick -' : 'none on the profile - type below'}
                placeholder={contacts.length ? '- pick -' : 'none on the profile - type below'}
                value={enquiry.contactId || ''}
                disabled={locked}
                onValueChange={(value) => set('contactId', value)}
                options={contacts.map((contact) => ({ value: contact.id, label: `${contact.name}${contact.designation ? ` (${contact.designation})` : ''}` }))}
              />
            </FormField>
          )}
          {enquiry.customerId && !enquiry.contactId && (
            <>
              <FormField label="Contact name">{text('contactPerson')}</FormField>
              <FormField label="E-mail">{text('email')}</FormField>
              <FormField label="Phone">{text('phone')}</FormField>
            </>
          )}
        </div>
        {prospect && <ProspectBox prospect={prospect} onChange={setProspect} onAdd={addProspect} onCancel={() => setProspect(null)} />}
      </FormSection>

      <FormSection title="Enquiry">
        <div className={FORM_GRID.normal}>
          <FormField label="Date">{date('date')}</FormField>
          <FormField label="Received by">{select('receivedVia', deal.via || [], {})}</FormField>
          <FormField label="Quote by" note="When the customer wants the rates">{date('quoteBy')}</FormField>
          <FormField label="Priority">
            <SelectBox value={enquiry.priority || 'NORMAL'} disabled={locked} onValueChange={(value) => set('priority', value)} options={pairOptions(deal.priority)} />
          </FormField>
          <FormField label="Sales person" note="Blank = the customer's KAM">
            {select('salesPersonId', activePersons(meta).map((person) => ({ value: person.id, label: person.name })))}
          </FormField>
          <FormField label="Branch">
            {select('branchCode', (meta.branches || []).map((branch) => ({ value: branch.code, label: `${branch.code} - ${branch.name}` })), { clearable: true, clearLabel: "(customer's)", placeholder: "(customer's)" })}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Shipment">
        <div className={FORM_GRID.normal}>
          <FormField label="Service" required>{select('serviceType', pairOptions(meta.services), { clearable: true, clearLabel: '- pick -', placeholder: '- pick -' })}</FormField>
          <FormField label={String(enquiry.serviceType || '').startsWith('CUSTOMS') ? 'Port of clearance' : 'Origin'} required>
            {text('origin', { upper: true, placeholder: 'City / port / airport' })}
          </FormField>
          <FormField label="Destination">{text('destination', { upper: true, placeholder: 'City / port / airport' })}</FormField>
          <FormField label="Incoterm">{select('incoterms', meta.incoterms || [])}</FormField>
          <FormField label="Commodity" span={2}>{text('commodity')}</FormField>
          <FormField label="HS code">{text('hsCode')}</FormField>
          <FormField label="Cargo ready">{date('readinessDate')}</FormField>
          <FormField label="Frequency" note="e.g. one-off, 2 per month">{text('frequency')}</FormField>
          <FormField label="Pick-up at">{text('pickupAt')}</FormField>
          <FormField label="Deliver to">{text('deliveryAt')}</FormField>
        </div>
      </FormSection>

      <FormSection title="Cargo">
        <div className={FORM_GRID.narrow}>
          <FormField label="Packages">{number('pkgs')}</FormField>
          <FormField label="Gross wt (kg)">{number('grossWt')}</FormField>
          <FormField label="Volume (CBM)">{number('cbm')}</FormField>
          <FormField label="Chargeable wt (kg)" note={volumeWeight ? `Volume wt ${volumeWeight} kg` : undefined}>
            {number('chargeableWt')}
            {air && !locked && (
              <Button title="Higher of gross and volume weight" onClick={() => set('chargeableWt', Math.max(Number(enquiry.grossWt) || 0, volumeWeight || 0) || '')}>Calc</Button>
            )}
          </FormField>
          <FormField label="Containers" required={/_FCL$/.test(enquiry.serviceType || '')} note="e.g. 2x40HC, 1x20GP">{text('containers', { upper: true })}</FormField>
          <FormField label="Cargo value">{number('cargoValue')}</FormField>
          <FormField label="Currency">{select('cargoCurrency', cargoCurrencies)}</FormField>
          <FormField label="Special">
            <div className="tw:flex tw:flex-col tw:gap-1">
              <CheckLabel disabled={locked} checked={enquiry.isDg} onCheckedChange={(checked) => set('isDg', checked)}>Dangerous goods</CheckLabel>
              <CheckLabel disabled={locked} checked={enquiry.isTemp} onCheckedChange={(checked) => set('isTemp', checked)}>Temperature controlled</CheckLabel>
            </div>
          </FormField>
          <FormField label="Target rate" note="As told by the customer">{text('targetRate', { 'data-allow-text': '' })}</FormField>
          <FormField label="Competitor quoting">{text('competitor')}</FormField>
          <FormField label="Remarks" span={3}>
            <Textarea value={enquiry.remarks || ''} disabled={locked} onChange={(event) => set('remarks', event.target.value)} />
          </FormField>
        </div>
      </FormSection>

      {id && (
        <EnquiryQuotes
          enquiry={enquiry}
          deal={deal}
          closed={closed}
          busy={busy}
          copyFrom={copyFrom}
          onLoadCopy={loadCopy}
          onMakeQuote={makeQuote}
          onOpenQuote={openQuote}
        />
      )}

      {closing && (
        <CloseEnquiryModal
          enquiryNo={enquiry.enquiryNo}
          closing={closing}
          meta={meta}
          onChange={setClosing}
          onCancel={() => setClosing(null)}
          onClose={() => setStatus(closing.status, closing.reason, closing.lostTo)}
        />
      )}
    </Modal>
  );
}
