import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { Button, ComboInput, DataTable, DateInput, Input, NumberInput, SelectBox, Textarea } from '@/components/ui';
import { activeLookups, activePersons, dmy, inr, pairOptions } from '../salesFormat';
import { CheckGrid, FormField, FormSection, Muted } from '../salesWidgets';
import { FORM_GRID } from '../salesStyles';
import LedgerPick from './LedgerPick';
import { competitorNames } from './customerModel';

const NONE = { clearable: true, clearLabel: '-', placeholder: '-' };

/** The active values of a pick list, plus the saved value when it has been switched off since. */
function lookupOptions(meta, kind, current) {
  const values = activeLookups(meta, kind).map((lookup) => lookup.value);
  return current && !values.includes(current) ? [...values, current] : values;
}

const branchOptions = (meta) => (meta.branches || []).map((branch) => ({ value: branch.code, label: `${branch.code} - ${branch.name}` }));
const countryOptions = (meta) => (meta.countries || []).map((country) => ({ value: country.code, label: `${country.code} - ${country.name}` }));

function TextBox({ customer, set, field, upper, ...props }) {
  return <Input value={customer[field] ?? ''} onChange={(event) => set(field, upper ? event.target.value.toUpperCase() : event.target.value)} {...props} />;
}

function NumberBox({ customer, set, field, ...props }) {
  return <NumberInput value={customer[field]} onValueChange={(value) => set(field, value)} {...props} />;
}

export function CustomerSection({ customer, set, meta }) {
  const box = { customer, set };
  return (
    <FormSection title="Customer">
      <div className={FORM_GRID.normal}>
        <FormField label="Name" required span={2}><TextBox {...box} field="name" /></FormField>
        <FormField label="Status" required><SelectBox value={customer.status} onValueChange={(value) => set('status', value)} options={pairOptions(meta.statuses)} /></FormField>
        <FormField label="Type"><SelectBox {...NONE} value={customer.customerType} onValueChange={(value) => set('customerType', value)} options={pairOptions(meta.customerTypes)} /></FormField>
        <FormField label="Segment"><SelectBox {...NONE} value={customer.segment} onValueChange={(value) => set('segment', value)} options={pairOptions(meta.segments)} /></FormField>
        <FormField label="Industry"><SelectBox {...NONE} value={customer.industry} onValueChange={(value) => set('industry', value)} options={lookupOptions(meta, 'INDUSTRY', customer.industry)} /></FormField>
        <FormField label="Source"><SelectBox {...NONE} value={customer.source} onValueChange={(value) => set('source', value)} options={lookupOptions(meta, 'SOURCE', customer.source)} /></FormField>
        <FormField label="Source detail" note="Who referred / which fair / which agent"><TextBox {...box} field="sourceDetail" /></FormField>
        <FormField label="Branch"><SelectBox {...NONE} value={customer.branchCode} onValueChange={(value) => set('branchCode', value)} options={branchOptions(meta)} /></FormField>
        <FormField label="First contact"><DateInput value={customer.firstContactDate} onValueChange={(value) => set('firstContactDate', value)} /></FormField>
        <FormField label="Next review" note="Account review / visit due"><DateInput value={customer.nextReviewDate} onValueChange={(value) => set('nextReviewDate', value)} /></FormField>
      </div>
      {customer.status === 'LOST' && (
        <div className={`${FORM_GRID.normal} tw:mt-2 tw:rounded-md tw:bg-muted tw:p-2`}>
          <FormField label="Lost reason" required>
            <SelectBox {...NONE} value={customer.lostReason} onValueChange={(value) => set('lostReason', value)} options={activeLookups(meta, 'LOST_REASON').map((lookup) => lookup.value)} />
          </FormField>
          <FormField label="Lost to (competitor)"><ComboInput options={competitorNames(meta)} value={customer.lostTo} onValueChange={(value) => set('lostTo', value)} /></FormField>
          <FormField label="Lost on"><DateInput value={customer.lostDate} onValueChange={(value) => set('lostDate', value)} /></FormField>
        </div>
      )}
      <div className="tw:mt-2.5">
        <CheckGrid label="Services it uses / can use" options={meta.services || []} value={customer.services} onChange={(codes) => set('services', codes.join(','))} />
      </div>
    </FormSection>
  );
}

const HISTORY_COLUMNS = [
  { key: 'personName', header: 'KAM' },
  { key: 'fromDate', header: 'From', cell: (row) => dmy(row.fromDate) },
  { key: 'toDate', header: 'To', cell: (row) => (row.toDate ? dmy(row.toDate) : 'now') },
  { key: 'reason', header: 'Reason', className: 'tw:whitespace-normal' },
  { key: 'changedBy', header: 'By' },
];

