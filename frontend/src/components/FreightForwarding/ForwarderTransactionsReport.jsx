import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardFooter, CardTitle, DataTable, DateInput, Field, SelectBox, Table, TableBody, TableCell, TableRow } from '@/components/ui';
import { freightApi } from './freightApi';
import { pageCountOf, pageSlice, showingText } from './AirExportParts/airExport';
import { AirExportPage, PageSizeSelect, Pager } from './AirExportParts/widgets';

const EMPTY_FILTERS = { companyId: '', reportType: 'MONTHLY', fromDate: '', toDate: '', docType: 'All', airline: '' };
const EMPTY_SUMMARY = { totalMawb: 0, totalHawb: 0, totalRecords: 0 };
const ALL_COMPANIES = { name: 'ALL COMPANIES', address: '---' };
const PAGE_SIZES = [10, 20, 50, 100];

const REPORT_TYPES = ['MONTHLY', 'WEEKLY', 'DAILY'];
const DOC_TYPES = ['All', 'MAWB', 'HAWB'];

const isMaster = (row) => row.docType === 'MAWB';

const TRANSACTION_COLUMNS = [
  { key: 'sno', header: 'S.No' },
  { key: 'docType', header: 'Document Type', cell: (row) => <span className={cn('tw:font-bold', isMaster(row) ? 'tw:text-success' : 'tw:text-primary')}>{row.docType}</span> },
  { key: 'mawbNo', header: 'AWB/MAWB No', className: 'tw:font-bold' },
  { key: 'hawbNo', header: 'House Waybill No', cell: (row) => row.hawbNo || '-' },
  { key: 'airline', header: 'Airline' },
  { key: 'origin', header: 'Origin' },
  { key: 'destination', header: 'Destination' },
  { key: 'grossWeight', header: 'Gross Weight' },
  { key: 'pieces', header: 'No.of Pieces' },
  { key: 'shipper', header: 'Shipper' },
  { key: 'submittedDate', header: 'Submitted Date', cell: (row) => new Date(row.submittedDate).toLocaleDateString('en-GB') },
  { key: 'submittedBy', header: 'Submitted By' },
];

