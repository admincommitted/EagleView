import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import {
  Button, Card, DataTable, DateInput, Field, SelectBox, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { freightApi } from './freightApi';
import { exportRowsToExcel } from './awbExcel';
import { oneDecimal } from './AirExportParts/airExport';
import { AirExportPage, ReportHeader } from './AirExportParts/widgets';
import { useReportPickLists } from './AirExportParts/useReportPickLists';
import {
  AWB_TYPE_OPTIONS, DATE_BASIS_OPTIONS, detailExcelColumns, docsLabel, groupLabel, GROUPS, initialFilters, printTonnage, quickRanges,
  summaryExcelColumns, toYmd,
} from './TonnageReportParts/tonnageConfig';

const DETAIL_COLUMNS = [
  { key: 'day', header: 'Date' },
  { key: 'kind', header: 'Type' },
  { key: 'no', header: 'AWB / MAWB' },
  { key: 'hawb', header: 'HAWB' },
  { key: 'customer', header: 'Shipper' },
  { key: 'route', header: 'Route', cell: (row) => `${row.origin} → ${row.destination}` },
  { key: 'flight', header: 'Flight' },
  { key: 'pieces', header: 'Pcs', align: 'right' },
  { key: 'gross', header: 'Gross', align: 'right', cell: (row) => oneDecimal(row.gross) },
  { key: 'chargeable', header: 'Chargeable', align: 'right', cell: (row) => oneDecimal(row.chargeable) },
];

function TotalTiles({ report }) {
  const { totals } = report;
  const tiles = [
    { label: docsLabel(report.groupBy), value: totals.docs },
    { label: 'Pieces', value: totals.pieces },
    { label: 'Gross weight', value: `${oneDecimal(totals.grossWeight)} kg` },
    { label: 'Chargeable weight', value: `${oneDecimal(totals.chargeableWeight)} kg` },
    { label: 'Chargeable tonnes', value: totals.tonnes },
  ];
  return (
    <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] tw:gap-2.5 tw:px-3 tw:py-2.5">
      {tiles.map((tile) => (
        <div key={tile.label} className="tw:rounded-md tw:bg-page tw:px-2.5 tw:py-2">
          <div className="tw:text-[10px] tw:font-extrabold tw:text-muted-foreground tw:uppercase">{tile.label}</div>
          <div className="tw:text-lg tw:font-black">{tile.value}</div>
        </div>
      ))}
    </div>
  );
}