export function SalesTeamSection({ customer, set, meta, isNew, kamChanged, kamReason, onKamReason }) {
  const persons = activePersons(meta);
  const marketingNames = customer.figures?.marketingNames || [];
  return (
    <FormSection title="Sales team">
      <div className={FORM_GRID.wide}>
        <FormField label="KAM (main sales person)">
          <SelectBox
            clearable
            clearLabel="- No KAM -"
            placeholder="- No KAM -"
            value={customer.kamId}
            disabled={!isNew && !meta.canManage}
            onValueChange={(value) => set('kamId', value ? Number(value) : '')}
            options={persons.map((person) => ({ value: person.id, label: `${person.name}${person.role ? ` (${person.role.toLowerCase()})` : ''}` }))}
          />
        </FormField>
        {kamChanged && (
          <FormField label="Why is the KAM changed?" required span={2}>
            <Input value={kamReason} onChange={(event) => onKamReason(event.target.value)} placeholder="e.g. Deepak left, re-allocated to Atul" />
          </FormField>
        )}
      </div>
      <div className="tw:mt-2">
        <CheckGrid
          label="Other sales persons on this account"
          options={persons.filter((person) => String(person.id) !== String(customer.kamId)).map((person) => [String(person.id), person.name])}
          value={customer.secondaryIds}
          onChange={(codes) => set('secondaryIds', codes.join(','))}
        />
      </div>
      {(customer.history || []).length > 0 && <DataTable className="tw:mt-2" columns={HISTORY_COLUMNS} rows={customer.history} />}
      {marketingNames.length > 0 && (
        <Muted className="tw:mt-1.5">Marketing person on its dockets: {marketingNames.map((name) => `${name.name} (${name.dockets})`).join(', ')}</Muted>
      )}
    </FormSection>
  );
}

const LEDGER_KINDS = [{ value: 'REIMB', label: 'Duty / DO / reimbursement' }, { value: 'OTHER', label: 'Service (other state / branch)' }];
const looksLikeDutyLedger = (ledger) => /DUTY|\bDO\b|DIRECT PARTY/i.test(`${ledger.name} ${ledger.groupName || ''}`);

export function LedgersSection({ customer, customerId, onPickMain, setRow, addRow, removeRow }) {
  const ledger = customer.ledger;
  const otherLedgers = customer.ledgers || [];
  const addOther = (picked) => {
    if (picked.id === customer.ledgerId || otherLedgers.some((linked) => linked.ledgerId === picked.id)) {
      toast.error('Already linked');
      return;
    }
    addRow('ledgers', { ledgerId: picked.id, name: picked.name, gstin: picked.gstin, groupName: picked.groupName, kind: looksLikeDutyLedger(picked) ? 'REIMB' : 'OTHER' });
  };
  return (
    <FormSection title="Accounts ledgers" actions={<Muted>Billing is read from these ledgers</Muted>}>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] tw:gap-x-3 tw:gap-y-2">
        <FormField label={customer.status === 'ACTIVE' ? 'Main ledger' : 'Main ledger (when it is billed)'} required={customer.status === 'ACTIVE'} span={2}>
          <LedgerPick ledgerId={customer.ledgerId} label={customer.ledgerName || ledger?.name || ''} keep={customerId} onPick={onPickMain} />
        </FormField>
        {ledger && (
          <FormField label="Ledger group">
            <div className="tw:pt-1 tw:text-entry">
              {ledger.groupName}{ledger.creditDays ? ` · credit ${ledger.creditDays} days` : ''}{ledger.creditLimit ? ` · limit ${inr(ledger.creditLimit)}` : ''}{ledger.isBlacklisted ? ' · BLACKLISTED' : ''}
            </div>
          </FormField>
        )}
      </div>
      <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-1">
        <Muted className="tw:text-entry">Other ledgers of this customer (duty account, DO account, another state / GSTIN)</Muted>
        {otherLedgers.map((linked, index) => (
          <div key={index} className="tw:flex tw:flex-col tw:gap-1.5 tw:sm:flex-row tw:sm:items-center">
            <div className="tw:min-w-0 tw:flex-1 tw:text-entry">
              {linked.name} <span className="tw:text-[10.5px] tw:text-muted-foreground">{[linked.gstin, linked.groupName].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="tw:flex tw:items-center tw:gap-1.5">
              <SelectBox className="tw:w-full tw:sm:w-[220px]" value={linked.kind} onValueChange={(value) => setRow('ledgers', index, 'kind', value)} options={LEDGER_KINDS} />
              <Button variant="destructive" size="icon" aria-label="Remove ledger" onClick={() => removeRow('ledgers', index)}><Trash2 /></Button>
            </div>
          </div>
        ))}
        <div className="tw:mt-1 tw:max-w-[520px]">
          <LedgerPick all keep={customerId} onPick={addOther} />
        </div>
      </div>
    </FormSection>
  );
}

