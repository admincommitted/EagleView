import { X } from 'lucide-react';
import { Button, Checkbox, DataTable, DateInput, Field, Input, NumberInput, Section, SelectBox } from '@/components/ui';
import FieldAutocomplete from '@/components/FieldAutocomplete';
import { LinkButton } from '../awbFormParts';

const PREPAID_OR_COLLECT = ['PP', 'CC'];
const SHIPPER_CERTIFICATION = 'Shipper certifies that the particulars on the face hereof are correct and that insofar as any part of the consignment contains dangerous goods, such part is properly described by name and is in proper condition for carriage by air according to the applicable Dangerous Goods Regulations.';

const twoDecimals = (value) => (value && !Number.isNaN(parseFloat(value)) ? parseFloat(value).toFixed(2) : null);
const shownTotal = (total) => (total > 0 ? total.toFixed(2) : '');

function ChargeBox({ value, onChange }) {
  return (
    <NumberInput value={value} onValueChange={onChange} className="tw:font-bold"
      onBlur={(event) => { const rounded = twoDecimals(event.target.value); if (rounded !== null) onChange(rounded); }} />
  );
}

function PrepaidCollectTable({ ctx }) {
  const {
    dueAgentCC, dueAgentPP, dueCarrierCC, dueCarrierPP, setTaxCC, setTaxPP, setValChargeCC, setValChargePP, setWeightChargeCC,
    setWeightChargePP, taxCC, taxPP, totalCC, totalPP, valChargeCC, valChargePP, weightChargeCC, weightChargePP,
  } = ctx;
  const typedRows = [
    { label: 'Weight Charge', prepaid: [weightChargePP, setWeightChargePP], collect: [weightChargeCC, setWeightChargeCC] },
    { label: 'Valuation Charge', prepaid: [valChargePP, setValChargePP], collect: [valChargeCC, setValChargeCC] },
    { label: 'Tax', prepaid: [taxPP, setTaxPP], collect: [taxCC, setTaxCC] },
  ];
  const totalRows = [
    { label: 'Total Due Agent', prepaid: dueAgentPP, collect: dueAgentCC },
    { label: 'Total Due Carrier', prepaid: dueCarrierPP, collect: dueCarrierCC },
    { label: 'Total', prepaid: totalPP, collect: totalCC },
  ];
  return (
    <div className="tw:grid tw:grid-cols-[minmax(0,150px)_minmax(0,130px)_minmax(0,130px)] tw:items-center tw:gap-x-2 tw:gap-y-1">
      <span />
      <span className="tw:text-center tw:text-[11px] tw:font-bold">Prepaid</span>
      <span className="tw:text-center tw:text-[11px] tw:font-bold">Collect</span>
      {typedRows.map(({ label, prepaid, collect }) => (
        <div key={label} className="tw:contents">
          <span className="tw:text-[11px] tw:font-bold">{label}</span>
          <ChargeBox value={prepaid[0]} onChange={prepaid[1]} />
          <ChargeBox value={collect[0]} onChange={collect[1]} />
        </div>
      ))}
      {totalRows.map(({ label, prepaid, collect }) => (
        <div key={label} className="tw:contents">
          <span className="tw:text-[11px] tw:font-bold">{label}</span>
          <Input readOnly autoComplete="off" value={shownTotal(prepaid)} className="tw:font-bold" />
          <Input readOnly autoComplete="off" value={shownTotal(collect)} className="tw:font-bold" />
        </div>
      ))}
    </div>
  );
}

