// Sales > Customer profile: who the customer is, who looks after it (KAM + team, with history), what it ships (services,
// lanes), how much it could give us (potential, share, competitors), its people (contacts), the ledgers it is billed on,
// and what the books / dockets say.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BookOpen, Save, Trash2, X } from 'lucide-react';
import { Button, Sheet, SheetContent } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { salesHubApi } from './salesApi';
import { dmy } from './salesFormat';
import { ActivityBadge, Muted, Notice, StatusBadge } from './salesWidgets';
import { CustomerTiles, MonthlyBilling } from './CustomerFormParts/CustomerFigures';
import {
  AddressSection, CreditSection, CustomerSection, LedgersSection, PotentialSection, RemarksSection, SalesTeamSection,
} from './CustomerFormParts/ProfileSections';
import ContactsSection from './CustomerFormParts/ContactsSection';
import LanesSection from './CustomerFormParts/LanesSection';
import { mainLedgerPicked } from './CustomerFormParts/customerModel';

const EMPTY = {
  name: '', status: 'PROSPECT', customerType: '', industry: '', segment: '', source: '', sourceDetail: '', kamId: '', secondaryIds: '', branchCode: '', services: '',
  address: '', city: '', state: '', country: 'IN', pinCode: '', gstin: '', pan: '', iec: '', website: '', phone: '', email: '', turnoverBand: '', employees: '',
  potentialAirKg: '', potentialSeaFclTeu: '', potentialSeaLclCbm: '', potentialCustomsJobs: '', potentialTrucks: '', potentialRevenue: '', currentSharePct: '', competitors: '',
  creditTerm: '', creditDaysAsked: '', creditLimitAsked: '', firstContactDate: '', nextReviewDate: '', lostReason: '', lostTo: '', lostDate: '', remarks: '',
  ledgerId: null, contacts: [], lanes: [], ledgers: [],
};

function toForm(saved) {
  const filled = Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, value == null ? (EMPTY[key] ?? '') : value]));
  return { ...EMPTY, ...filled, contacts: saved.contacts || [], lanes: saved.lanes || [], ledgers: saved.ledgers || [] };
}

const READ_ONLY_FIELDS = ['figures', 'history', 'ledger', 'kamName'];

function toSaveBody(customer, kamReason, allowDuplicate) {
  const body = { ...customer, kamReason, allowDuplicate, ledgers: (customer.ledgers || []).map((linked) => ({ ledgerId: linked.ledgerId, kind: linked.kind })) };
  READ_ONLY_FIELDS.forEach((field) => delete body[field]);
  return body;
}

const stamp = (when) => dmy(String(when || '').slice(0, 10));

