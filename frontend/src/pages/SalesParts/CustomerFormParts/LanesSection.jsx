import { Plus, Trash2 } from 'lucide-react';
import { Button, ComboInput, Input, NumberInput, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { pairOptions } from '../salesFormat';
import { CheckLabel, FormField, FormSection, Muted } from '../salesWidgets';
import { FORM_GRID } from '../salesStyles';
import { competitorNames, isOn, NEW_LANE } from './customerModel';

const NONE = { clearable: true, clearLabel: '-', placeholder: '-' };
const LANE_STATUSES = [
  { value: 'OPEN', label: 'Open (not quoted)' },
  { value: 'QUOTED', label: 'Quoted' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
];

function LaneCard({ lane, meta, onChange, onRemove }) {
  const text = (field, props = {}) => <Input value={lane[field] || ''} onChange={(event) => onChange(field, event.target.value)} {...props} />;
  const upperText = (field, placeholder) => <Input value={lane[field] || ''} placeholder={placeholder} onChange={(event) => onChange(field, event.target.value.toUpperCase())} />;
  const number = (field) => <NumberInput value={lane[field]} onValueChange={(value) => onChange(field, value)} />;
  const select = (field, options, extra = NONE) => <SelectBox {...extra} value={lane[field] || ''} onValueChange={(value) => onChange(field, value)} options={options} />;
  const countryCodes = (meta.countries || []).map((country) => country.code);
  const service = lane.service || '';
  const currencies = ['INR', ...(meta.currencies || []).filter((currency) => currency !== 'INR')];

  return (
    <div className={cn('tw:mb-1.5 tw:rounded-md tw:border tw:border-border tw:p-2', isOn(lane.isActive) ? 'tw:bg-card' : 'tw:bg-muted')}>
      <div className={FORM_GRID.narrow}>
        <FormField label="Service" required>{select('service', pairOptions(meta.services))}</FormField>
        <FormField label="From (port / city)" required>{upperText('origin', 'DEL, INNSA1…')}</FormField>
        <FormField label="From country">{select('originCountry', countryCodes)}</FormField>
        <FormField label="To (port / city)" required>{upperText('destination', 'FRA, USNYC…')}</FormField>
        <FormField label="To country">{select('destinationCountry', countryCodes)}</FormField>
        <FormField label="Commodity">{text('commodity')}</FormField>
        <FormField label="HS code">{text('hsCode')}</FormField>
        <FormField label="Incoterm">{select('incoterm', meta.incoterms || [])}</FormField>
        {/SEA/.test(service) && <FormField label="Container" required={/FCL/.test(service)}>{select('containerType', meta.containerTypes || [])}</FormField>}
        <FormField label="Shipments / month">{number('shipmentsPerMonth')}</FormField>
        <FormField label="Volume / shipment">{number('volumePerShipment')}</FormField>
        <FormField label="Unit">{select('volumeUnit', pairOptions(meta.volumeUnits))}</FormField>
        <FormField label="Moved now by">
          <ComboInput options={competitorNames(meta)} value={lane.currentVendor || ''} onValueChange={(value) => onChange('currentVendor', value)} />
        </FormField>
        <FormField label="Their rate">{number('currentRate')}</FormField>
        <FormField label="Target rate">{number('targetRate')}</FormField>
        <FormField label="Currency">
          <SelectBox value={lane.rateCurrency || 'INR'} onValueChange={(value) => onChange('rateCurrency', value)} options={currencies} />
        </FormField>
        <FormField label="Rate per">{text('rateBasis', { placeholder: 'kg, container, shipment', 'data-allow-text': '' })}</FormField>
        <FormField label="Status">
          <SelectBox value={lane.status || 'OPEN'} onValueChange={(value) => onChange('status', value)} options={LANE_STATUSES} />
        </FormField>
        <FormField label="Remarks" span={2}>{text('remarks')}</FormField>
      </div>
      <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-3.5">
        <CheckLabel checked={lane.isDg} onCheckedChange={(checked) => onChange('isDg', checked)}>Dangerous goods</CheckLabel>
        <CheckLabel checked={lane.isTempControlled} onCheckedChange={(checked) => onChange('isTempControlled', checked)}>Temperature controlled</CheckLabel>
        <CheckLabel checked={isOn(lane.isActive)} onCheckedChange={(checked) => onChange('isActive', checked)}>Running</CheckLabel>
        <Button variant="destructive" className="tw:ml-auto" onClick={onRemove}><Trash2 /> Remove</Button>
      </div>
    </div>
  );
}

export default function LanesSection({ customer, meta, setRow, addRow, removeRow }) {
  const lanes = customer.lanes || [];
  return (
    <FormSection title={`Lanes - what it ships (${lanes.length})`} actions={<Button onClick={() => addRow('lanes', NEW_LANE)}><Plus /> Lane</Button>}>
      {lanes.length === 0 && (
        <Muted className="tw:text-entry">
          No lane yet. A lane is a regular movement: service, from - to, commodity, how often and how much, who moves it now and at what rate.
        </Muted>
      )}
      {lanes.map((lane, index) => (
        <LaneCard key={index} lane={lane} meta={meta} onChange={(field, value) => setRow('lanes', index, field, value)} onRemove={() => removeRow('lanes', index)} />
      ))}
    </FormSection>
  );
}
