import { useEffect, useState } from 'react';
import { Download, Eye, FileText, Mail, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DataTable, Separator } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import VoucherDrawer from './AccountsHubParts/VoucherDrawer';
import { ReportFrame, ReportMessage, ReportPage, ReportSheet } from './LedgerReportParts/ReportLayout';
import { PeriodFilter } from './LedgerReportParts/ReportFilters';
import { dayFirst, formatAmount, periodText, todayIso } from './LedgerReportParts/format';

const ledgerNames = (voucher, side) => voucher.details.filter((line) => line.dc === side).map((line) => line.ledger?.name).join(', ');

// Receipts and sales are read by the party credited; every other voucher by the ledger debited.
const mainLedger = (voucher) =>
  ['Receipt', 'Sales'].includes(voucher.voucherType.baseType) ? ledgerNames(voucher, 'Cr') : ledgerNames(voucher, 'Dr');

const COLUMNS = [
  { key: 'date', header: 'Date', width: 90, className: 'tw:font-medium', cell: (voucher) => dayFirst(voucher.date) },
  {
    key: 'particulars',
    header: 'Particulars',
    className: 'tw:font-bold tw:whitespace-normal tw:text-foreground',
    cell: (voucher) => (
      <>
        {mainLedger(voucher)}
        {voucher.narration && <div className="tw:mt-1 tw:text-[11px] tw:font-normal tw:text-muted-foreground tw:italic">{voucher.narration}</div>}
      </>
    ),
  },
  { key: 'voucherType', header: 'Vch Type', width: 120, cell: (voucher) => voucher.voucherType.name },
  { key: 'voucherNumber', header: 'Vch No.', width: 100, className: 'tw:font-semibold' },
  { key: 'debit', header: 'Debit (₹)', align: 'right', width: 150, className: 'tw:font-semibold tw:text-primary', cell: (voucher) => formatAmount(voucher.totalAmount) },
  { key: 'credit', header: 'Credit (₹)', align: 'right', width: 150, className: 'tw:font-semibold tw:text-destructive', cell: (voucher) => formatAmount(voucher.totalAmount) },
];

export default function Daybook() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [selectedId, setSelectedId] = useState(null);
  const [drawerId, setDrawerId] = useState(null);

  useEffect(() => {
    const loadDaybook = async () => {
      setLoading(true);
      try {
        const body = await accountsApi.ledgerReportDaybook({ startDate, endDate });
        setVouchers(body.data || []);
        setSelectedId(null);
      } catch (error) {
        console.error('Error fetching daybook', errorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    loadDaybook();
  }, [startDate, endDate]);

  const showVoucher = (id) => { setSelectedId(id); setDrawerId(id); };

  const viewSelected = () => {
    if (!selectedId) return toast.error('Please select a voucher to view');
    setDrawerId(selectedId);
  };

  const actions = (
    <>
      <Button variant="default" onClick={viewSelected}><Eye /> View</Button>
      <Separator orientation="vertical" className="tw:mx-1 tw:data-[orientation=vertical]:h-5" />
      <Button onClick={() => window.print()}><Printer /> Print</Button>
      <Button onClick={() => toast('Emailing Daybook to registered company ID...')}><Mail /> Email</Button>
      <Button onClick={() => toast('Exporting Daybook to Excel/PDF...')}><Download /> Export</Button>
    </>
  );

  const filters = <PeriodFilter label="Period:" from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} />;

  return (
    <ReportPage icon={FileText} tone="warning" title="Daybook" subtitle="Daily Transaction Register" actions={actions}>
      <ReportFrame filters={filters}>
        {loading ? (
          <ReportMessage tone="loading">Loading Daybook...</ReportMessage>
        ) : (
          <ReportSheet title="Daybook Register" period={periodText(startDate, endDate)}>
            <DataTable
              columns={COLUMNS}
              rows={vouchers}
              selectedKey={selectedId}
              onRowClick={(voucher) => showVoucher(voucher.id)}
              rowTitle="Show this voucher's details"
              emptyText="No entries found for the selected period."
              stickyHeader={false}
            />
          </ReportSheet>
        )}
      </ReportFrame>
      {drawerId && (
        <VoucherDrawer
          id={drawerId}
          ids={vouchers.map((voucher) => voucher.id)}
          onMove={showVoucher}
          onClose={() => setDrawerId(null)}
        />
      )}
    </ReportPage>
  );
}
