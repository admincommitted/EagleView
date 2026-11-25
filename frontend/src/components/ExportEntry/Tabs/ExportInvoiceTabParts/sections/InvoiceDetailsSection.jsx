import { Badge, Button, ComboInput, DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { perUnit, rateText, toNotation, unitsOf, PER_100_CURRENCIES } from '@/utils/cbicExchange';
import FormPanel from './FormPanel';
import SegmentedChoice from './SegmentedChoice';
import { ADD_FLAG_OF_CONTRACT } from '../invoiceRules';

const LABEL_WIDTH = '92px';
const STANDARD_RATE_OPTIONS = [{ value: 'N', label: 'Std' }, { value: 'Y', label: 'Non-std' }];
const PAYMENT_NATURE_OPTIONS = [
  { value: 'DP', label: 'DP - Delivery against Payment' },
  { value: 'DA', label: 'DA - Delivery against Acceptance' },
  { value: 'AP', label: 'AP - Advance Payment' },
  { value: 'LC', label: 'LC - Letter of Credit' },
  { value: 'NA', label: 'NA - Not Applicable' },
];
const CONSIGNEE_IS_BUYER_OPTIONS = [{ value: 'Y', label: 'Y - Same' }, { value: 'N', label: 'N - Different' }];
const ADD_FLAG_OPTIONS = [{ value: 'F', label: 'F - Freight' }, { value: 'I', label: 'I - Insurance' }, { value: 'N', label: 'N - None' }, { value: 'B', label: 'B - Both' }];

const currencyMatches = (currency, query) => {
  const text = query.toLowerCase();
  return currency.currencyCode?.toLowerCase().includes(text) || currency.currencyName?.toLowerCase().includes(text);
};

const currencyOption = (currency) => (
  <span className="tw:flex tw:flex-col">
    <b className="tw:text-[11px] tw:text-primary">{currency.currencyCode}</b>
    <span className="tw:text-[10px] tw:text-muted-foreground">{currency.currencyName}</span>
  </span>
);

const titled = (label, title) => <span title={title}>{label}</span>;

export default function InvoiceDetailsSection({ ctx }) {
  const {
    invoices, currencies, exportData, formData, setFormData, setField, selectedId, natureOfContract, handleNatureOfContractChange,
    addFreightInsurance, setAddFreightInsurance, igstBasedOn, setIgstBasedOn, consigneeSame, handleConsigneeSameChange, buyerDetails, setShowBuyerModal,
  } = ctx;
  const currency = String(formData.currency || '').trim().toUpperCase();
  const manualRate = formData.nonStandardCurr === 'Y';
  const usualAddFlag = ADD_FLAG_OF_CONTRACT[natureOfContract];
  const rateReading = formData.exchRate && formData.currency
    ? `Read as ${rateText(formData.currency, formData.exchRate, formData.unitInRs)} = Rs ${perUnit(formData.currency, formData.exchRate, formData.unitInRs).toFixed(4)} for one ${currency}`
    : '';
  const serial = invoices.findIndex((invoice) => invoice.id === selectedId) + 1;

  // the master holds the rate for ONE unit; it is put into CBIC notation here (x100 for JPY / KRW)
  const pickCurrency = (master) => {
    const notation = toNotation(master.currencyCode, master.exportRate);
    setFormData((previous) => ({ ...previous, currency: master.currencyCode, exchRate: notation.rate, unitInRs: notation.unitInRs, nonStandardCurr: 'N' }));
  };
  const typeCurrency = (typed) => {
    const code = String(typed || '').toUpperCase();
    setFormData((previous) => ({ ...previous, currency: code, unitInRs: unitsOf(code) }));
  };

  return (
    <FormPanel
      title="Invoice Details"
      note={selectedId ? `editing invoice ${serial || ''} (${formData.no || ''}) - Save / Modify keep the changes (Clear for a new one)` : 'new invoice - Save adds it'}
      noteClassName={selectedId ? 'tw:text-warning' : 'tw:text-success'}
    >
      <div className="tw:grid tw:grid-cols-1 tw:items-center tw:gap-x-3 tw:gap-y-1.5 tw:md:grid-cols-2 tw:lg:grid-cols-4">
        <Field label="Invoice No" required labelWidth={LABEL_WIDTH}>
          <Input data-allow-text="" required maxLength={17} value={formData.no || ''} onChange={(event) => setField('no', event.target.value.toUpperCase())} />
        </Field>
        <Field label="Invoice Date" required labelWidth={LABEL_WIDTH}>
          <DateInput required value={formData.date} onValueChange={(date) => setField('date', date)} />
        </Field>
        <Field label="Inv. Value" required labelWidth={LABEL_WIDTH}>
          <NumberInput required align="right" className="tw:font-bold" value={formData.value || ''} onValueChange={(value) => setField('value', value)} />
        </Field>
        <Field label="Curr / Rate" required labelWidth={LABEL_WIDTH}>
          <ComboInput upper required placeholder="Curr" className="tw:w-[70px] tw:flex-none" listClassName="tw:min-w-56"
            options={currencies} getValue={(master) => master.currencyCode} getLabel={(master) => master.currencyName}
            filter={currencyMatches} renderOption={currencyOption}
            value={formData.currency} onValueChange={typeCurrency} onSelect={pickCurrency} />
          <NumberInput align="right" placeholder="Rate" readOnly={!manualRate} tabIndex={manualRate ? 0 : -1}
            title={(manualRate ? 'Manual entry enabled. ' : 'Rate of the currency master (CBIC). Set Non-std = Y to type it. ') + rateReading}
            value={formData.exchRate || ''} onValueChange={(rate) => setField('exchRate', rate)} />
          {PER_100_CURRENCIES.includes(currency) && (
            <Badge variant="warning" className="tw:shrink-0" title={`CBIC notifies ${currency} in Schedule II - rupees per 100 units. Type the notification figure as it is.`}>per 100</Badge>
          )}
          <SelectBox name="nonStandardCurr" className="tw:w-[74px] tw:flex-none" options={STANDARD_RATE_OPTIONS}
            value={manualRate ? 'Y' : 'N'} onValueChange={(answer) => setField('nonStandardCurr', answer)} />
        </Field>

        <Field label="Pymt. Nature" labelWidth={LABEL_WIDTH}>
          <SelectBox name="pymtNature" clearable clearLabel="Select" placeholder="Select" options={PAYMENT_NATURE_OPTIONS}
            value={String(formData.pymtNature || '').slice(0, 2).toUpperCase()} onValueChange={(nature) => setField('pymtNature', nature)} />
        </Field>
        <Field label="Pymt. Period" labelWidth={LABEL_WIDTH}>
          <NumberInput name="pymtPeriod" decimals={0} maxLength={3} align="right" placeholder="days (e.g. 180)"
            value={formData.pymtPeriod || ''} onValueChange={(days) => setField('pymtPeriod', days.slice(0, 3))} />
        </Field>
        <Field label="Contract No." labelWidth={LABEL_WIDTH}>
          <Input name="contractNo" data-allow-text="" value={formData.contractNo || ''} onChange={(event) => setField('contractNo', event.target.value)} />
        </Field>
        <Field label={titled('Cons = Buyer', 'Is Consignee and Buyer same [Y/N]? Y = consignee of the SB Header goes as buyer')} labelWidth={LABEL_WIDTH}>
          <SelectBox className="tw:w-[130px] tw:flex-none" options={CONSIGNEE_IS_BUYER_OPTIONS} value={consigneeSame} onValueChange={handleConsigneeSameChange} />
          <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-[11px] tw:font-semibold tw:text-foreground" title="Buyer sent in the SB">
            {consigneeSame === 'Y' ? (exportData.consigneeName || '(consignee of SB Header)') : (buyerDetails.name || formData.buyer || '-')}
          </span>
          {consigneeSame === 'N' && <Button variant="secondary" size="sm" onClick={() => setShowBuyerModal(true)}>Edit</Button>}
        </Field>

        <Field label="Contract" labelWidth={LABEL_WIDTH}>
          <SegmentedChoice value={natureOfContract} options={['FOB', 'CI', 'CIF', 'CF']} onChange={handleNatureOfContractChange} title="Nature of contract (CF / CI / CIF / FOB)" />
        </Field>
        <Field label={titled('Add F/I/N/B', 'Unit price includes: Freight / Insurance / None / Both (ICEGATE: CIF = B, CI = I, CF = F, FOB = N)')} labelWidth={LABEL_WIDTH}>
          <SelectBox className="tw:w-[120px] tw:flex-none" options={ADD_FLAG_OPTIONS} value={addFreightInsurance} onValueChange={setAddFreightInsurance} />
          {addFreightInsurance !== usualAddFlag && (
            <span className="tw:whitespace-nowrap tw:text-[10px] tw:text-warning" title="ICEGATE advisory: CIF-B, CI-I, CF-F, FOB-N">âš  usually {usualAddFlag}</span>
          )}
        </Field>
        <Field label="Inv FOB â‚¹" labelWidth={LABEL_WIDTH}>
          <Input name="invFobInr" readOnly tabIndex={-1} className="tw:text-right tw:font-bold" value={formData.invFobInr || ''} title="Invoice FOB in INR, worked out from value, rate and charges" />
        </Field>
        <Field label="IGST Based On" labelWidth={LABEL_WIDTH}>
          <SegmentedChoice value={igstBasedOn} options={['CIF', 'FOB', 'MANUAL']} onChange={setIgstBasedOn} title="Value the IGST is worked out on" />
        </Field>

        <Field label="AEO Code" labelWidth={LABEL_WIDTH}>
          <Input name="aeoCode" data-allow-text="" value={formData.aeoCode || ''} onChange={(event) => setField('aeoCode', event.target.value)} />
        </Field>
        <Field label="AEO Country" labelWidth={LABEL_WIDTH}>
          <Input name="aeoCountry" data-allow-text="" placeholder="country name" value={formData.aeoCountry || ''} onChange={(event) => setField('aeoCountry', event.target.value)} />
          <Input name="aeoCountryCode" maxLength={2} placeholder="CC" title="Country code (2 letters)" className="tw:w-11 tw:flex-none tw:text-center"
            value={formData.aeoCountryCode || formData.aeoRoleCntr || ''}
            onChange={(event) => setFormData((previous) => ({ ...previous, aeoCountryCode: event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2), aeoRoleCntr: '' }))} />
        </Field>
        <Field label="AEO Role" labelWidth={LABEL_WIDTH}>
          <Input name="aeoRole" data-allow-text="" value={formData.aeoRole || ''} onChange={(event) => setField('aeoRole', event.target.value)} />
        </Field>
        <Field label="Term Place" labelWidth={LABEL_WIDTH}>
          <Input name="termPlace" data-allow-text="" value={formData.termPlace || ''} onChange={(event) => setField('termPlace', event.target.value)} />
        </Field>
      </div>
    </FormPanel>
  );
}