export function AddressSection({ customer, set, meta }) {
  const box = { customer, set };
  const changeGstin = (event) => {
    const gstin = event.target.value.toUpperCase();
    set('gstin', gstin);
    if (gstin.length === 15 && !customer.pan) set('pan', gstin.slice(2, 12));
  };
  return (
    <FormSection title="Address and registration">
      <div className={FORM_GRID.normal}>
        <FormField label="Address" span={3}><TextBox {...box} field="address" /></FormField>
        <FormField label="City"><TextBox {...box} field="city" /></FormField>
        <FormField label="State"><TextBox {...box} field="state" /></FormField>
        <FormField label="Country"><SelectBox {...NONE} value={customer.country} onValueChange={(value) => set('country', value)} options={countryOptions(meta)} /></FormField>
        <FormField label="PIN"><TextBox {...box} field="pinCode" /></FormField>
        <FormField label="GSTIN"><Input value={customer.gstin} maxLength={15} onChange={changeGstin} /></FormField>
        <FormField label="PAN"><TextBox {...box} field="pan" upper maxLength={10} /></FormField>
        <FormField label="IEC"><TextBox {...box} field="iec" upper maxLength={10} /></FormField>
        <FormField label="Website"><TextBox {...box} field="website" /></FormField>
        <FormField label="Office phone"><TextBox {...box} field="phone" /></FormField>
        <FormField label="Office e-mail"><TextBox {...box} field="email" /></FormField>
        <FormField label="Turnover"><SelectBox {...NONE} value={customer.turnoverBand} onValueChange={(value) => set('turnoverBand', value)} options={meta.turnover || []} /></FormField>
        <FormField label="Employees"><TextBox {...box} field="employees" placeholder="e.g. 50-200" /></FormField>
      </div>
    </FormSection>
  );
}

const POTENTIAL_FIELDS = [
  ['potentialAirKg', 'Air (kg)'],
  ['potentialSeaFclTeu', 'Sea FCL (TEU)'],
  ['potentialSeaLclCbm', 'Sea LCL (CBM)'],
  ['potentialCustomsJobs', 'Customs jobs', 0],
  ['potentialTrucks', 'Trucks', 0],
  ['potentialRevenue', 'Revenue (Rs)'],
  ['currentSharePct', 'Our share (%)'],
];

export function PotentialSection({ customer, set, meta }) {
  return (
    <FormSection title="Potential and competition" actions={<Muted>Per month</Muted>}>
      <div className={FORM_GRID.narrow}>
        {POTENTIAL_FIELDS.map(([field, label, decimals]) => (
          <FormField key={field} label={label}><NumberBox customer={customer} set={set} field={field} decimals={decimals} /></FormField>
        ))}
        <FormField label="Competitors working with it" span={2}>
          <ComboInput options={competitorNames(meta)} value={customer.competitors} onValueChange={(value) => set('competitors', value)} placeholder="Comma between names" />
        </FormField>
      </div>
    </FormSection>
  );
}

export function CreditSection({ customer, set, meta }) {
  return (
    <FormSection title="Credit asked by the customer" actions={<Muted>Approved terms are on the ledger</Muted>}>
      <div className={FORM_GRID.normal}>
        <FormField label="Terms"><SelectBox {...NONE} value={customer.creditTerm} onValueChange={(value) => set('creditTerm', value)} options={pairOptions(meta.creditTerms)} /></FormField>
        <FormField label="Days asked"><NumberBox customer={customer} set={set} field="creditDaysAsked" decimals={0} /></FormField>
        <FormField label="Limit asked (Rs)"><NumberBox customer={customer} set={set} field="creditLimitAsked" /></FormField>
      </div>
    </FormSection>
  );
}

export function RemarksSection({ customer, set }) {
  return (
    <FormSection title="Remarks">
      <Textarea className="tw:min-h-[60px]" value={customer.remarks} onChange={(event) => set('remarks', event.target.value)} />
    </FormSection>
  );
}
