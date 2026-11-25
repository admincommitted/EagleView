import { Search } from 'lucide-react';
import { Button, ComboInput, DateInput, Field, FlagInput, Input, NumberInput, Section } from '@/components/ui';

const TERMS = [
  { value: 'FOB', label: 'free on board (freight and insurance are declared)' },
  { value: 'CF', label: 'cost and freight (freight included; insurance is declared)' },
  { value: 'CI', label: 'cost and insurance (insurance included; freight is declared)' },
  { value: 'CIF', label: 'cost, insurance and freight (both included)' },
];
const NATURE = [['S', 'Sale'], ['C', 'Consignment'], ['H', 'Hire'], ['F', 'Free of cost'], ['O', 'Others'], ['R', 'Rent / lease'], ['P', 'Purchase on high seas'], ['G', 'Gift'], ['M', 'Mixed']].map(([value, label]) => ({ value, label }));
const PAYMENT = [['OTH', 'Others'], ['AP', 'Advance payment'], ['DP', 'Delivery against payment'], ['DA', 'Delivery against acceptance'], ['LC', 'Letter of credit'], ['FC', 'Free of cost']].map(([value, label]) => ({ value, label }));
const VALUATION = ['Rule4 Transaction Value', 'Rule5 Identical Goods', 'Rule6 Similar Goods', 'Rule7 Deductive Value', 'Rule7A Computed Value', 'Rule8 Residual Method Others', 'Rule3 Determination method of valuation'];
const CONDITION_LINES = [1, 2, 3, 4, 5];

const Open = ({ onClick, title }) => <Button size="sm" variant="secondary" onClick={onClick} title={title}>Open</Button>;

const rateTitleFor = (rateRow) => {
  if (!rateRow) return 'No exchange rate for this currency - use "Update Exchange Rate"';
  const units = Number(rateRow.unitInRs);
  const perUnits = units > 1 ? ` per ${rateRow.unitInRs} ${rateRow.currencyCode} (CBIC Schedule II), i.e. Rs ${(Number(rateRow.rate) / units).toFixed(4)} each` : '';
  const effective = rateRow.effectiveDate ? ` w.e.f. ${String(rateRow.effectiveDate).slice(0, 10)}` : '';
  const source = rateRow.source ? ` (${rateRow.source})` : '';
  return `Exchange rate ${rateRow.rate}${perUnits}${effective}${source}`;
};

const supplierAddressFrom = (party, previous) => {
  const branch = party.branches?.find((candidate) => candidate.isDefault) || party.branches?.[0] || null;
  return {
    supplierName: party.name,
    supplierAddress1: (branch ? branch.address1 : party.street) || previous.supplierAddress1,
    supplierAddress2: (branch ? [branch.address2, branch.city].filter(Boolean).join(', ') : party.city) || previous.supplierAddress2,
    supplierAddress3: (branch ? [branch.state, branch.pinCode].filter(Boolean).join(' ') : [party.stateProvince, party.zipPostcode].filter(Boolean).join(' ')) || previous.supplierAddress3,
    supplierCountry: branch?.country || party.countryCode || previous.supplierCountry,
  };
};

