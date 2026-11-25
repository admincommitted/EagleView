import { ArrowLeft, Copy, History, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { ActionBar, Badge, Box, Btn, Empty, Grid, Money, PostingTable, fmtDate, inr, statusTone } from '../../ui';
import { AttachDocs } from '../../extras';
import { PurchaseInfoBox } from '../../PurchaseDeskParts/sections/PurchaseInfoBox';
import { useVoucherView } from '../hooks/useVoucherView';

const ReadOnlyRow = ({ label, value }) => (
  <Field label={label} labelWidth="104px"><Input readOnly value={value || ''} /></Field>
);

const TRAIL_TONES = { DELETED: 'bad', MODIFIED: 'warn' };

// created, every change, then the approval decision
const trailRows = (trail) => {
  const voucher = trail.voucher || {};
  const decided = /approv|reject|return/i.test(voucher.status || '');
  return [
    { id: 'c', action: 'CREATED', byUser: voucher.createdByName, at: voucher.createdAt },
    ...trail.trail,
    ...(decided ? [{ id: 's', action: String(voucher.status).toUpperCase(), byUser: '', at: voucher.updatedAt, note: voucher.rejectionReason }] : []),
  ];
};

const ChangeCell = ({ entry }) => {
  if (!entry.before || !entry.after) return entry.note || '';
  const describe = (state) => fmtDate(state.date) + ', ' + inr(state.amount) + ' - ' + (state.lines || []).join('; ');
  return (
    <div className="tw:text-[10.5px]">
      <div className="tw:text-destructive">Before: {describe(entry.before)}</div>
      <div className="tw:text-success">After: {describe(entry.after)}</div>
    </div>
  );
};

// read-only voucher, opened from Search
export function VoucherView({ id, onNew, onSearch, onModify, onCopy, onDeleted }) {
  const view = useVoucherView({ id, onDeleted });
  const { voucher, trail } = view;
  if (view.loadError) return <Empty title="Could not open the voucher">{view.loadError}</Empty>;
  if (!voucher) return <div className="tw:p-3 tw:text-entry tw:text-muted-foreground">Opening</div>;

  return (
    <>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] tw:gap-2.5">
        <Box>
          <ReadOnlyRow label="Voucher No" value={voucher.voucherNumber} />
          <ReadOnlyRow label="Date" value={fmtDate(voucher.date)} />
          <ReadOnlyRow label="Type" value={voucher.typeName} />
        </Box>
        <Box>
          <ReadOnlyRow label="Ref / Chq No" value={voucher.refNo} />
          <ReadOnlyRow label="Job No" value={voucher.jobNo} />
          <ReadOnlyRow label="Branch" value={voucher.branchCode} />
        </Box>
        <Box>
          <Field label="Status" labelWidth="104px"><Badge tone={statusTone(voucher.status)}>{voucher.status || 'Pending'}</Badge></Field>
          <ReadOnlyRow label="Amount" value={inr(voucher.totalAmount)} />
          <ReadOnlyRow label="Entered by" value={voucher.createdByName} />
        </Box>
      </div>
      <PurchaseInfoBox v={voucher} onChanged={view.load} />
      <AttachDocs voucherId={voucher.id} compact />
      <PostingTable title="Accounts Information" lines={voucher.lines || []} />
      {voucher.allocations?.length > 0 && (
        <Grid title="Bills Set Off" maxHeight={200} rows={voucher.allocations}
          cols={[
            { label: 'Bill', render: (allocation) => allocation.againstNo || allocation.refNo || allocation.refType },
            { label: 'Bill Date', render: (allocation) => fmtDate(allocation.againstDate) },
            { label: 'Amount', right: true, render: (allocation) => <Money v={allocation.amount} /> },
          ]} />
      )}
      <Box>
        <ReadOnlyRow label="Narration" value={voucher.narration} />
        {voucher.rejectionReason && <div className="tw:mt-1.5 tw:text-entry tw:text-destructive">Returned: {voucher.rejectionReason}</div>}
      </Box>
      <ActionBar note={view.message}>
        <Btn kind="save" onClick={onNew}><Plus size={13} /> New</Btn>
        <Btn kind="save" onClick={() => onModify(voucher)}><Pencil size={13} /> Modify</Btn>
        <Btn kind="danger" onClick={view.remove}><Trash2 size={13} /> Delete</Btn>
        <Btn kind="primary" onClick={view.print}><Printer size={13} /> Print</Btn>
        <Btn kind="plain" onClick={() => onCopy(voucher)}><Copy size={13} /> Copy as new</Btn>
        <Btn kind="plain" onClick={view.toggleTrail}><History size={13} /> Audit trail</Btn>
        <Btn kind="plain" onClick={onSearch}><ArrowLeft size={13} /> Back to search</Btn>
      </ActionBar>
      {trail && (
        <Grid title={'Audit trail - ' + voucher.voucherNumber} maxHeight={260} rows={trailRows(trail)} rowKey={(entry) => entry.id}
          right={<Button variant="ghost" size="icon-sm" title="Close" onClick={() => view.setTrail(null)}><X /></Button>}
          cols={[
            { label: 'When', render: (entry) => (entry.at ? new Date(entry.at).toLocaleString('en-IN') : '') },
            { label: 'Action', render: (entry) => <Badge tone={TRAIL_TONES[entry.action] || 'ok'}>{entry.action}</Badge> },
            { label: 'By', render: (entry) => entry.byUser || '-' },
            { label: 'Change', wrap: true, render: (entry) => <ChangeCell entry={entry} /> },
          ]} />
      )}
    </>
  );
}
