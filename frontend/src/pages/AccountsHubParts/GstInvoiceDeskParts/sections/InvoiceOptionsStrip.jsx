import { ClipboardList, Layers, Search, X } from 'lucide-react';
import { Button, Input, SelectBox } from '@/components/ui';
import { fmtDate, inr } from '../../ui';
import { FOREIGN_POS, docketInrTotal } from '../gstMath';
import { CheckField, GridField, ReadOnlyBox, RoundOffSelect } from './formParts';

function BulkDocketChips({ desk }) {
  const { head, lines, bulk } = desk;
  return (
    <>
      {head.dockets.map((docketNo) => (
        <span key={docketNo} className="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-md tw:border tw:border-border tw:bg-background tw:px-1.5 tw:py-0.5 tw:text-[11px]">
          <b>{docketNo}</b>
          <Button variant="link" size="sm" className="tw:h-auto tw:text-[10.5px]" title="Provisional sheet of this docket" onClick={() => desk.openProvisional(docketNo)}>sheet</Button>
          <span className="tw:text-[10.5px] tw:text-muted-foreground">{inr(docketInrTotal(lines, docketNo))}</span>
          <Button variant="ghost" size="icon-sm" className="tw:size-4 tw:text-destructive" aria-label={'Remove ' + docketNo} onClick={() => bulk.removeDocket(docketNo)}><X className="tw:size-3" /></Button>
        </span>
      ))}
      <Button variant="ghost" onClick={() => desk.setPanel('dockets')}><Layers /> Choose dockets ({head.dockets.length})</Button>
    </>
  );
}

function PreviousInvoiceFields({ desk }) {
  const { head, setField, meta } = desk;
  return (
    <>
      <GridField label="Previous Invoice No." required={!head.withOut} className="tw:w-full tw:md:w-[170px]">
        <Input data-allow-text required={!head.withOut && !head.prevInvoiceNo} disabled={head.withOut} value={head.prevInvoiceNo}
          onChange={(event) => setField('prevInvoiceNo', event.target.value.toUpperCase())} onBlur={desk.findPreviousInvoice} placeholder="PREVIOUS INVOICE NO" />
      </GridField>
      <GridField label="Date" className="tw:w-full tw:md:w-[95px]"><ReadOnlyBox value={fmtDate(head.prevInvoiceDate)} /></GridField>
      <GridField label="Reason To Issue" required className="tw:w-full tw:md:w-[230px]">
        <SelectBox value={head.reason} onValueChange={(value) => setField('reason', value)} options={meta ? meta.reasons : []} placeholder="SELECT" clearable clearLabel="SELECT" required={!head.reason} />
      </GridField>
    </>
  );
}

function ShipmentFields({ desk }) {
  const { head, setField, job } = desk;
  return (
    <>
      <GridField label="MAWB / MBL" className="tw:w-full tw:md:w-[140px]"><Input data-allow-text value={head.mawbNo} onChange={(event) => setField('mawbNo', event.target.value.toUpperCase())} /></GridField>
      <GridField label="HAWB / HBL" className="tw:w-full tw:md:w-[140px]"><Input data-allow-text value={head.hawbNo} onChange={(event) => setField('hawbNo', event.target.value.toUpperCase())} /></GridField>
      {job && <span className="tw:pb-1 tw:text-[11px] tw:text-muted-foreground">{[job.dir, job.mode, job.sbBe ? (job.dir === 'Export' ? 'SB ' : 'BE ') + job.sbBe : ''].filter(Boolean).join(' - ')}</span>}
      <Button variant="ghost" onClick={desk.showExpenses} disabled={!head.jobNo}><Search /> Show Expense</Button>
      <Button variant="ghost" onClick={() => desk.openProvisional(head.jobNo)} disabled={!head.jobNo}><ClipboardList /> Provisional Sheet</Button>
    </>
  );
}

// options + docket / previous invoice / bulk dockets in one strip under the header
export default function InvoiceOptionsStrip({ desk }) {
  const { head, setField, kind, kindId, bulk } = desk;
  return (
    <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:items-end tw:gap-x-3.5 tw:gap-y-1 tw:border-t tw:border-dashed tw:border-border tw:pt-1.5">
      <CheckField label="GST Exempted" checked={head.gstExempt} onCheckedChange={(value) => setField('gstExempt', value)} disabled={!kind.gst} />
      <CheckField label="Hide Ex.Rate" checked={head.hideExRate} onCheckedChange={(value) => setField('hideExRate', value)} />
      <CheckField label="RCM" checked={head.rcm} onCheckedChange={(value) => setField('rcm', value)} disabled={!kind.gst} />
      {!kind.againstBill && <CheckField label="Bulk Invoice" checked={head.bulk} onCheckedChange={bulk.setBulk} />}
      {kind.againstBill && <CheckField label="WithOut prev. invoice" checked={head.withOut} onCheckedChange={(value) => setField('withOut', value)} />}
      {(kindId === 'overseas' || head.pos === FOREIGN_POS) && (
        <GridField label="Round Off" className="tw:w-full tw:md:w-[120px]"><RoundOffSelect head={head} setField={setField} /></GridField>
      )}
      <span className="tw:hidden tw:w-px tw:self-stretch tw:bg-border tw:md:block" />
      {head.bulk ? <BulkDocketChips desk={desk} /> : kind.againstBill ? <PreviousInvoiceFields desk={desk} /> : <ShipmentFields desk={desk} />}
    </div>
  );
}
