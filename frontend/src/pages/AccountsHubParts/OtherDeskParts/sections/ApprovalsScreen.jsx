import { useNavigate } from 'react-router-dom';
import { Check, RefreshCw, Undo2, X } from 'lucide-react';
import { Button, Input, SelectBox } from '@/components/ui';
import { ActionBar, Badge, Btn, Grid, Money, Sheet, fmtDate, inr } from '../../ui';
import { deskOf } from '../../CommandSearch';
import { accountsOf } from '../../VoucherDeskParts/voucherConfig';
import { useApprovals } from '../hooks/useApprovals';
import { SearchInput, ToolbarDivider } from './ToolbarBits';
import { tickColumn } from './tickColumn';

const TABS = [{ id: 'pending', label: 'Waiting for approval' }, { id: 'done', label: 'Approved / returned' }, { id: 'rules', label: 'Approval rules' }];

const AccountLines = ({ voucher }) => accountsOf(voucher).map((account, index) => (
  <div key={index} className="tw:flex tw:justify-between tw:gap-2.5 tw:text-[11px]">
    <span className="tw:max-w-[260px] tw:truncate">{account.dc === 'Cr' ? '  To ' : ''}{account.name}</span>
    <Money v={account.amount} side={account.dc} />
  </div>
));

function DecideButtons({ row, approvals }) {
  if (approvals.returning !== row.id) {
    return (
      <span className="tw:inline-flex tw:gap-1">
        <Btn small kind="save" onClick={() => approvals.decide([row], 'Approved')}><Check size={11} /> Approve</Btn>
        <Btn small kind="ghost" onClick={() => approvals.startReturn(row.id)}><Undo2 size={11} /> Return</Btn>
      </span>
    );
  }
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1">
      <Input data-allow-text autoFocus className="tw:w-[150px]" value={approvals.reason} onChange={(event) => approvals.setReason(event.target.value)} placeholder="Why returned" />
      <Btn small kind="danger" onClick={() => approvals.decide([row], 'Returned')}>Return</Btn>
      <Btn small kind="ghost" onClick={() => approvals.setReturning(null)}><X size={11} /></Btn>
    </span>
  );
}

// Approval System - vouchers waiting (with the rule that applies), approve / return, decided list, rules
export function ApprovalsScreen({ Rules, startTab = 'pending' }) {
  const navigate = useNavigate();
  const approvals = useApprovals(startTab);
  const { tab, shown, selected, busy } = approvals;
  const pending = tab === 'pending';
  const openVoucher = (row) => navigate('/accounts-hub?item=' + deskOf(row.baseType) + '&voucher=' + row.id);

  return (
    <Sheet tabs={TABS} tab={tab} onTab={approvals.setTab}>
      {tab === 'rules' && Rules}
      {tab !== 'rules' && (
        <>
          <ActionBar note={approvals.message}>
            <SearchInput className="tw:sm:w-[230px]" value={approvals.query} onChange={approvals.setQuery} placeholder="Voucher, party, job, narration" />
            <div className="tw:w-[150px]">
              <SelectBox options={approvals.types} value={approvals.type} onValueChange={approvals.setType} placeholder="All voucher types" clearable clearLabel="All voucher types" />
            </div>
            <Btn kind="primary" onClick={approvals.load} disabled={busy}><RefreshCw size={13} /> Refresh</Btn>
            {pending && (
              <>
                <ToolbarDivider />
                <Btn kind="save" onClick={() => approvals.decide(selected, 'Approved')} disabled={!selected.length}><Check size={13} /> Approve selected ({selected.length})</Btn>
              </>
            )}
            <span className="tw:ml-auto tw:text-[11.5px] tw:font-bold tw:text-foreground/80">{shown.length} vouchers, ₹ {inr(approvals.total, 0)}</span>
          </ActionBar>
          {pending && !approvals.data.rules.length && (
            <div className="tw:text-[11.5px] tw:text-muted-foreground tw:normal-case">
              No approval rules yet - every voucher waits here until someone approves it. Add rules in the Approval rules tab to name the approver by voucher type and amount.
            </div>
          )}
          <Grid title={pending ? 'Vouchers waiting' : 'Recent decisions'} maxHeight="calc(100vh - 330px)" rows={shown} rowKey={(row) => row.id}
            empty={busy ? 'Loading' : pending ? 'Nothing is waiting for approval' : 'No decisions yet'}
            cols={[
              ...(pending ? [tickColumn({ rows: shown, picked: approvals.picked, setPicked: approvals.setPicked, keyOf: (row) => row.id })] : []),
              { label: 'Date', render: (row) => fmtDate(row.date) },
              { label: 'Voucher', render: (row) => (
                <Button variant="link" className="tw:h-auto tw:flex-col tw:items-start tw:gap-0" onClick={() => openVoucher(row)}>
                  <b className="tw:text-head">{row.voucherNumber}</b>
                  <span className="tw:text-[10px] tw:font-normal tw:text-muted-foreground">{row.typeName}</span>
                </Button>
              ) },
              { label: 'Accounts', w: '34%', wrap: true, render: (row) => <AccountLines voucher={row} /> },
              { label: 'Amount', right: true, render: (row) => <b>{inr(row.totalAmount)}</b> },
              { label: 'Entered by', render: (row) => row.createdByName || '' },
              ...(pending ? [
                { label: 'Waiting', right: true, render: (row) => <span className={row.age > 3 ? 'tw:text-destructive' : 'tw:text-muted-foreground'}>{row.age}d</span> },
                { label: 'Approver (rule)', render: (row) => row.approvers || <span className="tw:text-muted-foreground">Any</span> },
                { label: '', render: (row) => <DecideButtons row={row} approvals={approvals} /> },
              ] : [
                { label: 'Decision', render: (row) => <Badge tone={/approv/i.test(row.status) ? 'ok' : 'bad'}>{row.status}</Badge> },
                { label: 'Reason', wrap: true, render: (row) => row.rejectionReason || '' },
                { label: 'On', render: (row) => fmtDate(row.updatedAt) },
              ]),
            ]} />
        </>
      )}
    </Sheet>
  );
}
