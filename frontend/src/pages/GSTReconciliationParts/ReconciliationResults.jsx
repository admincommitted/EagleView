import { Download, Filter, Search } from 'lucide-react';
import { Button, Card, DataTable, Input } from '@/components/ui';
import { reconciliationColumns } from './reconciliationColumns';

const inr = (amount) => (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const periodLine = (meta, shownCount) =>
  `Return period ${meta.period || '-'} · ${meta.summary.portalDocuments} portal document(s) vs ${meta.summary.purchaseVouchers} purchase voucher(s) · showing ${shownCount}`;

export default function ReconciliationResults({
  meta, records, shown, search, onSearchChange, exceptionsOnly, onToggleExceptions, onExport, onOpenVoucher,
}) {
  return (
    <Card className="tw:overflow-hidden">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border tw:px-5 tw:py-4 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
        <div>
          <h3 className="tw:m-0 tw:text-base tw:normal-case tw:text-foreground">Reconciliation Details</h3>
          <div className="tw:mt-1 tw:text-xs tw:normal-case tw:text-muted-foreground">{meta ? periodLine(meta, shown.length) : ''}</div>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          <Input leftIcon={Search} data-allow-text="" className="tw:w-full tw:sm:w-56" value={search}
            onChange={(event) => onSearchChange(event.target.value)} placeholder="Search supplier / invoice / GSTIN" />
          <Button variant={exceptionsOnly ? 'default' : 'outline'} onClick={onToggleExceptions}>
            <Filter /> {exceptionsOnly ? 'Showing exceptions only' : 'Show Exceptions Only'}
          </Button>
          <Button variant="default" onClick={onExport}><Download /> Export Excel</Button>
        </div>
      </div>

      <DataTable
        columns={reconciliationColumns(onOpenVoucher)}
        rows={shown}
        rowKey={(record, index) => index}
        rowClassName={(record) => record.status !== 'Matched' && 'tw:bg-destructive/5 tw:even:bg-destructive/5'}
        emptyText={records.length ? 'Nothing matches the filter.' : 'No documents in this return.'}
      />

      {meta && (
        <div className="tw:flex tw:flex-col tw:gap-1.5 tw:border-t tw:border-border tw:bg-page tw:px-5 tw:py-3 tw:text-xs tw:normal-case tw:text-muted-foreground">
          <div>
            <b>ITC safe to claim: &#8377; {inr(meta.summary.itcSafe)}</b> &nbsp;
            (matched documents with ITC available on the portal, out of &#8377; {inr(meta.summary.portalTaxTotal)} total tax on the portal)
          </div>
          <div>{meta.note}</div>
          {meta.portalGstin && <div>File belongs to GSTIN {meta.portalGstin}</div>}
        </div>
      )}
    </Card>
  );
}
