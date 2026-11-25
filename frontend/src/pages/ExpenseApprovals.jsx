import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle, Clock, FileDigit, Search, ShieldCheck } from 'lucide-react';
import { getUser } from '../utils/permissions';
import { errorMessage } from '@/services/axiosInstance';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, DataTable, Input, StatCard } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import PageHeader from './PurchaseParts/PageHeader';
import VoucherReviewPanel from './PurchaseParts/VoucherReviewPanel';
import { voucherColumns } from './PurchaseParts/voucherColumns';
import { daysWaiting, toVoucherRow, VOUCHER_ACTIONS, voucherMatches } from './PurchaseParts/voucherRows';

function AllCaughtUp() {
  return (
    <div className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:py-6">
      <CheckCircle className="tw:size-12 tw:text-success tw:opacity-50" />
      <div>All caught up! No pending approvals.</div>
    </div>
  );
}

export default function ExpenseApprovals() {
  const [pendingVouchers, setPendingVouchers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [remarks, setRemarks] = useState('');

  const loadVouchers = useCallback(async () => {
    try {
      const body = await purchaseApi.pendingVouchers();
      setPendingVouchers((Array.isArray(body.data) ? body.data : []).map(toVoucherRow));
    } catch (error) {
      setPendingVouchers([]);
      toast.error(`Could not load pending vouchers: ${errorMessage(error)}`);
    }
  }, []);
  useEffect(() => { loadVouchers(); }, [loadVouchers]);

  const takeAction = async (action) => {
    const { status, needsRemarks } = VOUCHER_ACTIONS[action];
    if (!remarks && needsRemarks) {
      toast.error(`Remarks are mandatory for ${action.toLowerCase()}ing a voucher.`);
      return;
    }
    const toastId = toast.loading(`Processing ${action}...`);
    try {
      await purchaseApi.setVoucherStatus(selectedVoucher.id, { status, rejectionReason: remarks, userId: getUser().id });
      toast.success(`Voucher ${status.toLowerCase()}`, { id: toastId });
      setSelectedVoucher(null);
      setRemarks('');
      loadVouchers();
    } catch (error) {
      toast.error(`Could not ${action.toLowerCase()}: ${errorMessage(error)}`, { id: toastId });
    }
  };

  const totalPendingAmount = pendingVouchers.reduce((sum, voucher) => sum + voucher.amount, 0);
  const oldestDays = pendingVouchers.reduce((oldest, voucher) => Math.max(oldest, daysWaiting(voucher)), 0);
  const shownVouchers = pendingVouchers.filter((voucher) => voucherMatches(voucher, searchTerm));

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[1400px] tw:flex-col tw:gap-6 tw:p-3 tw:md:p-6">
      <PageHeader icon={ShieldCheck} title="Manager Expense Approvals" subtitle="Review, Approve, or Return pending vouchers & expenses." />

      <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
        <StatCard label="Pending Approvals" icon={Clock} tone="primary" value={pendingVouchers.length} />
        <StatCard label="Total Value Pending" icon={FileDigit} tone="warning" value={`₹ ${totalPendingAmount.toLocaleString()}`} />
        <StatCard label="Waiting Longest" icon={AlertCircle} tone="danger" value={oldestDays <= 0 ? '-' : `${oldestDays} d`} />
      </div>

      <div className={cn('tw:grid tw:grid-cols-1 tw:gap-6', selectedVoucher && 'tw:lg:grid-cols-[2fr_1fr]')}>
        <Card className="tw:overflow-hidden">
          <CardHeader className="tw:flex-wrap tw:border-b tw:border-border tw:bg-page tw:py-3">
            <CardTitle>Approval Queue</CardTitle>
            <Input leftIcon={Search} data-allow-text="" className="tw:w-full tw:sm:w-56" placeholder="Search Voucher / Dept..."
              value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </CardHeader>
          <DataTable
            columns={voucherColumns((voucher) => setSelectedVoucher(voucher))}
            rows={shownVouchers}
            selectedKey={selectedVoucher?.id}
            emptyText={pendingVouchers.length ? 'No voucher matches the search.' : <AllCaughtUp />}
            className="tw:text-entry"
          />
        </Card>

        {selectedVoucher && (
          <VoucherReviewPanel voucher={selectedVoucher} remarks={remarks} onRemarks={setRemarks} onAction={takeAction} />
        )}
      </div>
    </div>
  );
}