export default function CustomerForm({ id, meta, onClose, onSaved }) {
  const [customer, setCustomer] = useState(id ? null : { ...EMPTY, kamId: meta.me ? meta.me.id : '' });
  const [original, setOriginal] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [kamReason, setKamReason] = useState('');
  const [balance, setBalance] = useState(null);

  const loadBalance = async (ledgerId) => {
    try {
      setBalance(await salesHubApi.ledgerBalance(ledgerId));
    } catch {
      setBalance(null);
    }
  };

  const load = useCallback(async () => {
    try {
      const saved = (await salesHubApi.customer(id)).data;
      const form = toForm(saved);
      setCustomer(form);
      setOriginal(form);
      if (saved.ledgerId) loadBalance(saved.ledgerId);
    } catch (error) {
      toast.error(error.message);
      onClose();
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (id) load(); }, [id, load]);

  const close = () => { if (!busy) onClose(); };

  if (!customer) {
    return (
      <Sheet open onOpenChange={(open) => !open && close()}>
        <SheetContent side="right" title="Customer" className="tw:w-[min(1100px,100vw)]"><Muted className="tw:p-4 tw:text-entry">Loading…</Muted></SheetContent>
      </Sheet>
    );
  }

  const set = (field, value) => setCustomer((current) => ({ ...current, [field]: value }));
  const setRow = (list, index, field, value) => setCustomer((current) => ({ ...current, [list]: current[list].map((row, at) => (at === index ? { ...row, [field]: value } : row)) }));
  const addRow = (list, row) => setCustomer((current) => ({ ...current, [list]: [...current[list], { ...row }] }));
  const removeRow = (list, index) => setCustomer((current) => ({ ...current, [list]: current[list].filter((row, at) => at !== index) }));
  const makePrimary = (index) => setCustomer((current) => ({ ...current, contacts: current.contacts.map((contact, at) => ({ ...contact, isPrimary: at === index })) }));
  const figures = customer.figures || {};
  const kamChanged = Boolean(id && original && original.kamId && String(original.kamId || '') !== String(customer.kamId || ''));
  const statusLabel = (meta.statuses || []).find(([code]) => code === customer.status)?.[1];

  const save = async (allowDuplicate = false) => {
    setBusy(true);
    setErrors([]);
    try {
      const body = toSaveBody(customer, kamReason, allowDuplicate);
      const saved = id ? await salesHubApi.updateCustomer(id, body) : await salesHubApi.createCustomer(body);
      toast.success(id ? 'Customer saved' : 'Customer added');
      setKamReason('');
      if (id) await load();
      onSaved(saved.id);
    } catch (error) {
      if (error.duplicate && await askConfirm({ title: 'Possible duplicate', message: `${error.message}\n\nSave it anyway as a separate customer?`, okLabel: 'Save anyway', tone: 'warn' })) {
        await save(true);
        return;
      }
      setErrors(error.errors || [error.message]);
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!await askConfirm({ title: 'Delete prospect', message: `Delete the prospect ${customer.name}? This cannot be undone.`, okLabel: 'Delete', tone: 'danger' })) return;
    try {
      await salesHubApi.deleteCustomer(id);
      toast.success('Prospect deleted');
      onSaved(null);
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const sectionProps = { customer, set, meta };
  const rowProps = { customer, meta, setRow, addRow, removeRow };

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" title={customer.name || 'New customer / prospect'} className="tw:w-[min(1100px,100vw)] tw:bg-page">
        <div className="tw:flex tw:h-full tw:flex-col">
          <div className="tw:flex tw:shrink-0 tw:flex-wrap tw:items-center tw:gap-2.5 tw:border-b tw:border-border tw:bg-card tw:px-4 tw:py-2">
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5">
              <StatusBadge status={customer.status} label={statusLabel} />
              {id && <ActivityBadge activity={figures.activity} lastBill={figures.lastBill} />}
              {customer.kamName && <Muted>KAM {customer.kamName}</Muted>}
            </div>
            <div className="tw:ml-auto tw:flex tw:flex-wrap tw:gap-1.5">
              {id && customer.status === 'PROSPECT' && !customer.ledgerId && meta.canManage && (
                <Button variant="destructive" onClick={remove}><Trash2 /> Delete prospect</Button>
              )}
              <Button onClick={onClose} disabled={busy}><X /> Close</Button>
              <Button variant="default" onClick={() => save(false)} disabled={busy}><Save /> {busy ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>

          <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:px-2 tw:py-3 tw:sm:px-4">
            {errors.length > 0 && <Notice tone="danger" className="tw:mb-2.5">{errors.map((message, index) => <div key={index}>{message}</div>)}</Notice>}
            {id && <CustomerTiles figures={figures} balance={balance} />}
            {id && (figures.months || []).length > 0 && <MonthlyBilling billedMonths={figures.months} />}
            <CustomerSection {...sectionProps} />
            <SalesTeamSection {...sectionProps} isNew={!id} kamChanged={kamChanged} kamReason={kamReason} onKamReason={setKamReason} />
            <LedgersSection
              customer={customer}
              customerId={id}
              onPickMain={(ledger) => setCustomer((current) => mainLedgerPicked(current, ledger))}
              setRow={setRow}
              addRow={addRow}
              removeRow={removeRow}
            />
            <AddressSection {...sectionProps} />
            <PotentialSection {...sectionProps} />
            <CreditSection {...sectionProps} />
            <ContactsSection {...rowProps} makePrimary={makePrimary} />
            <LanesSection {...rowProps} />
            <RemarksSection {...sectionProps} />
            {id && (
              <Muted className="tw:flex tw:items-center tw:gap-1.5">
                <BookOpen className="tw:size-3" /> Added {stamp(customer.createdAt)} by {customer.createdBy || '-'}; changed {stamp(customer.updatedAt)} by {customer.updatedBy || '-'}
              </Muted>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
