import { useState } from 'react';
import { BarChart2, Download, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button, Card, DateInput, SelectBox } from '@/components/ui';
import TonnageReport from '../components/FreightForwarding/TonnageReport';
import PageHeader from './PurchaseParts/PageHeader';
import { reportById } from './AdvancedReportsParts/reports';
import { financialYearStart, PERIOD_OPTIONS, periodRange, todayIso } from './AdvancedReportsParts/reportPeriods';
import useReportData from './AdvancedReportsParts/useReportData';
import ReportSidebar from './AdvancedReportsParts/ReportSidebar';
import ReportFilters from './AdvancedReportsParts/ReportFilters';
import ReportTable from './AdvancedReportsParts/ReportTable';

// The Director Dashboard's "Investigate" opens ?report=expenses&q=<job no>, so a loss-making job lands on its expense lines.
const readLinkedReport = () => {
  const params = new URLSearchParams(window.location.search);
  return { report: params.get('report') || 'profitability', query: params.get('q') || '' };
};

export default function AdvancedReports() {
  const [linked] = useState(readLinkedReport);
  const [activeId, setActiveId] = useState(linked.report);
  const [period, setPeriod] = useState('this_year');
  const [from, setFrom] = useState(financialYearStart);
  const [to, setTo] = useState(todayIso);
  const [showFilters, setShowFilters] = useState(!!linked.query);
  const [textFilter, setTextFilter] = useState(linked.query);
  const [minAmount, setMinAmount] = useState('');

  const report = reportById(activeId);
  const { rows, meta, loading, error, reload } = useReportData(report, from, to);

  const matchesFilters = (row) => {
    if (textFilter && !String(report.searchText(row) || '').toLowerCase().includes(textFilter.toLowerCase())) return false;
    if (minAmount && Math.abs(Number(report.amount(row)) || 0) < Number(minAmount)) return false;
    return true;
  };
  const shownRows = report.embedded ? [] : rows.filter(matchesFilters);

  const choosePeriod = (choice) => {
    setPeriod(choice);
    const range = periodRange(choice);
    if (!range) return;
    setFrom(range.from);
    setTo(range.to);
  };

  const exportExcel = async () => {
    if (report.embedded) {
      toast.error('Use the Export button inside the Tonnage report');
      return;
    }
    if (!shownRows.length) {
      toast.error('Nothing to export');
      return;
    }
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(shownRows.map(report.exportRow)), report.sheet.slice(0, 31));
    XLSX.writeFile(workbook, `${report.id}-${from}-to-${to}.xlsx`);
  };

  const statusText = loading ? 'Loading...' : error || meta.note;

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[1400px] tw:flex-col tw:gap-6 tw:p-3 tw:md:p-6">
      <PageHeader
        icon={BarChart2}
        title="Advanced Reports & Analytics"
        subtitle="Tonnage, Profitability, Sales, and Collections"
        actions={(
          <>
            <SelectBox className="tw:w-full tw:sm:w-52" options={PERIOD_OPTIONS} value={period} onValueChange={choosePeriod} />
            <DateInput wrapperClassName="tw:w-32" value={from} onValueChange={setFrom} />
            <DateInput wrapperClassName="tw:w-32" value={to} onValueChange={setTo} />
            <Button variant={showFilters ? 'default' : 'outline'} size="lg" onClick={() => setShowFilters((current) => !current)}>
              <Filter /> Filters{textFilter || minAmount ? ' (on)' : ''}
            </Button>
            <Button variant="success" size="lg" onClick={exportExcel}><Download /> Export Excel</Button>
          </>
        )}
      />

      <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-[260px_1fr]">
        <ReportSidebar activeId={report.id} onSelect={setActiveId} />

        <Card className="tw:overflow-hidden">
          <div className="tw:border-b tw:border-border tw:bg-page tw:p-5">
            <h3 className="tw:m-0 tw:text-base tw:capitalize tw:text-foreground">{report.title}</h3>
          </div>

          {report.embedded ? (
            <div className="tw:p-3"><TonnageReport embedded /></div>
          ) : (
            <>
              {showFilters && (
                <ReportFilters
                  text={textFilter}
                  onTextChange={setTextFilter}
                  minAmount={minAmount}
                  onMinAmountChange={setMinAmount}
                  onClear={() => { setTextFilter(''); setMinAmount(''); }}
                  onReload={reload}
                />
              )}
              {statusText && (
                <div className={cn('tw:border-b tw:border-border tw:px-5 tw:py-2.5 tw:text-xs tw:normal-case',
                  error && !loading ? 'tw:bg-destructive/10 tw:text-destructive' : 'tw:bg-page tw:text-muted-foreground')}>
                  {statusText}
                </div>
              )}
              <ReportTable
                columns={report.columns}
                rows={shownRows}
                rowKey={report.rowKey}
                emptyText={loading ? null : report.emptyText}
                footer={meta.kind === report.id ? report.footer(meta) : null}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