function SummaryTable({ companyInfo, summary, filters }) {
  const label = 'tw:bg-page tw:font-bold tw:uppercase';
  const counts = [
    { label: 'No of AWBs/Master AWBs', value: summary.totalMawb, className: 'tw:text-success' },
    { label: 'No of House Waybills', value: summary.totalHawb, className: 'tw:text-primary' },
    { label: 'Total No of Records', value: summary.totalRecords, className: 'tw:text-destructive' },
  ];
  return (
    <Table className="tw:text-entry tw:uppercase" containerClassName="tw:border-b-2 tw:border-border">
      <TableBody>
        <TableRow className="tw:even:bg-transparent">
          <TableCell className={cn(label, 'tw:w-[15%]')}>Company Name</TableCell>
          <TableCell className="tw:w-[35%] tw:font-bold tw:whitespace-normal">{companyInfo.name}</TableCell>
          <TableCell colSpan={2} className={cn(label, 'tw:w-1/4 tw:bg-primary/10 tw:text-center')}>Summary</TableCell>
        </TableRow>
        <TableRow className="tw:even:bg-transparent">
          <TableCell rowSpan={4} className={cn(label, 'tw:align-top')}>Address</TableCell>
          <TableCell rowSpan={4} className="tw:align-top tw:whitespace-normal tw:text-muted-foreground">{companyInfo.address || '---'}</TableCell>
          <TableCell className={label}>Period:</TableCell>
          <TableCell>{filters.fromDate && filters.toDate ? `${filters.fromDate} to ${filters.toDate}` : 'ALL TIME'}</TableCell>
        </TableRow>
        {counts.map((count) => (
          <TableRow key={count.label} className="tw:even:bg-transparent">
            <TableCell className={label}>{count.label}</TableCell>
            <TableCell className={cn('tw:font-bold', count.className)}>{count.value}</TableCell>
          </TableRow>
        ))}
        <TableRow className="tw:even:bg-transparent">
          <TableCell className={label}>Report Name</TableCell>
          <TableCell>Forwarder Transaction Report</TableCell>
          <TableCell className={label} />
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}

export default function ForwarderTransactionsReport() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [companyInfo, setCompanyInfo] = useState(ALL_COMPANIES);
  const [loading, setLoading] = useState(false);
  const [airlines, setAirlines] = useState([]);
  const [parties, setParties] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));

  const load = async (criteria = filters) => {
    setLoading(true);
    try {
      const result = await freightApi.forwarderTransactions(criteria);
      if (result.success) {
        setRows(result.data || []);
        setPage(1);
        setSummary(result.summary || EMPTY_SUMMARY);
        setCompanyInfo(result.companyInfo || ALL_COMPANIES);
        if (result.airlines) setAirlines(result.airlines);
        if (result.parties) setParties(result.parties);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => {
    setFilters(EMPTY_FILTERS);
    load(EMPTY_FILTERS);
  };

  return (
    <AirExportPage activeTab="forwarder-report" className="tw:gap-4 tw:px-4">
      <h2 className="tw:m-0 tw:text-xl tw:font-bold tw:tracking-tight tw:text-foreground">Forwarder Transactions Report</h2>

      <Card>
        <CardContent className="tw:grid tw:grid-cols-1 tw:gap-4 tw:p-4 tw:sm:grid-cols-2 tw:lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr]">
          <Field label="Company Name" layout="col">
            <SelectBox value={filters.companyId} onValueChange={setFilter('companyId')} placeholder="ALL COMPANIES" clearable clearLabel="ALL COMPANIES"
              options={parties.map((party) => ({ value: party.id, label: party.name }))} />
          </Field>
          <Field label="Report Type" layout="col"><SelectBox value={filters.reportType} onValueChange={setFilter('reportType')} options={REPORT_TYPES} /></Field>
          <Field label="From Date" layout="col"><DateInput value={filters.fromDate} onValueChange={setFilter('fromDate')} /></Field>
          <Field label="To Date" layout="col"><DateInput value={filters.toDate} onValueChange={setFilter('toDate')} /></Field>
          <Field label="Document Type" layout="col"><SelectBox value={filters.docType} onValueChange={setFilter('docType')} options={DOC_TYPES} /></Field>
          <Field label="Airline Name" layout="col">
            <SelectBox value={filters.airline} onValueChange={setFilter('airline')} placeholder="All Airlines" clearable clearLabel="All Airlines"
              options={airlines.map((airline) => ({ value: airline.code2, label: `${airline.name} (${airline.code2})` }))} />
          </Field>
        </CardContent>
        <CardFooter className="tw:justify-end tw:gap-4 tw:bg-secondary tw:px-4 tw:py-3">
          <Button variant="ghost" onClick={clear}>Clear</Button>
          <Button variant="default" onClick={() => load()}><Search /> Search</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardContent className="tw:gap-3 tw:p-4">
          <CardTitle className="tw:text-[15px]">Search Results</CardTitle>
          <PageSizeSelect value={pageSize} sizes={PAGE_SIZES} onValueChange={(size) => { setPageSize(size); setPage(1); }} />
          <div className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-border">
            <SummaryTable companyInfo={companyInfo} summary={summary} filters={filters} />
            <DataTable
              columns={TRANSACTION_COLUMNS}
              rows={loading ? [] : pageSlice(rows, page, pageSize)}
              rowKey={(row, index) => index}
              rowClassName={(row) => (isMaster(row) ? 'tw:bg-success/5 tw:even:bg-success/5' : 'tw:bg-primary/5 tw:even:bg-primary/5')}
              emptyText={loading ? 'Loading data...' : 'No transactions found.'}
            />
          </div>
          {rows.length > 0 && (
            <Pager className="tw:mt-4" page={page} pageCount={pageCountOf(rows.length, pageSize)} onPageChange={setPage} summary={showingText(page, pageSize, rows.length)} />
          )}
        </CardContent>
      </Card>
    </AirExportPage>
  );
}
