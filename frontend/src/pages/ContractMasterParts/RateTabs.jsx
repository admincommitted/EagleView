import { cn } from '@/lib/utils';
import { Checkbox, SelectBox } from '@/components/ui';
import { APPLIES_TO, BASIS_GROUPS, CHARGE_CURRENCIES, CHARGE_TYPES, hasLimits, SERVICE_TYPES, TRANSPORT_CURRENCIES, VEHICLES } from './contractOptions';
import { FREIGHT_SLABS } from './contractRows';
import GroupedSelect from './GroupedSelect';
import RateGrid from './RateGrid';
import { amountColumn, gstChargeColumn, headerWithNote, removeColumn, selectColumn, textColumn } from './rateColumns';

const RATE_INPUT = 'tw:min-w-16 tw:font-semibold tw:text-primary';

export function FreightRatesTab({ rows, gstCharges, onUpdate, onAdd, onRemove }) {
  const columns = [
    textColumn('origin', 'Origin', onUpdate, { placeholder: 'e.g. DEL', upper: true }),
    textColumn('destination', 'Destination', onUpdate, { placeholder: 'e.g. JFK', upper: true }),
    selectColumn('serviceType', 'Cargo / Service Type', onUpdate, SERVICE_TYPES, { selectClassName: 'tw:w-[140px]' }),
    textColumn('carrier', 'Carrier', onUpdate, { placeholder: 'Any', upper: true }),
    gstChargeColumn('chargeName', headerWithNote('GST Charge', '(billed as)'), onUpdate, gstCharges, 'e.g. FREIGHT CHARGES - AIR EXPORTS'),
    ...FREIGHT_SLABS.map(([key, header]) => amountColumn(key, header, onUpdate, { inputClassName: RATE_INPUT })),
    removeColumn(onRemove),
  ];
  return (
    <RateGrid
      tone="info"
      intro="Define origin-destination specific freight rates. Select Cargo/Service type (e.g. General, Valuable, Re-import) to set different rates for the same sector."
      columns={columns}
      rows={rows}
      tableClassName="tw:min-w-[1100px]"
      addLabel="Add Rate Line"
      onAdd={onAdd}
    />
  );
}

export function ChargeRulesTab({ rows, gstCharges, onUpdate, onAdd, onRemove }) {
  const withoutLimits = (charge) => !hasLimits(charge.basis);
  const columns = [
    gstChargeColumn('printName', headerWithNote('GST Charge', '(Accounts > GST Charges - prints on the invoice)'), onUpdate, gstCharges, 'e.g. AGENCY CHARGES'),
    selectColumn('appliesTo', 'Applies To', onUpdate, APPLIES_TO, { selectClassName: 'tw:w-[120px]', fallback: 'ALL' }),
    {
      key: 'basis',
      header: 'Calculation Basis',
      className: 'tw:align-top',
      cell: (charge) => (
        <GroupedSelect className="tw:w-full tw:min-w-40" groups={BASIS_GROUPS} value={charge.basis} onValueChange={(value) => onUpdate(charge.id, 'basis', value)} />
      ),
    },
    amountColumn('rate', 'Rate/Amount', onUpdate, { inputClassName: 'tw:min-w-20 tw:font-semibold' }),
    amountColumn('minAmt', 'Min Limit', onUpdate, { placeholder: 'Min', inputClassName: 'tw:min-w-16', disabled: withoutLimits }),
    amountColumn('maxAmt', 'Max Limit', onUpdate, { placeholder: 'Max', inputClassName: 'tw:min-w-16', disabled: withoutLimits }),
    selectColumn('currency', 'Curr.', onUpdate, CHARGE_CURRENCIES, { selectClassName: 'tw:w-20' }),
    {
      key: 'mandatory',
      header: 'Mandatory',
      align: 'center',
      cell: (charge) => <Checkbox checked={!!charge.mandatory} onCheckedChange={(checked) => onUpdate(charge.id, 'mandatory', checked === true)} />,
    },
    {
      key: 'type',
      header: 'Charge Type',
      className: 'tw:align-top',
      cell: (charge) => (
        <SelectBox
          className={cn('tw:w-full tw:min-w-36', charge.type === 'Reimbursement' && 'tw:bg-success/10 tw:text-success')}
          options={CHARGE_TYPES}
          value={charge.type}
          onValueChange={(value) => onUpdate(charge.id, 'type', value)}
        />
      ),
    },
    removeColumn(onRemove),
  ];
  return (
    <RateGrid
      tone="danger"
      intro="Charges billed on every job of this customer. Pick each charge from Accounts > GST Charges (its SAC and GST % come from there), choose the jobs it applies to, the basis and the rate. Reimbursement / At Actuals charges (duty, DO, stamp duty...) are billed at the actual cost booked on the docket, not at a rate."
      columns={columns}
      rows={rows}
      tableClassName="tw:min-w-[1200px]"
      addLabel="Add Custom Charge Rule"
      onAdd={onAdd}
    />
  );
}

export function TransportRatesTab({ rows, gstCharges, onUpdate, onAdd, onRemove }) {
  const columns = [
    textColumn('fromLoc', 'Pickup Location (From)', onUpdate, { placeholder: 'e.g. Mahipalpur' }),
    textColumn('toLoc', 'Drop Location (To)', onUpdate, { placeholder: 'e.g. Gurgaon' }),
    selectColumn('vehicle', 'Vehicle Type', onUpdate, VEHICLES, { selectClassName: 'tw:w-full tw:min-w-36' }),
    gstChargeColumn('chargeName', 'GST Charge', onUpdate, gstCharges, 'e.g. TRANSPORTATION CHARGES'),
    amountColumn('amount', 'Fixed Amount', onUpdate, { inputClassName: 'tw:min-w-20 tw:font-bold tw:text-success' }),
    selectColumn('currency', 'Currency', onUpdate, TRANSPORT_CURRENCIES, { selectClassName: 'tw:w-20' }),
    removeColumn(onRemove),
  ];
  return (
    <RateGrid
      tone="success"
      intro="Map point-to-point transportation / cartage rates based on the vehicle type."
      columns={columns}
      rows={rows}
      tableClassName="tw:md:max-w-[900px]"
      addLabel="Add Transport Route"
      onAdd={onAdd}
    />
  );
}
