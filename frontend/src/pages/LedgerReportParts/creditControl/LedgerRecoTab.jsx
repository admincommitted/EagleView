import { AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileButton } from '@/components/ui';
import { formatInr } from '../format';

function ResultLine({ className, title, amount, children }) {
  return (
    <div className={cn('tw:border-b tw:px-3 tw:py-2 tw:text-entry', className)}>
      <div className="tw:flex tw:justify-between tw:gap-2 tw:font-semibold"><span>{title}</span> <span className="tw:tabular-nums">{amount}</span></div>
      {children}
    </div>
  );
}

function MatchedList({ matched }) {
  return (
    <div className="tw:max-h-[260px] tw:overflow-y-auto tw:rounded-md tw:border tw:border-success/30">
      {matched.map((match, index) => (
        <div key={index} className="tw:flex tw:justify-between tw:gap-2 tw:border-b tw:border-success/30 tw:bg-success/5 tw:px-3 tw:py-2 tw:text-entry tw:text-success">
          <span>{match.ref}{match.billNo ? ` (${match.billNo})` : ''} <span className="tw:opacity-60">on {match.matchedOn}</span></span>
          <span>₹ {formatInr(match.ours)}</span>
        </div>
      ))}
      {!matched.length && <div className="tw:px-3 tw:py-2.5 tw:text-entry tw:text-muted-foreground">Nothing matched.</div>}
    </div>
  );
}

function DifferenceList({ reco }) {
  const agreed = !reco.variances.length && !reco.oursOnly.length && !reco.theirsOnly.length;
  return (
    <div className="tw:max-h-[260px] tw:overflow-y-auto tw:rounded-md tw:border tw:border-destructive/30">
      {reco.variances.map((variance, index) => (
        <ResultLine key={`v${index}`} className="tw:border-destructive/30 tw:bg-destructive/5 tw:text-destructive" title={variance.ref} amount={`Our book: ₹ ${formatInr(variance.ours)}`}>
          <div className="tw:mt-1 tw:flex tw:justify-between tw:gap-2">
            <span>In their ledger</span>
            <span>₹ {formatInr(variance.theirs)} ({variance.diff > 0 ? 'short by' : 'over by'} ₹ {formatInr(Math.abs(variance.diff))})</span>
          </div>
          <div className="tw:mt-1 tw:text-[11px] tw:opacity-80">{variance.hint}</div>
        </ResultLine>
      ))}
      {reco.oursOnly.map((entry, index) => (
        <ResultLine key={`o${index}`} className="tw:border-warning/30 tw:bg-warning/5 tw:text-warning" title={entry.ref} amount={`₹ ${formatInr(entry.ours)}`}>
          <div className="tw:mt-0.5 tw:text-[11px]">In our books only - not in their ledger</div>
        </ResultLine>
      ))}
      {reco.theirsOnly.map((entry, index) => (
        <ResultLine key={`t${index}`} className="tw:border-primary/30 tw:bg-primary/5 tw:text-head" title={entry.ref || `(no reference, line ${entry.line})`} amount={`₹ ${formatInr(entry.amount)}`}>
          <div className="tw:mt-0.5 tw:text-[11px]">In their ledger only - we have not booked it</div>
        </ResultLine>
      ))}
      {agreed && <div className="tw:px-3 tw:py-2.5 tw:text-entry tw:text-success">Everything agreed.</div>}
    </div>
  );
}

function RecoResults({ reco }) {
  const { counts, totals } = reco;
  return (
    <>
      <h4 className="tw:m-0 tw:mb-2 tw:border-b tw:border-border tw:pb-2 tw:text-sm tw:text-foreground">
        Reconciliation Results &mdash; {reco.fileName} ({reco.at})
      </h4>
      <div className="tw:mb-4 tw:text-entry tw:text-muted-foreground">
        {counts.rowsRead} row(s) read &middot; our books {formatInr(totals.ourBooks)} &middot;
        their ledger {formatInr(totals.theirLedger)} &middot; net variance {formatInr(totals.varianceValue)}
      </div>
      <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-2">
        <div>
          <div className="tw:mb-2 tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-bold tw:text-success"><CheckCircle className="tw:size-3.5" /> Matched ({counts.matched})</div>
          <MatchedList matched={reco.matched} />
        </div>
        <div>
          <div className="tw:mb-2 tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-bold tw:text-destructive">
            <AlertTriangle className="tw:size-3.5" /> Variances &amp; unmatched ({counts.variances + counts.oursOnly + counts.theirsOnly})
          </div>
          <DifferenceList reco={reco} />
        </div>
      </div>
      <div className="tw:mt-3 tw:text-[11px] tw:text-muted-foreground">{reco.note}</div>
    </>
  );
}

export default function LedgerRecoTab({ clientName, reco, busy, onFile }) {
  return (
    <div>
      <div className="tw:mb-6 tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-2.5 tw:rounded-md tw:border tw:border-dashed tw:border-input tw:bg-page tw:p-4 tw:text-center">
        <Upload className="tw:size-6 tw:text-muted-foreground" />
        <div className="tw:text-sm tw:font-semibold tw:text-foreground">Upload {clientName}&apos;s ledger (Excel or CSV)</div>
        <div className="tw:max-w-[520px] tw:text-entry tw:text-muted-foreground">
          Their statement is matched against our open items: on the invoice / bill reference first,
          then on the amount. A PDF cannot be matched reliably - ask them for Excel or CSV.
        </div>
        <FileButton accept=".xlsx,.xls,.csv,.txt" onFiles={(files) => onFile(files[0])} disabled={busy} className="tw:mt-2">
          {busy ? 'Reading and matching...' : 'Choose File'}
        </FileButton>
      </div>
      {reco ? <RecoResults reco={reco} /> : <div className="tw:text-[13px] tw:text-muted-foreground">No reconciliation run yet for this customer.</div>}
    </div>
  );
}