function GroupTable({ report }) {
  const maxWeight = Math.max(1, ...report.groups.map((group) => group.chargeableWeight));
  const right = 'tw:text-right tw:tabular-nums';
  return (
    <Table className="tw:text-entry">
      <TableHeader>
        <TableRow>
          <TableHead>{groupLabel(report.groupBy)}</TableHead>
          <TableHead className={right}>{docsLabel(report.groupBy)}</TableHead>
          <TableHead className={right}>Pieces</TableHead>
          <TableHead className={right}>Gross wt (kg)</TableHead>
          <TableHead className={right}>Chargeable wt (kg)</TableHead>
          <TableHead className="tw:w-[30%]">Share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.groups.map((group) => (
          <TableRow key={group.key}>
            <TableCell className="tw:font-bold">{group.label}</TableCell>
            <TableCell className={right}>{group.docs}</TableCell>
            <TableCell className={right}>{group.pieces}</TableCell>
            <TableCell className={right}>{oneDecimal(group.grossWeight)}</TableCell>
            <TableCell className={`${right} tw:font-bold`}>{oneDecimal(group.chargeableWeight)}</TableCell>
            <TableCell>
              <div className="tw:flex tw:items-center tw:gap-1.5">
                <div className="tw:h-2 tw:flex-1 tw:rounded tw:bg-muted">
                  <div className="tw:h-full tw:w-(--bar-w) tw:rounded tw:bg-primary" style={{ '--bar-w': `${(group.chargeableWeight / maxWeight) * 100}%` }} />
                </div>
                <span className="tw:w-11 tw:text-right">{group.share}%</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {!report.groups.length && (
          <TableRow><TableCell colSpan={6} className="tw:text-center tw:text-muted-foreground">No AWB in this period.</TableCell></TableRow>
        )}
      </TableBody>
      {report.groups.length > 0 && (
        <TableFooter className="tw:font-extrabold">
          <TableRow>
            <TableCell>TOTAL</TableCell>
            <TableCell className={right}>{report.totals.docs}</TableCell>
            <TableCell className={right}>{report.totals.pieces}</TableCell>
            <TableCell className={right}>{oneDecimal(report.totals.grossWeight)}</TableCell>
            <TableCell className={right}>{oneDecimal(report.totals.chargeableWeight)}</TableCell>
            <TableCell>100%</TableCell>
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}

function useTonnageReport() {
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (criteria = filters) => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await freightApi.tonnageReport(criteria);
      if (!data.success) throw new Error(data.error || 'Could not load');
      setReport(data);
    } catch (error) {
      setLoadError(errorMessage(error));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));
  const changeAndRun = (changes) => {
    const next = { ...filters, ...changes };
    setFilters(next);
    run(next);
  };

  return { filters, setFilter, changeAndRun, run, report, loadError, loading };
}

export default function TonnageReport({ embedded = false }) {
  const { filters, setFilter, changeAndRun, run, report, loadError, loading } = useTonnageReport();
  const { airlineOptions, agentOptions } = useReportPickLists();
  const [showRows, setShowRows] = useState(false);

  const excel = () => report && exportRowsToExcel(
    `Tonnage_${report.groupBy}_${report.from}_${report.to}`,
    'Tonnage',
    summaryExcelColumns(report),
    [...report.groups, { label: 'TOTAL', ...report.totals, share: 100 }],
  );
  const excelRows = () => report && exportRowsToExcel(`Tonnage_detail_${report.from}_${report.to}`, 'AWBs', detailExcelColumns(report), report.rows);
  const print = () => report && printTonnage(report);

  return (
    <AirExportPage activeTab="" showTabs={!embedded} className={embedded ? 'tw:py-0' : undefined}>
      <Card>
        <ReportHeader title="TONNAGE REPORT - AIR EXPORT" ready={Boolean(report)} onShow={() => run()} onPrint={print} onExcel={excel} />
        <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(140px,100%),1fr))] tw:items-end tw:gap-x-2.5 tw:gap-y-1.5 tw:px-3 tw:py-2">
          <Field label="From" layout="col"><DateInput value={filters.from} onValueChange={setFilter('from')} /></Field>
          <Field label="To" layout="col"><DateInput value={filters.to} onValueChange={setFilter('to')} /></Field>
          <Field label="Date is" layout="col"><SelectBox value={filters.dateBasis} onValueChange={setFilter('dateBasis')} options={DATE_BASIS_OPTIONS} /></Field>
          <Field label="Group by" layout="col"><SelectBox value={filters.groupBy} onValueChange={(groupBy) => changeAndRun({ groupBy })} options={GROUPS} /></Field>
          <Field label="Airline" layout="col">
            <SelectBox value={filters.airline} onValueChange={setFilter('airline')} placeholder="All airlines" clearable clearLabel="All airlines" options={airlineOptions} />
          </Field>
          <Field label="IATA agent" layout="col">
            <SelectBox value={filters.agent} onValueChange={setFilter('agent')} placeholder="All agents" clearable clearLabel="All agents" options={agentOptions} />
          </Field>
          <Field label="AWB type" layout="col"><SelectBox value={filters.type} onValueChange={setFilter('type')} options={AWB_TYPE_OPTIONS} /></Field>
          <div className="tw:col-span-full tw:flex tw:flex-wrap tw:gap-1.5 tw:sm:col-span-2">
            {quickRanges().map((range) => (
              <Button key={range.label} size="sm" variant="secondary" className="tw:rounded-full" onClick={() => changeAndRun({ from: toYmd(range.from), to: toYmd(range.to) })}>
                {range.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="tw:overflow-hidden">
        {loadError && <div className="tw:px-3 tw:py-2.5 tw:text-entry tw:text-destructive">{loadError}</div>}
        {loading && <div className="tw:px-3 tw:py-2.5 tw:text-entry tw:text-muted-foreground">Loading...</div>}
        {report && !loading && (
          <>
            <TotalTiles report={report} />
            <GroupTable report={report} />
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:px-3 tw:py-2 tw:text-[11px] tw:text-muted-foreground">
              <span>Counted: live direct AWBs and MAWBs (VOID left out). &quot;Customer&quot; counts direct AWBs and the houses of each MAWB. Chargeable weight from the rate lines.</span>
              <Button size="sm" onClick={() => setShowRows((shown) => !shown)}>{showRows ? 'Hide' : 'Show'} AWB list ({report.rows.length})</Button>
              <Button size="sm" variant="success" onClick={excelRows}>Excel of AWB list</Button>
            </div>
            {showRows && (
              <DataTable columns={DETAIL_COLUMNS} rows={report.rows} rowKey={(row, index) => index} containerClassName="tw:max-h-[360px] tw:border-t tw:border-border" />
            )}
          </>
        )}
      </Card>
    </AirExportPage>
  );
}
