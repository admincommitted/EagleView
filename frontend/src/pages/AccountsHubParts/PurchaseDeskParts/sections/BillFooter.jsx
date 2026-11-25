import { PauseCircle } from 'lucide-react';
import { Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { Badge, Box, Money, inr } from '../../ui';
import { CheckLabel } from '../../VoucherDeskParts/sections/CheckLabel';
import { TDS_BASE_OPTIONS } from '../purchaseConfig';

function TdsRow({ entry, setEntry, label, amount, natures }) {
  const pickNature = (natureId) => {
    const nature = natures.find((item) => String(item.id) === natureId);
    setEntry({ ...entry, natureId, rate: nature ? String(nature.rate) : '' });
  };
  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-2 tw:xl:grid-cols-[84px_minmax(200px,2fr)_repeat(3,minmax(100px,1fr))]">
      <CheckLabel className="tw:pb-1" checked={entry.on} onChange={(on) => setEntry({ ...entry, on })}>{label}</CheckLabel>
      <Field label="TDS Account / Section" layout="col">
        <SelectBox options={natures.map((nature) => ({ value: nature.id, label: `${nature.section} - ${nature.name} (${nature.rate}%)` }))} value={entry.natureId}
          onValueChange={pickNature} disabled={!entry.on} placeholder="No TDS" clearable clearLabel="No TDS" />
      </Field>
      <Field label="TDS On" layout="col"><SelectBox options={TDS_BASE_OPTIONS} value={entry.base} disabled={!entry.on} onValueChange={(base) => setEntry({ ...entry, base })} /></Field>
      <Field label="TDS Rate" layout="col"><NumberInput align="right" disabled={!entry.on} value={entry.rate} onValueChange={(rate) => setEntry({ ...entry, rate })} /></Field>
      <Field label="TDS Amount" layout="col"><Input readOnly className="tw:text-right" value={inr(amount)} /></Field>
    </div>
  );
}

function HoldPaymentBox({ form }) {
  const { header, setHeaderField } = form;
  return (
    <Box title="Hold Payment" right={header.hold ? <Badge tone="warn">No payment until released</Badge> : null}>
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-[auto_minmax(0,1fr)]">
        <CheckLabel className="tw:pb-1" checked={header.hold} onChange={setHeaderField('hold')}><PauseCircle size={13} /> Hold this bill</CheckLabel>
        <Field label="Reason" required={header.hold} layout="col">
          <Input data-allow-text required={header.hold && !header.holdReason} disabled={!header.hold} value={header.holdReason}
            onChange={(event) => setHeaderField('holdReason')(event.target.value)} placeholder="Short delivery, rate dispute, documents pending ..." />
        </Field>
      </div>
    </Box>
  );
}

function BillTotalBox({ form }) {
  const { totals, cfg, creditNote, noTax } = form;
  const rows = [
    ['Taxable Value', totals.taxable], ['CGST', totals.cgst], ['SGST', totals.sgst], ['IGST', totals.igst],
    ...(cfg.rcm ? [['GST paid by you (RCM)', totals.gst ? -totals.gst : 0]] : []),
    [creditNote ? 'Credit Note Value' : 'Bill Value', totals.billValue], ['1st TDS', totals.tds1Amt ? -totals.tds1Amt : 0],
    ...(totals.tds2Amt ? [['2nd TDS', -totals.tds2Amt]] : []),
  ];
  return (
    <Box title={creditNote ? 'Credit Note Total' : 'Bill Total'} pad={0}>
      <div className="tw:px-3 tw:py-1.5 tw:text-entry">
        {rows.map(([label, value]) => (
          <div key={label} className="tw:flex tw:justify-between tw:py-0.5"><span className="tw:text-foreground/80">{label}</span><Money v={value} /></div>
        ))}
        {noTax && <div className="tw:py-0.5 tw:text-[10.5px] tw:text-warning">SEZ under LUT - no GST on this bill</div>}
        <CheckLabel className="tw:py-0.5" checked={form.roundOff} onChange={form.setRoundOff}>Round off {totals.ro ? '(' + inr(totals.ro) + ')' : ''}</CheckLabel>
      </div>
      <div className="tw:flex tw:justify-between tw:border-t tw:border-border tw:bg-primary/10 tw:px-3 tw:py-2">
        <b className="tw:text-head">{creditNote ? 'Less From Party' : 'Payable To Party'}</b>
        <Money v={totals.payable} side={creditNote ? 'Dr' : 'Cr'} strong />
      </div>
    </Box>
  );
}

// TDS, hold payment and narration on the left, the bill total on the right
export function BillFooter({ form }) {
  const { totals, creditNote } = form;
  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-2.5 tw:lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2.5">
        <Box title={creditNote ? 'TDS (reversed on the credit note)' : 'TDS'}>
          <div className="tw:flex tw:flex-col tw:gap-2.5">
            <TdsRow entry={form.tds} setEntry={form.setTds} label="1st TDS" amount={totals.tds1Amt} natures={form.look.tds} />
            <TdsRow entry={form.tds2} setEntry={form.setTds2} label="2nd TDS" amount={totals.tds2Amt} natures={form.look.tds} />
          </div>
        </Box>
        {!creditNote && <HoldPaymentBox form={form} />}
        <Box>
          <Field label="Narration" layout="col">
            <Input data-allow-text value={form.header.narration} onChange={(event) => form.setHeaderField('narration')(event.target.value)}
              placeholder={creditNote ? 'Leave blank to use the credit note and bill no' : 'Leave blank to use the bill no and dates'} />
          </Field>
        </Box>
      </div>
      <BillTotalBox form={form} />
    </div>
  );
}
