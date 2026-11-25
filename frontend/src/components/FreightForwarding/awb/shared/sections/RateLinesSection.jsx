import { Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Button, Checkbox, Field, Input, Label, NumberInput, Section, SelectBox, Table, TableBody, TableCell, TableFooter, TableHead,
  TableHeader, TableRow,
} from '@/components/ui';
import { LinkButton } from '../awbFormParts';

const WEIGHT_UNITS = ['K', 'L'];
const RATE_CLASSES = ['Q', 'M', 'N', 'B', 'K', 'C', 'R', 'S'];
const DENSITY_GROUPS = [
  { value: '1:6', label: '1:6 - IATA 6000 cm3/kg (166.67 kg/cbm)' },
  { value: '1:5', label: '1:5 - 5000 cm3/kg (courier / express)' },
  { value: '1:7', label: '1:7 - 7000 cm3/kg (airline rate)' },
  { value: '1:8', label: '1:8 - 8000 cm3/kg (airline rate)' },
  { value: 'DG1', label: 'DG1 (Dangerous Goods)' },
  { value: 'OOG', label: 'Out of Gauge' },
];
const VOLUME_UNITS = [
  { value: 'MC', label: 'MC - Cubic Metres' },
  { value: 'CC', label: 'CC - Cubic Centimetres' },
  { value: 'CF', label: 'CF - Cubic Feet' },
  { value: 'CI', label: 'CI - Cubic Inches' },
];
const ROUNDING_HINT = 'IATA: chargeable weight is rounded up to the next 0.5 kg (next whole lb). Untick only if the airline asks for the exact weight.';

/**
 * kind: integer | decimal | text (typed boxes), select, chargeable (weight with the 0.5 rounding tick), goods.
 * total: the ctx key shown under the column in the totals line.
 */
const RATE_COLUMNS = [
  { key: 'noOfPcs', width: 'tw:w-[5%]', header: 'Pcs', title: 'No. of pieces', kind: 'integer', required: true, total: 'totalPcs' },
  { key: 'slac', width: 'tw:w-[5%]', header: 'SLAC', title: "Shipper's load and count", kind: 'integer' },
  { key: 'grossWeight', width: 'tw:w-[7%]', header: 'Gross Wt', title: 'Gross weight', kind: 'decimal', required: true, total: 'totalGrossWt' },
  { key: 'gwUnit', width: 'tw:w-[5%]', header: 'KG/LB', title: 'Weight unit', kind: 'select', options: WEIGHT_UNITS, fallback: 'K' },
  { key: 'volumetricWeight', width: 'tw:w-[8%]', header: 'Vol. Wt', title: 'Volumetric weight', kind: 'decimal', total: 'totalVolWt' },
  { key: 'rateClassCode', width: 'tw:w-[7%]', header: 'Rate Class', title: 'Rate class code', kind: 'select', options: RATE_CLASSES, clearLabel: '-' },
  { key: 'rateClassPercentage', width: 'tw:w-[8%]', header: 'Class %', title: 'Rate class percentage', kind: 'text' },
  { key: 'commodityItemNumber', width: 'tw:w-[8%]', header: 'Commodity No', title: 'Commodity item number', kind: 'text' },
  { key: 'chargeableWeight', width: 'tw:w-[8%]', header: 'Chg. Wt', title: 'Chargeable weight', kind: 'chargeable', total: 'totalChgWt' },
  { key: 'rateCharge', width: 'tw:w-[7%]', header: 'Rate/Chg', title: 'Rate / charge', kind: 'text', required: true, firstRowPlaceholder: 'F7' },
  { key: 'totalAmount', width: 'tw:w-[8%]', header: 'Total Amount', title: 'Total amount', kind: 'decimal', required: true, total: 'totalAmountSum' },
  { key: 'rcp', width: 'tw:w-[5%]', header: 'RCP', title: 'Rate combination point', kind: 'text' },
  { key: 'goodsDescription', width: 'tw:w-[12%]', header: 'Goods Description', title: 'Goods description', kind: 'goods' },
];