function CollectSummary({ ctx, destCurrencyPlaceholder }) {
  const { ccChargesDest, destinationCurrency, setCcChargesDest, setDestinationCurrency } = ctx;
  return (
    <div className="tw:flex tw:flex-col tw:gap-1">
      <span className="tw:text-[11px] tw:normal-case tw:text-muted-foreground">For carrier&apos;s use only at destination</span>
      <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:sm:grid-cols-3 tw:lg:grid-cols-5">
        <Field label="Dest. Currency" layout="col">
          <FieldAutocomplete listType="currency" maxLength={3} placeholder={destCurrencyPlaceholder} value={destinationCurrency}
            onChange={(event) => setDestinationCurrency(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Conv. Rate" layout="col"><Input name="conversionRate" autoComplete="off" title="Currency conversion rates" /></Field>
        <Field label="CC Charges" layout="col"><NumberInput value={ccChargesDest} onValueChange={setCcChargesDest} title="CC charges in destination currency" /></Field>
        <Field label="At Destination" layout="col"><Input autoComplete="off" title="Charges at destination" /></Field>
        <Field label="Total Collect" layout="col"><Input autoComplete="off" disabled defaultValue="" title="Total collect charges" /></Field>
      </div>
    </div>
  );
}

function OtherChargesTable({ ctx, removeHeader }) {
  const { handleOtherChargeChange, otherCharges, otherPC, setOtherCharges } = ctx;
  const change = (row, field) => (value) => handleOtherChargeChange(row.id, field, value);
  const entitlementColumn = (entitlement, header) => ({
    key: entitlement, header, align: 'center', width: 60,
    cell: (row) => (
      <Checkbox className="tw:rounded-full" aria-label={header} checked={row.entitlement === entitlement}
        onCheckedChange={() => handleOtherChargeChange(row.id, 'entitlement', entitlement)} />
    ),
  });
  const columns = [
    {
      key: 'code', header: 'CODE', className: 'tw:min-w-[140px]',
      cell: (row) => (
        <FieldAutocomplete listType="charge" value={row.code} placeholder="e.g. AW"
          onChange={(event) => handleOtherChargeChange(row.id, 'code', event.target.value.toUpperCase().substring(0, 2))}
          onSelect={(option) => handleOtherChargeChange(row.id, 'code', option.title)} />
      ),
    },
    entitlementColumn('agent', 'AGENT'),
    entitlementColumn('carrier', 'CARRIER'),
    {
      key: 'ppcc', header: 'PP/CC', align: 'center', width: 70,
      cell: (row) => <SelectBox options={PREPAID_OR_COLLECT} value={row.ppcc || (otherPC === 'C' ? 'CC' : 'PP')} onValueChange={change(row, 'ppcc')} className="tw:font-bold" />,
    },
    { key: 'rate', header: 'RATE', cell: (row) => <NumberInput placeholder="Rate" value={row.rate || ''} onValueChange={change(row, 'rate')} /> },
    {
      key: 'amount', header: 'AMOUNT',
      cell: (row) => (
        <NumberInput value={row.amount} onValueChange={change(row, 'amount')}
          onBlur={(event) => { const rounded = twoDecimals(event.target.value); if (rounded !== null) handleOtherChargeChange(row.id, 'amount', rounded); }} />
      ),
    },
    {
      key: 'remove', header: removeHeader, align: 'center', width: 50,
      cell: (row) => (
        <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Delete Row" onClick={() => setOtherCharges(otherCharges.filter((charge) => charge.id !== row.id))}><X /></Button>
      ),
    },
  ];
  return <DataTable columns={columns} rows={otherCharges} rowKey="id" emptyText="No other charge" />;
}

function ShipperCertification({ ctx, upperCaseSignatures }) {
  const { executedDate, executedPlace, setExecutedDate, setExecutedPlace, setSignatureCarrier, setSignatureShipper, signatureCarrier, signatureShipper } = ctx;
  const typed = (setValue) => (event) => setValue(upperCaseSignatures ? event.target.value.toUpperCase() : event.target.value);
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-start tw:gap-2">
        <Checkbox defaultChecked className="tw:mt-0.5" aria-label="Shipper certification" />
        <span className="tw:text-[11px] tw:leading-snug tw:normal-case tw:text-muted-foreground">{SHIPPER_CERTIFICATION}</span>
      </div>
      <Field label="Shipper's Name or his Agent" required layout="col">
        <Input autoComplete="off" maxLength={20} required value={signatureShipper} onChange={typed(setSignatureShipper)} />
      </Field>
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-[130px_150px_minmax(0,1fr)]">
        <Field label="Executed on (Date)" required layout="col">
          <DateInput id="awb-executed-date" value={executedDate} onValueChange={setExecutedDate} />
        </Field>
        <Field label="Executed at (Place)" required layout="col">
          <Input id="awb-executed-place" autoComplete="off" maxLength={17} required value={executedPlace} onChange={typed(setExecutedPlace)} className="awb-place" />
        </Field>
        <Field label="Name of Issuing Carrier or its Agent" required layout="col">
          <Input autoComplete="off" maxLength={20} required value={signatureCarrier} onChange={typed(setSignatureCarrier)} />
        </Field>
      </div>
    </div>
  );
}

/**
 * Charge declaration, collect summary, other charges and the shipper certification.
 * upperCaseSignatures: names and place are kept in capitals (MAWB).
 */
export default function ChargesSection({ ctx, upperCaseSignatures = false, destCurrencyPlaceholder, removeHeader = 'DEL' }) {
  const { otherCharges, setOtherCharges } = ctx;
  const boxClass = 'tw:rounded-sm tw:border tw:border-border tw:p-2';
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:border-t tw:border-border tw:p-2 tw:lg:grid-cols-2">
      <div className={boxClass}>
        <Section title="Prepaid / Collect Charge Declaration"><PrepaidCollectTable ctx={ctx} /></Section>
        <Section title="Charges Collect Summary" className="tw:mt-3"><CollectSummary ctx={ctx} destCurrencyPlaceholder={destCurrencyPlaceholder} /></Section>
      </div>
      <div className={boxClass}>
        <Section
          title="Other Charges"
          actions={(
            <span className="tw:flex tw:items-center tw:gap-2">
              <LinkButton onClick={() => setOtherCharges([...otherCharges, { id: Date.now() }])}>+ Add row</LinkButton>
              <span className="tw:text-muted-foreground">|</span>
              <LinkButton tone="danger" onClick={() => setOtherCharges([])}>Clear all rows</LinkButton>
            </span>
          )}
        >
          <OtherChargesTable ctx={ctx} removeHeader={removeHeader} />
        </Section>
        <Section title="Shipper Certification" className="tw:mt-3"><ShipperCertification ctx={ctx} upperCaseSignatures={upperCaseSignatures} /></Section>
      </div>
    </div>
  );
}
