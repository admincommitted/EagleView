import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import {
  Card, CardHeader, CardTitle, DataTable, Field, SelectBox, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { freightApi } from './freightApi';
import { exportRowsToExcel } from './awbExcel';
import { oneDecimal, twoDecimals } from './AirExportParts/airExport';
import { AirExportPage, ReportHeader } from './AirExportParts/widgets';
import { useReportPickLists } from './AirExportParts/useReportPickLists';
import {
  commissionOf, CSR_COLUMNS, CSR_EXCEL_COLUMNS, itemValue, owesAirline, printCsr, statementKey, statementsOf, TOTAL_MONEY_KEYS,
} from './CsrStatementParts/csrConfig';

const netClass = (summary) => (owesAirline(summary) ? 'tw:text-destructive' : 'tw:text-success');
const netTitle = (summary) => (owesAirline(summary) ? 'Payable to airline' : 'Receivable from airline');

const SUMMARY_COLUMNS = [
  { key: 'agent', header: 'IATA Agent' },
  {
    key: 'airline',
    header: 'Airline',
    className: 'tw:font-bold',
    cell: (summary) => (
      <>
        {summary.airlinePrefix} {summary.airline}{' '}
        <span className="tw:font-normal tw:text-muted-foreground">({summary.commType === 'NET' ? 'NET' : `${summary.commRate}%`})</span>
      </>
    ),
  },
  { key: 'currency', header: 'Cur' },
  { key: 'awbs', header: 'AWBs', align: 'right' },
  { key: 'chargeableWeight', header: 'Chg Wt', align: 'right', cell: (summary) => oneDecimal(summary.chargeableWeight) },
  { key: 'weightPP', header: 'Wt Chg PP', align: 'right', cell: (summary) => twoDecimals(summary.weightPP) },
  { key: 'weightCC', header: 'Wt Chg CC', align: 'right', cell: (summary) => twoDecimals(summary.weightCC) },
  { key: 'dueCarrier', header: 'Due Carrier', align: 'right', cell: (summary) => twoDecimals(summary.dueCarrierPP + summary.dueCarrierCC) },
  { key: 'dueAgent', header: 'Due Agent', align: 'right', cell: (summary) => twoDecimals(summary.dueAgentPP + summary.dueAgentCC) },
  { key: 'commission', header: 'Commission', align: 'right', cell: (summary) => twoDecimals(commissionOf(summary)) },
  { key: 'payable', header: 'Payable', align: 'right', cell: (summary) => twoDecimals(summary.payable) },
  { key: 'receivable', header: 'Receivable', align: 'right', cell: (summary) => twoDecimals(summary.receivable) },
  {
    key: 'net',
    header: 'Net',
    align: 'right',
    cell: (summary) => <span title={netTitle(summary)} className={cn('tw:font-extrabold', netClass(summary))}>{twoDecimals(summary.net)}</span>,
  },
];

const detailCell = (item, column) => {
  if (column.money) return twoDecimals(itemValue(item, column.key));
  if (column.key === 'chargeableWeight') return oneDecimal(item[column.key]);
  return item[column.key];
};

function StatementTable({ statement }) {
  const align = (column) => (column.text ? 'tw:text-left' : 'tw:text-right tw:tabular-nums');
  return (
    <Card className="tw:overflow-hidden">
      <CardHeader className="tw:border-b tw:border-border tw:py-1.5">
        <CardTitle className="tw:font-extrabold tw:text-foreground">
          {statement.agent} · {statement.airlinePrefix} {statement.airline} - {statement.currency} · {statement.awbs} AWB
        </CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>{CSR_COLUMNS.map((column) => <TableHead key={column.key} className={align(column)}>{column.header}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {statement.items.map((item) => (
            <TableRow key={item.id}>
              {CSR_COLUMNS.map((column) => (
                <TableCell key={column.key} className={cn(align(column), column.key === 'net' && 'tw:font-bold')}>{detailCell(item, column)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="tw:font-extrabold">
          <TableRow>
            <TableCell colSpan={4}>TOTAL</TableCell>
            <TableCell className="tw:text-right">{statement.pieces}</TableCell>
            <TableCell className="tw:text-right">{oneDecimal(statement.chargeableWeight)}</TableCell>
            <TableCell />
            {TOTAL_MONEY_KEYS.map((key) => <TableCell key={key} className="tw:text-right">{twoDecimals(statement[key])}</TableCell>)}
            <TableCell className="tw:text-right">{twoDecimals(commissionOf(statement))}</TableCell>
            <TableCell className="tw:text-right">{twoDecimals(statement.payable)}</TableCell>
            <TableCell className="tw:text-right">{twoDecimals(statement.receivable)}</TableCell>
            <TableCell className={cn('tw:text-right', netClass(statement))}>{twoDecimals(statement.net)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );
}

function useCsrReport() {
  const [periods, setPeriods] = useState([]);
  const [filters, setFilters] = useState({ period: '', airline: 'ALL', agent: 'ALL' });
  const [report, setReport] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const data = await freightApi.csrPeriods();
        if (!data.success) return;
        setPeriods(data.periods);
        setFilters((current) => ({ ...current, period: current.period || (data.periods[1] || data.periods[0]).period }));
      } catch {
        // no periods: the statement cannot be shown
      }
    };
    loadPeriods();
  }, []);

  const run = async (criteria = filters) => {
    if (!criteria.period) return;
    setLoading(true);
    setLoadError('');
    try {
      const data = await freightApi.csrReport(criteria);
      if (!data.success) throw new Error(data.error || 'Could not load');
      setReport(data);
    } catch (error) {
      setLoadError(errorMessage(error));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (filters.period) run(filters); }, [filters.period]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeAndRun = (key) => (value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    run(next);
  };

  return { periods, filters, setPeriod: (period) => setFilters((current) => ({ ...current, period })), changeAndRun, run, report, loadError, loading };
}

export default function CsrStatement() {
  const { periods, filters, setPeriod, changeAndRun, run, report, loadError, loading } = useCsrReport();
  const { airlineOptions, agentOptions } = useReportPickLists();
  const statements = report ? statementsOf(report) : [];

  const excel = () => report && exportRowsToExcel(`CSR_${report.airline}_${report.from}_${report.to}`, `CSR ${report.label}`, CSR_EXCEL_COLUMNS, report.items);
  const print = () => report && printCsr(report, statements);

  return (
    <AirExportPage activeTab="">
      <Card>
        <ReportHeader title="CSR STATEMENT (CARGO SALES REPORT)" ready={Boolean(report)} onShow={() => run()} onPrint={print} onExcel={excel} />
        <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] tw:gap-x-2.5 tw:gap-y-1.5 tw:px-3 tw:py-2">
          <Field label="CASS period" layout="col">
            <SelectBox value={filters.period} onValueChange={setPeriod} options={periods.map((period) => ({ value: period.period, label: period.label }))} />
          </Field>
          <Field label="Airline" layout="col">
            <SelectBox value={filters.airline} onValueChange={changeAndRun('airline')} options={[{ value: 'ALL', label: 'All airlines' }, ...airlineOptions]} />
          </Field>
          <Field label="IATA agent (forwarder)" layout="col">
            <SelectBox value={filters.agent} onValueChange={changeAndRun('agent')} options={[{ value: 'ALL', label: 'All agents' }, ...agentOptions]} />
          </Field>
        </div>
      </Card>

      {loadError && <div className="tw:text-entry tw:text-destructive">{loadError}</div>}
      {loading && <div className="tw:text-entry tw:text-muted-foreground">Loading...</div>}
      {report && !loading && (
        <>
          <Card className="tw:overflow-hidden">
            <CardHeader className="tw:border-b tw:border-border tw:py-1.5">
              <CardTitle className="tw:font-extrabold tw:text-foreground">SUMMARY - {report.label}</CardTitle>
            </CardHeader>
            <DataTable columns={SUMMARY_COLUMNS} rows={report.airlineSummary} rowKey={statementKey} emptyText="No AWB in this period." />
            <div className="tw:px-3 tw:py-1.5 tw:text-[11px] tw:text-muted-foreground">
              Net = payable (PP weight charge + valuation + tax + due carrier − commission on PP) − receivable (CC due agent + commission on CC).{' '}
              <b className="tw:text-destructive">Red</b> = pay the airline, <b className="tw:text-success">green</b> = airline owes you.
              Commission % and NET / GROSS come from Masters → Airline. AWB date = execution date on the AWB (else flight date). Check against the airline / CASS billing before payment.
            </div>
          </Card>

          {statements.map((statement) => <StatementTable key={statementKey(statement)} statement={statement} />)}
        </>
      )}
    </AirExportPage>
  );
}
