import { Download, FileText, Printer, RefreshCw } from 'lucide-react';
import { SelectBox } from '@/components/ui';
import { errorMessage } from '@/services/axiosInstance';
import { ActionBar, Btn, inr } from '../../ui';
import VoucherDrawer from '../../VoucherDrawer';
import { Notice } from '../../VoucherDeskParts/sections/Notice';
import { StatStrip, Stat } from '../../OtherDeskParts/sections/StatStrip';
import { SearchInput, ToolbarDivider } from '../../OtherDeskParts/sections/ToolbarBits';
import { useReportView } from '../hooks/useReportView';
import { excelReport, exportReportCsv } from '../reportOutput';
import { ReportFilters } from './ReportFilters';
import { ReportTable } from './ReportTable';

function ReportToolbar({ item, report }) {
  const { data, rows } = report;
  const makeExcel = async () => {
    try {
      await excelReport(report.outputArgs());
    } catch (error) {
      report.setError('Excel not made: ' + errorMessage(error));
    }
  };
  return (
    <ActionBar note={report.error}>
      <Btn kind="primary" onClick={() => report.run()} disabled={report.busy}><RefreshCw size={13} /> {report.busy ? 'Loading' : 'Show'}</Btn>
      <Btn kind="save" onClick={makeExcel} disabled={!rows.length}><Download size={13} /> Excel</Btn>
      <Btn kind="plain" onClick={report.print} disabled={!data}><Printer size={13} /> Print</Btn>
      <Btn kind="ghost" onClick={() => exportReportCsv(item.label, report.columns, rows)} disabled={!rows.length} title="Plain CSV of the rows"><FileText size={12} /> CSV</Btn>
      {data && (
        <>
          <ToolbarDivider />
          <SearchInput className="tw:sm:w-[190px]" value={report.rowFilter} onChange={report.setRowFilter} placeholder="Filter rows" />
          {report.groupColumns.length > 0 && (
            <div className="tw:w-[170px]">
              <SelectBox options={report.groupColumns.map((column) => ({ value: column.key, label: 'Group by ' + column.label }))} value={report.groupBy}
                onValueChange={report.pickGroup} placeholder="No grouping" clearable clearLabel="No grouping" />
            </div>
          )}
          {report.canDrill && <span className="tw:ml-auto tw:text-[11px] tw:text-muted-foreground tw:normal-case">Click a row to open it</span>}
        </>
      )}
    </ActionBar>
  );
}

function LimitedNotice({ report }) {
  const { limited } = report.data;
  const total = Number(limited.total).toLocaleString('en-IN');
  return (
    <Notice className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5 tw:font-normal tw:text-foreground">
      <span>Latest <b>{limited.shown}</b> of <b>{total}</b> bills in this period are shown. Search above (voucher, invoice no, party, docket, amount) to find any other bill.</span>
      <Btn small kind="clear" onClick={() => report.run(true)} disabled={report.busy}>Load all {total}</Btn>
    </Notice>
  );
}

function TotalsStrip({ report }) {
  return (
    <StatStrip className="tw:gap-x-7">
      <Stat label="Rows" value={report.rows.length} />
      {report.moneyTotals.map((column) => (
        <Stat key={column.key} label={(column.group && column.label.length < 8 ? column.group + ' ' : '') + column.label}
          value={column.type === 'money' ? inr(report.totals[column.key]) : report.totals[column.key]} />
      ))}
      <div className="tw:ml-auto tw:self-center tw:text-[11px] tw:text-muted-foreground tw:normal-case">{report.period}</div>
    </StatStrip>
  );
}

// every register / balance report: period presets, filters, totals strip, sort by any column, group with sub-totals,
// filter rows, click a row to open its voucher or ledger, Excel and print. Backend: /accounts-hub/reports/:name
export function ReportView({ item }) {
  const report = useReportView(item);
  const { data, rows } = report;
  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <ReportFilters item={item} report={report} />
      <ReportToolbar item={item} report={report} />
      {data?.limited && <LimitedNotice report={report} />}
      {data && report.moneyTotals.length > 0 && rows.length > 0 && <TotalsStrip report={report} />}
      {data && <ReportTable report={report} label={item.label} />}
      {report.drawerVoucher && (
        <VoucherDrawer id={report.drawerVoucher} ids={report.drawerIds} onMove={report.setDrawerVoucher} onClose={() => report.setDrawerVoucher(null)} />
      )}
    </div>
  );
}
