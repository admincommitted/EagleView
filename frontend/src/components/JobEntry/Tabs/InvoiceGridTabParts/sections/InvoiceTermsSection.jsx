import { Fragment, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, ComboInput, DataTable, Field, FlagInput, Input, Modal, NumberInput, SelectBox } from '@/components/ui';

const MISC_CHARGES = [
  'BROKERAGE AND COMMISSIONS', 'COST OF CONTAINERS', 'COST OF PACKING', 'HANDLING CHARGES', 'COST OF GOODS AND SERVICES', 'DOCUMENTATION',
  'COUNTRY OF ORIGIN CERTIFICATE', 'LOYALTIES AND LICENCE FEES', 'VALUE OF PROCEEDS WHICH ACCURE', 'COST OF WARRANTY SERVICES', 'OTHER COST OR PAYMENT',
  'OTHER CHARGES AND PAYMENT', 'LOADING CHARGES', 'UNLOADING CHARGES',
];
const icegateCodeOf = (charge) => String.fromCharCode(65 + MISC_CHARGES.indexOf(charge));
const MISC_CHARGE_OPTIONS = MISC_CHARGES.map((charge) => ({ value: charge, label: `${icegateCodeOf(charge)} - ${charge}` }));

const INCLUDED_CHARGES = [
  { label: 'Local Agency Comm.', amount: 'agencyCommAmount', currency: 'agencyCommCurrency', rate: 'agencyCommRate' },
  { label: 'Loading', amount: 'loadingAmount', currency: 'loadingCurrency', rate: 'loadingRate' },
  { label: 'Miscellaneous', amount: 'miscCharges', currency: 'miscCurrency', rate: 'miscChargesRate' },
  { label: 'HSS', amount: 'hssLoadAmount', currency: 'hssCurrency', rate: 'hssLoadRate' },
  { label: 'Discount', amount: 'discountAmount', currency: 'discountCurrency', rate: 'discountRate' },
];

const EMPTY_MISC_ROW = { desc: '', amount: '', rate: '' };
const TERMS_ROW = 'tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:gap-3';

const filled = (value) => String(value ?? '').trim() !== '';

const parseRows = (rows) => {
  if (Array.isArray(rows)) return rows;
  try {
    return JSON.parse(rows) || [];
  } catch {
    return [];
  }
};

function CurrencyInput({ name, form, currencies, onChange, required, className }) {
  return (
    <ComboInput name={name} upper maxLength={3} required={required} className={className} placeholder={form.currency || 'CUR'}
      options={currencies} getValue={(currency) => currency.currencyCode} getLabel={(currency) => currency.currencyName}
      value={form[name] ?? (form.currency || '')} onValueChange={(value) => onChange(name, value)} />
  );
}

function TermsModal({ open, term, form, currencies, setField, onConfirm, onClose }) {
  const declaresFreight = term === 'FOB' || term === 'CI';
  const declaresInsurance = term === 'FOB' || term === 'CF';
  return (
    <Modal open={open} title={<>Invoice Terms <b>({term})</b></>} width={650} onClose={onClose} onOk={onConfirm} closeOnOutside={false}>
      {!declaresFreight && !declaresInsurance && (
        <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">Terms {term || '(none)'} include freight and insurance - nothing to declare here.</p>
      )}
      {declaresFreight && (
        <div className={TERMS_ROW}>
          <Field label="Freight Value" required labelWidth="104px" className="tw:flex-1">
            <NumberInput name="freightValue" required value={form.freightValue || ''} onValueChange={(value) => setField('freightValue', value)} />
          </Field>
          <Field label="Currency" required><CurrencyInput name="freightCurrency" required className="tw:w-[70px] tw:flex-none" form={form} currencies={currencies} onChange={setField} /></Field>
          <Field label="Rate" required><NumberInput name="freightRate" required className="tw:w-14" value={form.freightRate || ''} onValueChange={(value) => setField('freightRate', value)} /></Field>
          <Field label="Actual?" required hint="Is the freight the actual amount paid (Y/N)">
            <FlagInput name="whetherFreightActual" required value={form.whetherFreightActual || ''} onValueChange={(value) => setField('whetherFreightActual', value)} />
          </Field>
        </div>
      )}
      {declaresInsurance && (
        <div className={TERMS_ROW}>
          <Field label="Insurance Value" required labelWidth="104px" className="tw:flex-1">
            <NumberInput name="insuranceValue" required value={form.insuranceValue || ''} onValueChange={(value) => setField('insuranceValue', value)} />
          </Field>
          <Field label="Currency" required><CurrencyInput name="insuranceCurrency" required className="tw:w-[70px] tw:flex-none" form={form} currencies={currencies} onChange={setField} /></Field>
          <Field label="Rate" required><NumberInput name="insuranceRate" required className="tw:w-14" value={form.insuranceRate || ''} onValueChange={(value) => setField('insuranceRate', value)} /></Field>
          <span className="tw:hidden tw:md:block tw:md:w-[86px]" />
        </div>
      )}
    </Modal>
  );
}