export default function InvoiceDetailsSection({ ctx }) {
  const {
    handleBrokerChange, handleConditionsChange, handleInvoiceFieldChange, handleMiscIncludedChange, handleMiscNotIncludedChange, handleOtherInfoChange,
    handleSupplierSellerChange, handleSvbChange, handleTermsChange, invoiceFormData, invoices, masters, previewRateFor, setActiveTerm, setInvoiceFormData,
    setIsAddressModalOpen, setIsBrokerModalOpen, setIsConditionsModalOpen, setIsMiscIncludedModalOpen, setIsMiscNotIncludedModalOpen, setIsOtherInfoModalOpen,
    setIsSellerModalOpen, setIsSvbModalOpen, setIsTermsModalOpen,
  } = ctx;
  const form = invoiceFormData || {};
  const setField = (name) => (value) => handleInvoiceFieldChange({ target: { name, value } });
  const setFormValue = (name) => (value) => setInvoiceFormData((previous) => ({ ...previous, [name]: value }));
  const flagChange = (name, onFlag) => (value) => {
    const event = { target: { name, value } };
    handleInvoiceFieldChange(event);
    if (onFlag) onFlag(event);
  };

  const rateRow = previewRateFor(form.currency || form.invoiceCurrency);
  const savedIndex = form.id ? invoices.findIndex((invoice) => invoice.id === form.id) : -1;
  const serialNo = savedIndex !== -1 ? String(savedIndex + 1) : `${invoices.length + 1} (new)`;
  const conditionLines = CONDITION_LINES.filter((line) => form[`conditionsAttachedWithSale${line}`]).length;

  const flagRow = (label, name, onFlag, open, openTitle, note, derived, required = true) => (
    <Field label={label} required={required} labelWidth="230px">
      <FlagInput name={name} required={required} value={form[name] || (derived ? 'Y' : '')} onValueChange={flagChange(name, onFlag)} />
      {open && <Open onClick={open} title={openTitle} />}
      {note ? <span className="tw:min-w-0 tw:truncate tw:text-[11px] tw:text-muted-foreground">{note}</span> : null}
    </Field>
  );

  return (
    <>
      <Section title="Invoice Details">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-1.5">
          <Field label="Invoice Sr No" className="tw:flex-1 tw:min-w-36">
            <Input readOnly value={serialNo} title="Set by the order of the invoices (use Arrange Sr No)" />
          </Field>
          <Field label="Invoice No" required className="tw:flex-[1.5] tw:min-w-48">
            <Input name="invNo" required value={form.invNo || ''} onChange={handleInvoiceFieldChange} />
          </Field>
          <Field label="Invoice Date" className="tw:flex-[1.2] tw:min-w-44">
            <DateInput name="invDate" value={form.invDate || form.invoiceDate || ''} onValueChange={setField('invDate')} />
          </Field>
          <Field label="Invoice Value" required className="tw:flex-[1.2] tw:min-w-44">
            <NumberInput name="value" required value={form.value || form.invValue || ''} onValueChange={setField('value')} />
          </Field>
          <Field label="Currency" required className="tw:flex-1 tw:min-w-48">
            <ComboInput name="currency" upper maxLength={3} required placeholder="CUR" options={masters?.currencies || []}
              getValue={(currency) => currency.currencyCode} getLabel={(currency) => currency.currencyName}
              value={form.currency || ''} onValueChange={setFormValue('currency')}
              onSelect={(currency) => setFormValue('currency')(currency.currencyCode)} />
            <Input readOnly placeholder="RATE" title={rateTitleFor(rateRow)} aria-invalid={!rateRow && !!form.currency && String(form.currency).toUpperCase() !== 'INR'}
              value={rateRow ? String(rateRow.rate) + (Number(rateRow.unitInRs) > 1 ? `/${rateRow.unitInRs}` : '') : ''}
              className="tw:w-[72px] tw:flex-none tw:text-right" />
          </Field>
        </div>

        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-1.5">
          <Field label={<>Terms <span className="tw:text-muted-foreground">[FOB/CF/CI/CIF]</span></>} required className="tw:flex-1 tw:min-w-56">
            <ComboInput name="terms" upper maxLength={4} required placeholder="FOB" options={TERMS}
              value={form.terms || form.termsOfInvoice || ''}
              onValueChange={(value) => { const event = { target: { name: 'terms', value } }; handleInvoiceFieldChange(event); handleTermsChange(event); }} />
            <Open onClick={() => { setActiveTerm(String(form.terms || form.termsOfInvoice || '').toUpperCase()); setIsTermsModalOpen(true); }} title="Freight / insurance for these terms (the same boxes are on the form below)" />
          </Field>
          <Field label={<>Miscellaneous Charges <span className="tw:text-muted-foreground">[Included]</span></>} className="tw:flex-[1.5] tw:min-w-64">
            <FlagInput name="miscChargesIncluded" value={form.miscChargesIncluded || ''} onValueChange={flagChange('miscChargesIncluded', handleMiscIncludedChange)} />
            <Open onClick={() => setIsMiscIncludedModalOpen(true)} title="Charges already included in the invoice value" />
          </Field>
          <Field label={<>Miscellaneous Charges <span className="tw:text-muted-foreground">[Not Included]</span></>} className="tw:flex-[1.5] tw:min-w-64">
            <FlagInput name="miscChargesNotIncluded" value={form.miscChargesNotIncluded || ''} onValueChange={flagChange('miscChargesNotIncluded', handleMiscNotIncludedChange)} />
            <Open onClick={() => setIsMiscNotIncludedModalOpen(true)} title="Charge-wise rows not included in the invoice value (brokerage, packing, royalties ...)" />
          </Field>
        </div>
      </Section>

      <div className="tw:flex tw:flex-1 tw:flex-wrap tw:gap-4">
        <Section title="Supplier's Details" className="tw:w-full tw:md:w-auto tw:md:min-w-[420px] tw:md:flex-[1.2]">
          <Field label="Supplier Name" labelWidth="150px">
            <ComboInput name="supplierName" placeholder="Search supplier..." options={masters?.parties || []}
              getValue={(party) => party.name} filter={(party, query) => String(party.name || '').toLowerCase().includes(query.toLowerCase())}
              renderOption={(party) => (
                <div className="tw:flex tw:min-w-0 tw:flex-col">
                  <span className="tw:truncate tw:font-semibold tw:text-primary">{party.name}</span>
                  <span className="tw:truncate tw:text-[11px] tw:text-muted-foreground">{[party.street, party.city, party.stateProvince].filter(Boolean).join(', ')}</span>
                </div>
              )}
              value={form.supplierName || ''}
              onValueChange={setFormValue('supplierName')}
              onSelect={(party) => setInvoiceFormData((previous) => ({ ...previous, ...supplierAddressFrom(party, previous) }))} />
          </Field>
          <Field label="Address1" labelWidth="150px">
            <Input name="supplierAddress1" value={form.supplierAddress1 || ''} onChange={handleInvoiceFieldChange} />
            <Button size="icon-sm" variant="default" onClick={() => setIsAddressModalOpen(true)} title="Pick one of the supplier's addresses (Party master)"><Search /></Button>
          </Field>
          <Field label="Address2" labelWidth="150px"><Input name="supplierAddress2" value={form.supplierAddress2 || ''} onChange={handleInvoiceFieldChange} /></Field>
          <Field label="Address3" labelWidth="150px"><Input name="supplierAddress3" value={form.supplierAddress3 || ''} onChange={handleInvoiceFieldChange} /></Field>
          <Field label="Country" labelWidth="150px">
            <ComboInput name="supplierCountry" upper placeholder="Search..." options={masters?.countries || []}
              getValue={(country) => country.code} getLabel={(country) => country.name}
              value={form.supplierCountry || ''} onValueChange={setFormValue('supplierCountry')}
              onSelect={(country) => setFormValue('supplierCountry')(country.code)} />
          </Field>
          <Field label="PIN / Zip" labelWidth="150px">
            <Input name="supplierPin" maxLength={10} placeholder="supplier's post code" value={form.supplierPin || ''} onChange={handleInvoiceFieldChange} />
          </Field>
          <div className="tw:mt-1 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:md:flex-nowrap">
            <Field label="Is Supplier & Seller Same" required labelWidth="150px">
              <FlagInput name="supplierSellerSame" required value={form.supplierSellerSame || ''} onValueChange={flagChange('supplierSellerSame', handleSupplierSellerChange)} />
              <Open onClick={() => setIsSellerModalOpen(true)} title="Seller (when the seller is not the supplier): name, address, country, PIN" />
            </Field>
            <Field label="Broker Details" required className="tw:ml-auto">
              <FlagInput name="brokerFlag" required value={form.brokerFlag || ''} onValueChange={flagChange('brokerFlag', handleBrokerChange)} />
              <Open onClick={() => setIsBrokerModalOpen(true)} title="Broker: name, address, country, PIN" />
            </Field>
          </div>
        </Section>

        <Section title="Other Invoice Details" className="tw:w-full tw:md:w-auto tw:md:min-w-[420px] tw:md:flex-1">
          {flagRow('SVB Loading', 'svbLoadingFlag', handleSvbChange, () => setIsSvbModalOpen(true), 'SVB details: reference no, date, load on value / duty',
            form.svbReferenceNumber ? `Ref ${form.svbReferenceNumber}` : '', !!form.svbReferenceNumber)}
          <Field label="Whether Buyer and Seller are Related" required labelWidth="230px">
            <FlagInput name="whetherBuyerAndSellerAreRelated" required value={form.whetherBuyerAndSellerAreRelated || form.buyerSellerRelated || ''} onValueChange={setField('whetherBuyerAndSellerAreRelated')} />
          </Field>
          <Field label="Nature Of Transaction" required labelWidth="230px">
            <ComboInput name="natureOfTransaction" upper maxLength={1} required options={NATURE} value={form.natureOfTransaction || ''} onValueChange={setField('natureOfTransaction')} />
          </Field>
          <Field label="Terms Of Payment" required labelWidth="230px">
            <ComboInput name="paymentTerms" upper maxLength={3} required placeholder="OTH" options={PAYMENT} value={form.paymentTerms || ''} onValueChange={setField('paymentTerms')} />
          </Field>
          {flagRow('Other Relevant Information', 'otherInfoFlag', handleOtherInfoChange, () => setIsOtherInfoModalOpen(true), 'Other relevant information declared with the invoice',
            form.otherRelevantInform || '', !!form.otherRelevantInform)}
          {flagRow('Conditions / Restrictions on Sale', 'conditionsFlag', handleConditionsChange, () => setIsConditionsModalOpen(true), 'Conditions / restrictions attached with the sale (up to 5 lines)',
            conditionLines ? `${conditionLines} line(s)` : '', conditionLines > 0)}
          <Field label="Valuation Method" required labelWidth="230px">
            <ComboInput name="valuationMethod" required options={VALUATION} value={form.valuationMethod || ''} onValueChange={setField('valuationMethod')} />
          </Field>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-1.5">
            <Field label="Third Party Details">
              <FlagInput name="thirdPartyFlag" value={form.thirdPartyFlag || ''} onValueChange={flagChange('thirdPartyFlag')} />
            </Field>
            <Field label="AEO Details">
              <FlagInput name="aeoFlag" value={form.aeoFlag || ''} onValueChange={flagChange('aeoFlag')} />
            </Field>
            <Field label="Additional Details">
              <FlagInput name="additionalDetailsFlag" value={form.additionalDetailsFlag || ''} onValueChange={flagChange('additionalDetailsFlag')} />
            </Field>
          </div>
        </Section>
      </div>
    </>
  );
}
