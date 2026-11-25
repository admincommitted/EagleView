import { DollarSign, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button, DataTable, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { AwbCard, LooseSelect, SubHeading } from '../awbParts';

const PAYMENT_TYPES = ['Pre-Paid', 'Charge Collect'];
const DUE_PARTIES = ['Due Carrier', 'Due Agent'];
const DASH = '--';

const DeleteButton = ({ onClick }) => (
  <Button variant="destructive" size="icon-sm" aria-label="Delete" onClick={onClick}><Trash2 /></Button>
);

// The charge lines typed here are the "rateLines" saved with the AWB.
function chargeLineColumns({ updateCharge, removeCharge }) {
  const textCell = (field, placeholder) => (charge, index) => (
    <Input data-allow-text value={charge[field]} onChange={(event) => updateCharge(index, field, event.target.value)} placeholder={placeholder} />
  );
  return [
    { key: 'code', header: 'Shipment Type', cell: textCell('code', 'e.g. MY') },
    { key: 'description', header: 'Total Pieces', cell: textCell('description', 'Description') },
    {
      key: 'amount',
      header: 'Total Weights',
      cell: (charge, index) => <NumberInput align="right" value={charge.amount} onValueChange={(text) => updateCharge(index, 'amount', text)} />,
    },
    {
      key: 'dueTo',
      header: 'Total Volume',
      cell: (charge, index) => <SelectBox options={DUE_PARTIES} value={charge.dueTo} onValueChange={(value) => updateCharge(index, 'dueTo', value)} className="tw:w-full tw:uppercase" />,
    },
    { key: 'remarks', header: 'Chargeable Weight', cell: textCell('remarks') },
    { key: 'delete', header: '', align: 'center', cell: (charge, index) => <DeleteButton onClick={() => removeCharge(index)} /> },
  ];
}

const SHIPMENT_CHARGE_COLUMNS = [
  { key: 'commodity', header: 'Commodity', cell: () => DASH },
  { key: 'volumetric', header: 'Volumetric Weight', className: 'tw:font-bold', cell: () => DASH },
  { key: 'chargeable', header: 'Chargeable Weight', className: 'tw:font-bold', cell: () => DASH },
  { key: 'rate', header: 'Rate', align: 'right', className: 'tw:font-bold', cell: () => DASH },
  { key: 'net', header: 'Net Charge', align: 'right', className: 'tw:font-bold', cell: () => DASH },
];

const OTHER_CHARGE_COLUMNS = [
  { key: 'code', header: 'Code', cell: () => <Input data-allow-text /> },
  { key: 'head', header: 'Charge Head', cell: () => <Input data-allow-text /> },
  { key: 'charge', header: 'Charge', cell: () => <Input className="tw:text-right" /> },
  { key: 'due', header: 'Due Party', cell: () => <LooseSelect options={['Due Carrier']} defaultValue="Due Carrier" className="tw:w-full tw:uppercase" /> },
  { key: 'remarks', header: 'Remarks', cell: () => <Input data-allow-text /> },
  { key: 'delete', header: '', align: 'center', cell: () => <DeleteButton onClick={() => toast.error('Item Deleted')} /> },
];
const ONE_BLANK_ROW = [{ id: 'blank' }];

function RateResult({ rateInfo, chargeableWeight }) {
  const failed = rateInfo.success === false;
  return (
    <div className={cn('tw:mt-3 tw:rounded-md tw:border tw:px-3.5 tw:py-2.5 tw:text-xs', failed ? 'tw:border-destructive/30 tw:bg-destructive/5 tw:text-destructive' : 'tw:border-success/30 tw:bg-success/10 tw:text-success')}>
      {failed ? rateInfo.error : (
        <>
          <b>{rateInfo.currency} {rateInfo.rate}</b> per kg &middot; class {rateInfo.rateClass} &middot; {rateInfo.weightBreak} kg break
          &middot; {chargeableWeight} kg chargeable = <b>{rateInfo.currency} {rateInfo.amount}</b>
          <div className="tw:mt-1">{rateInfo.note}</div>
        </>
      )}
    </div>
  );
}

const SUMMARY_LINES = [['Freight Charges', '0.00'], ['Other Charges', '0.00'], ['Add On Charges', DASH]];

function ChargesSummary() {
  return (
    <div className="tw:-mx-4 tw:-mb-4 tw:rounded-lg tw:border-t tw:border-border tw:bg-page tw:px-5 tw:py-4 tw:md:-mx-6 tw:md:-mb-6">
      <div className="tw:mb-4 tw:border-l-[3px] tw:border-destructive tw:pl-2 tw:text-[13px] tw:font-bold tw:text-primary">Charges</div>
      {SUMMARY_LINES.map(([label, amount]) => (
        <div key={label} className="tw:mb-3 tw:flex tw:justify-between tw:text-xs tw:text-foreground">
          <div>{label}</div>
          <div className="tw:font-bold">{amount}</div>
        </div>
      ))}
      <div className="tw:flex tw:justify-between tw:border-t tw:border-border tw:pt-4 tw:text-[13px] tw:font-bold tw:text-foreground">
        <div>Total Amount<br /><span className="tw:text-[11px] tw:text-primary">INR</span></div>
        <div className="tw:text-base tw:text-primary">0.00</div>
      </div>
    </div>
  );
}

export default function RateAndChargeSection({ ctx }) {
  const { otherCharges, addCharge, autoRate, rating, rateInfo, chargeableWeight } = ctx;
  return (
    <AwbCard icon={DollarSign} title="Rate and Charge Details">
      <div className="tw:mb-6 tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
        <Field layout="col" label="Currency" required><Input data-allow-text required /></Field>
        <Field layout="col" label="Payment Type" required><LooseSelect options={PAYMENT_TYPES} defaultValue="Pre-Paid" required className="tw:w-full" /></Field>
        <Field layout="col" label="DV for Customs"><Input data-allow-text /></Field>
        <Field layout="col" label="DV for Carriage"><Input data-allow-text /></Field>
      </div>

      <div className="tw:mb-6">
        <SubHeading>Total Shipments</SubHeading>
        <DataTable columns={chargeLineColumns(ctx)} rows={otherCharges} rowKey={(charge, index) => index} emptyText="" />
      </div>

      <div className="tw:mb-6">
        <SubHeading>Shipment Charges</SubHeading>
        <DataTable columns={SHIPMENT_CHARGE_COLUMNS} rows={ONE_BLANK_ROW} />
      </div>

      <div className="tw:mb-6">
        <SubHeading className="tw:mb-3">Other Charges</SubHeading>
        <Field layout="col" label="Payment Type" required className="tw:mb-4 tw:w-full tw:sm:w-[200px]">
          <LooseSelect options={PAYMENT_TYPES} defaultValue="Pre-Paid" required className="tw:w-full tw:uppercase" />
        </Field>
        <DataTable columns={OTHER_CHARGE_COLUMNS} rows={ONE_BLANK_ROW} containerClassName="tw:mb-4" />
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
          <Button variant="link" className="tw:font-bold tw:uppercase" onClick={addCharge}>+ Add Other Charge</Button>
          <Button onClick={autoRate} disabled={rating} className="tw:border-primary tw:text-primary tw:uppercase">
            {rating ? 'Looking up TACT...' : 'Auto Rate'}
          </Button>
        </div>
        {rateInfo && <RateResult rateInfo={rateInfo} chargeableWeight={chargeableWeight} />}
      </div>

      <ChargesSummary />
    </AwbCard>
  );
}