function IncludedChargesModal({ open, form, currencies, setField, onFieldChange, onClose }) {
  return (
    <Modal open={open} title="Miscellaneous Charges Specified in Invoice" width={600} onClose={onClose} onOk={onClose} closeOnOutside={false}>
      <div className="tw:grid tw:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.5fr)] tw:items-center tw:gap-2">
        {['Charge Name', 'Charges', 'Curr', 'Rate %'].map((heading) => <span key={heading} className="tw:text-[11px] tw:font-bold tw:text-head">{heading}</span>)}
        {INCLUDED_CHARGES.map((charge) => (
          <Fragment key={charge.label}>
            <span className="tw:text-entry">{charge.label}</span>
            <NumberInput name={charge.amount} value={form[charge.amount] || ''} onValueChange={(value) => setField(charge.amount, value)} />
            <ComboInput name={charge.currency} upper maxLength={3} options={currencies} getValue={(currency) => currency.currencyCode} getLabel={(currency) => currency.currencyName}
              value={form[charge.currency] || ''} onValueChange={(value) => setField(charge.currency, value)} />
            <NumberInput name={charge.rate} value={form[charge.rate] || ''} onValueChange={(value) => setField(charge.rate, value)} />
          </Fragment>
        ))}
        <span className="tw:text-entry">Nature of Discount</span>
        <Input name="natureOfDiscount" className="tw:col-span-3" value={form.natureOfDiscount || ''} onChange={onFieldChange} />
        <span className="tw:text-entry">Landing %</span>
        <NumberInput name="landingRate" placeholder="blank = default" title="Landing charges % (ICEGATE landingRate); leave blank unless a different rate is declared"
          value={form.landingRate || ''} onValueChange={(value) => setField('landingRate', value)} />
      </div>
    </Modal>
  );
}

function NotIncludedChargesModal({ open, rows, onRowsChange, onClose }) {
  const [draft, setDraft] = useState(EMPTY_MISC_ROW);
  const [editingIndex, setEditingIndex] = useState(null);
  const updateDraft = (key) => (value) => setDraft((previous) => ({ ...previous, [key]: value }));

  const saveDraft = () => {
    if (!draft.desc) return toast.error('Select the charge');
    if (filled(draft.amount) === filled(draft.rate)) return toast.error('Give an amount OR a rate');
    const row = { desc: draft.desc, code: icegateCodeOf(draft.desc), amount: draft.amount.trim(), rate: draft.rate.trim() };
    onRowsChange(editingIndex === null ? [...rows, row] : rows.map((existing, index) => (index === editingIndex ? row : existing)));
    setDraft(EMPTY_MISC_ROW);
    setEditingIndex(null);
  };

  const columns = [
    { key: 'edit', header: 'Edit', width: 60, cell: (row, index) => <Button variant="link" size="sm" onClick={() => { setDraft({ desc: row.desc, amount: row.amount || '', rate: row.rate || '' }); setEditingIndex(index); }}><Pencil /> Edit</Button> },
    { key: 'remove', header: 'Remove', width: 80, cell: (_, index) => <Button variant="link" size="sm" className="tw:text-destructive" onClick={() => onRowsChange(rows.filter((__, other) => other !== index))}><Trash2 /> Remove</Button> },
    { key: 'desc', header: 'Miscellaneous Desc.', cell: (row) => `${row.code ? `${row.code} - ` : ''}${row.desc}` },
    { key: 'amount', header: 'Amount', align: 'right', width: 100 },
    { key: 'rate', header: 'Rate', align: 'right', width: 80 },
  ];

  return (
    <Modal open={open} title="Discount / Miscellaneous Details" width={720} onClose={onClose} onOk={onClose} closeOnOutside={false}>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end tw:md:gap-3">
        <Field label="Misc Desc" required layout="col" className="tw:md:flex-[2]">
          <SelectBox required value={draft.desc} onValueChange={updateDraft('desc')} placeholder="Select Charge" options={MISC_CHARGE_OPTIONS} />
        </Field>
        <Field label="Amount" layout="col" className="tw:flex-1"><NumberInput value={draft.amount} onValueChange={updateDraft('amount')} /></Field>
        <span className="tw:pb-1 tw:text-entry tw:font-bold tw:text-muted-foreground">OR</span>
        <Field label="Rate" layout="col" className="tw:flex-1"><NumberInput value={draft.rate} onValueChange={updateDraft('rate')} /></Field>
        <Button variant="default" onClick={saveDraft}><Plus /> {editingIndex === null ? 'Add' : 'Update'}</Button>
      </div>

      <div className="tw:flex tw:flex-wrap tw:gap-4 tw:rounded-sm tw:bg-destructive/5 tw:px-2 tw:py-1.5 tw:text-[11px] tw:text-destructive">
        <b>For Invoice Terms CI:</b>
        <span>(1) D - Handling Charges</span><span>(2) M - Loading Charges</span><span>(3) N - Unloading Charges</span>
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(_, index) => index} selectedKey={editingIndex} emptyText="No charges" containerClassName="tw:min-h-[120px] tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

const ADDRESS_COLUMNS = [
  { key: 'address1', header: 'Address1' },
  { key: 'address2', header: 'Address2' },
  { key: 'city', header: 'City' },
  { key: 'state', header: 'State' },
];

function supplierAddresses(parties, supplierName) {
  const party = parties.find((candidate) => String(candidate.name || '').trim().toUpperCase() === String(supplierName || '').trim().toUpperCase());
  if (!party) return [];
  if (party.branches?.length) {
    return party.branches.map((branch) => ({ address1: branch.address1, address2: branch.address2, city: branch.city, state: branch.state, pin: branch.pinCode, country: branch.country }));
  }
  return [{ address1: party.street, address2: '', city: party.city, state: party.stateProvince, pin: party.zipPostcode, country: party.countryCode }];
}

function AddressSearchModal({ open, parties, supplierName, onPick, onClose }) {
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState(null);
  const addresses = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return supplierAddresses(parties, supplierName).filter((address) => !query || Object.values(address).some((part) => String(part || '').toLowerCase().includes(query)));
  }, [parties, supplierName, filter]);

  const take = (address) => { onPick(address); setPicked(null); };

  return (
    <Modal open={open} title="Search supplier address" width={600} onClose={onClose} onOk={() => (addresses[picked] ? take(addresses[picked]) : onClose())}>
      <Field label="Find" labelWidth="40px">
        <Input placeholder="Enter filter" value={filter} onChange={(event) => setFilter(event.target.value)} autoFocus />
      </Field>
      <DataTable
        columns={ADDRESS_COLUMNS}
        rows={addresses}
        rowKey={(_, index) => index}
        selectedKey={picked}
        onRowClick={(_, index) => setPicked(index)}
        onRowDoubleClick={take}
        rowTitle="Double-click to take this address"
        emptyText={supplierName ? 'No address for this supplier in the Party master' : 'Choose the Supplier Name first'}
        containerClassName="tw:h-[250px] tw:rounded-sm tw:border tw:border-border"
      />
    </Modal>
  );
}