function RateCell({ column, row, index, ctx }) {
  const { handleGridChange, natureOfGoods, setNatureOfGoods } = ctx;
  const change = (value) => handleGridChange(index, column.key, value);
  const value = row[column.key] || '';
  if (column.kind === 'integer' || column.kind === 'decimal') {
    return <NumberInput decimals={column.kind === 'integer' ? 0 : undefined} value={value} required={column.required} onValueChange={change} className="tw:px-0.5 tw:text-[10px]" />;
  }
  if (column.kind === 'select') {
    return (
      <SelectBox options={column.options} value={value || column.fallback || ''} onValueChange={change} placeholder={column.clearLabel}
        clearable={Boolean(column.clearLabel)} clearLabel={column.clearLabel} className="tw:px-0.5 tw:text-[10px] tw:font-bold tw:text-primary" />
    );
  }
  if (column.kind === 'chargeable') {
    return (
      <div className="tw:flex tw:flex-col tw:rounded-sm tw:border tw:border-required-line tw:bg-background">
        <Label title={ROUNDING_HINT} className="tw:cursor-help tw:justify-between tw:border-b tw:border-required-line tw:px-1 tw:text-[8px] tw:font-bold tw:text-destructive">
          ROUND 0.5
          <Checkbox className="tw:size-2.5" checked={row.isRounded !== false} onCheckedChange={(checked) => handleGridChange(index, 'isRounded', checked === true)} />
        </Label>
        <NumberInput value={value} onValueChange={change} title={row.cwManual ? 'Typed by hand - changes to gross / volumetric weight recalculate it' : 'Higher of gross and volumetric weight'}
          className="tw:h-5 tw:border-0 tw:bg-transparent tw:px-0.5 tw:text-[10px]" />
      </div>
    );
  }
  if (column.kind === 'goods') {
    return (
      <Input autoComplete="off" placeholder="Nature & Qty of Goods" value={row.goodsDescription || (index === 0 ? natureOfGoods ?? '' : '')} className="tw:text-[11px]"
        onChange={(event) => { if (index === 0) setNatureOfGoods(event.target.value); change(event.target.value); }} />
    );
  }
  return (
    <Input autoComplete="off" value={value} required={column.required} placeholder={index === 0 ? column.firstRowPlaceholder : undefined} className="tw:px-0.5 tw:text-[10px]"
      onChange={(event) => change(event.target.value)} />
  );
}

/**
 * Rate lines with their totals, density, volume and MC.
 * noDimensionsEditable: the "No Dimensions Available" tick can be changed here (e-AWB); elsewhere it only shows.
 */
export default function RateLinesSection({ ctx, noDimensionsEditable = false }) {
  const { densityGroup, dimRows, mcUnit, noDimensions, rateLines, setActiveRowIndex, setDensityGroup, setMcUnit, setNoDimensions, setRateLines, setShowRateLine, setVolume, volume } = ctx;
  const openRateLine = (index) => { setActiveRowIndex(index); setShowRateLine(true); };
  const volumeFromDims = !noDimensions && dimRows.length > 0;

  return (
    <Section
      title="Consignment Rating Details"
      actions={<LinkButton onClick={() => openRateLine(null)}>+ Add line</LinkButton>}
      className="tw:px-2 tw:pt-1"
    >
      <Table className="tw:min-w-[1100px] tw:table-fixed">
        <TableHeader>
          <TableRow>
            {RATE_COLUMNS.map((column) => <TableHead key={column.key} title={column.title} className={cn('tw:px-1', column.width)}>{column.header}</TableHead>)}
            <TableHead className="tw:w-[70px] tw:text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rateLines.map((row, index) => (
            <TableRow key={row.id}>
              {RATE_COLUMNS.map((column) => (
                <TableCell key={column.key} className="tw:px-0.5 tw:py-0.5">
                  <RateCell column={column} row={row} index={index} ctx={ctx} />
                </TableCell>
              ))}
              <TableCell className="tw:px-0.5 tw:py-0.5">
                <div className="tw:flex tw:items-center tw:justify-center tw:gap-1">
                  <Button size="icon" title="View Details" onClick={() => openRateLine(index)}><Eye /></Button>
                  <Button variant="destructive" size="icon" title="Delete Row" onClick={() => setRateLines(rateLines.filter((_, rowIndex) => rowIndex !== index))}><X /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rateLines.length === 0 && (
            <TableRow>
              <TableCell colSpan={RATE_COLUMNS.length + 1} className="tw:text-entry tw:text-muted-foreground">
                No rate line yet. <LinkButton onClick={() => openRateLine(null)}>+ Add line</LinkButton>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            {RATE_COLUMNS.map((column, columnIndex) => (
              <TableCell key={column.key} className="tw:px-1 tw:font-bold">
                {columnIndex === 0 && <span className="tw:mr-1 tw:text-head" title="Totals">Tot</span>}
                {column.total && ctx[column.total]}
              </TableCell>
            ))}
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-t tw:border-border tw:py-1 tw:md:flex-row tw:md:flex-wrap tw:md:items-end tw:md:gap-4">
        <Field label="Density Group / Ratio" layout="col" className="tw:md:w-[150px]">
          <SelectBox options={DENSITY_GROUPS} value={densityGroup} onValueChange={setDensityGroup} />
        </Field>
        <Field label="Volume" layout="col" className="tw:md:w-[120px]">
          <NumberInput value={volume} onValueChange={setVolume} readOnly={volumeFromDims} placeholder={!noDimensions && dimRows.length === 0 ? 'Enter Dims above' : ''} />
        </Field>
        <Field label="MC" layout="col" className="tw:md:w-[100px]">
          <SelectBox options={VOLUME_UNITS} value={mcUnit} onValueChange={setMcUnit} />
        </Field>
        <Label className="tw:cursor-pointer tw:gap-1.5 tw:pb-1 tw:md:pb-0.5">
          <Checkbox checked={Boolean(noDimensions)} disabled={!noDimensionsEditable} onCheckedChange={(checked) => setNoDimensions(checked === true)} />
          No Dimensions Available
        </Label>
      </div>
    </Section>
  );
}