export default function InvoiceTermsSection({ ctx }) {
  const {
    masters, activeTerm, handleInvoiceFieldChange, invoiceFormData: form, setInvoiceFormData,
    isTermsModalOpen, setIsTermsModalOpen, isMiscIncludedModalOpen, setIsMiscIncludedModalOpen,
    isMiscNotIncludedModalOpen, setIsMiscNotIncludedModalOpen, isAddressModalOpen, setIsAddressModalOpen,
  } = ctx;
  const currencies = masters?.currencies || [];
  const setField = (name, value) => handleInvoiceFieldChange({ target: { name, value } });

  const confirmTerms = () => {
    const both = (amount, rate) => filled(form[amount]) && filled(form[rate]);
    if (both('freightValue', 'freightRate') || both('insuranceValue', 'insuranceRate')) {
      return toast.error('Give freight / insurance as an amount OR a rate %, not both');
    }
    setIsTermsModalOpen(false);
    setInvoiceFormData((previous) => ({ ...previous, terms: activeTerm, termsOfInvoice: activeTerm }));
  };

  const pickSupplierAddress = (address) => {
    setInvoiceFormData((previous) => ({
      ...previous,
      supplierAddress1: address.address1 || '',
      supplierAddress2: [address.address2, address.city].filter(Boolean).join(', '),
      supplierAddress3: [address.state, address.pin].filter(Boolean).join(' '),
      supplierCountry: address.country || previous.supplierCountry,
    }));
    setIsAddressModalOpen(false);
  };

  return (
    <>
      <TermsModal open={isTermsModalOpen} term={activeTerm} form={form} currencies={currencies} setField={setField}
        onConfirm={confirmTerms} onClose={() => setIsTermsModalOpen(false)} />
      <IncludedChargesModal open={isMiscIncludedModalOpen} form={form} currencies={currencies} setField={setField}
        onFieldChange={handleInvoiceFieldChange} onClose={() => setIsMiscIncludedModalOpen(false)} />
      <NotIncludedChargesModal open={isMiscNotIncludedModalOpen} rows={parseRows(form.miscChargeRows)}
        onRowsChange={(rows) => setInvoiceFormData((previous) => ({ ...previous, miscChargeRows: rows }))}
        onClose={() => setIsMiscNotIncludedModalOpen(false)} />
      <AddressSearchModal open={isAddressModalOpen} parties={masters?.parties || []} supplierName={form.supplierName}
        onPick={pickSupplierAddress} onClose={() => setIsAddressModalOpen(false)} />
    </>
  );
}

// these wrap a box the floating Field label can sit in
CurrencyInput.floatsLabel = true;
