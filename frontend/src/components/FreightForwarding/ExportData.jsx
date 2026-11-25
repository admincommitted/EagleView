import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { downloadCsv } from '@/lib/download';
import { Button, Card, CardContent, CardFooter, CardTitle, DataTable, DateInput, Field, SelectBox } from '@/components/ui';
import { freightApi } from './freightApi';
import { pageCountOf, pageSlice, showingText } from './AirExportParts/airExport';
import { AirExportPage, PageSizeSelect, Pager } from './AirExportParts/widgets';

const EMPTY_FILTERS = { fileType: 'MAWB', fromDate: '', toDate: '' };
const PAGE_SIZES = [10, 20, 50, 100];

const FILE_TYPE_OPTIONS = [
  { value: 'All', label: 'All Types' },
  { value: 'MAWB', label: 'AIR WAYBILL' },
  { value: 'HAWB', label: 'HOUSE WAYBILL' },
];

const CSV_COLUMNS = [
  { key: 'type', header: 'TYPE' },
  { key: 'awb', header: 'AWB NUMBER' },
  { key: 'status', header: 'STATUS' },
  { key: 'airlineCode', header: 'AIRLINE CODE' },
  { key: 'origin', header: 'ORIGIN' },
  { key: 'dep', header: 'DEPARTURE DATE' },
  { key: 'dst', header: 'DESTINATION' },
  { key: 'awbDate', header: 'AWB DATE' },
];

const isMaster = (row) => row.type === 'MAWB';

const EXPORT_COLUMNS = [
  { key: 'icon', header: '', align: 'center', width: 40, cell: (row) => <FileText className={cn('tw:mx-auto tw:size-4', isMaster(row) ? 'tw:text-success' : 'tw:text-primary')} /> },
  { key: 'type', header: 'TYPE', cell: (row) => <span className={cn('tw:font-bold', isMaster(row) ? 'tw:text-success' : 'tw:text-primary')}>{row.type}</span> },
  { key: 'awb', header: 'AIR WAYBILL NUMBER', className: 'tw:font-bold' },
  ...CSV_COLUMNS.slice(2).map((column) => ({ key: column.key, header: column.header })),
];

export default function ExportData() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState(() => new Set());

  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));

  const load = async (criteria = filters) => {
    setLoading(true);
    try {
      const result = await freightApi.exportDataReport(criteria);
      if (result.success) {
        setRows(result.data || []);
        setPage(1);
        setSelected(new Set());
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAndReload = () => {
    setFilters(EMPTY_FILTERS);
    load(EMPTY_FILTERS);
  };

  const pageRows = pageSlice(rows, page, pageSize).map((row, index) => ({ ...row, rowIndex: (page - 1) * pageSize + index }));

  const toggleRow = (index) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  });
  const toggleAll = () => setSelected((current) => (current.size === rows.length ? new Set() : new Set(rows.map((row, index) => index))));

  const exportCsv = () => {
    if (selected.size === 0) {
      toast.error('Please select at least one record to export.');
      return;
    }
    const chosen = rows.filter((row, index) => selected.has(index));
    downloadCsv(`export_data_${Date.now()}.csv`, CSV_COLUMNS.map((column) => column.header), chosen.map((row) => CSV_COLUMNS.map((column) => row[column.key])));
  };

  return (
    <AirExportPage activeTab="export-data" className="tw:gap-4 tw:px-4 tw:pb-10">
      <h2 className="tw:m-0 tw:text-xl tw:font-bold tw:tracking-tight tw:text-foreground">EXPORT DATA</h2>

      <Card>
        <CardContent className="tw:grid tw:grid-cols-1 tw:gap-4 tw:p-4 tw:sm:grid-cols-3">
          <Field label="FILE TYPE" required layout="col"><SelectBox value={filters.fileType} onValueChange={setFilter('fileType')} options={FILE_TYPE_OPTIONS} /></Field>
          <Field label="FROM DATE" required layout="col"><DateInput value={filters.fromDate} onValueChange={setFilter('fromDate')} /></Field>
          <Field label="TO DATE" required layout="col"><DateInput value={filters.toDate} onValueChange={setFilter('toDate')} /></Field>
        </CardContent>
        <CardFooter className="tw:justify-end tw:gap-4 tw:bg-secondary tw:px-4 tw:py-3">
          <Button variant="ghost" onClick={clearAndReload}>CLEAR</Button>
          <Button variant="default" onClick={() => load()}><Search /> SEARCH</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardContent className="tw:gap-3 tw:p-4">
          <CardTitle className="tw:text-[15px]">SEARCH RESULTS</CardTitle>
          <PageSizeSelect value={pageSize} sizes={PAGE_SIZES} onValueChange={(size) => { setPageSize(size); setPage(1); }} />
          <DataTable
            columns={EXPORT_COLUMNS}
            rows={loading ? [] : pageRows}
            rowKey="rowIndex"
            rowClassName={(row) => selected.has(row.rowIndex) && 'tw:bg-primary/5 tw:even:bg-primary/5'}
            selection={{ keys: pageRows.map((row) => row.rowIndex).filter((key) => selected.has(key)), onToggle: toggleRow, onToggleAll: toggleAll }}
            emptyText={loading ? 'Loading data...' : 'No data available for export.'}
            containerClassName="tw:rounded-lg tw:border tw:border-border"
          />
          {rows.length > 0 ? (
            <Pager className="tw:mt-4" page={page} pageCount={pageCountOf(rows.length, pageSize)} onPageChange={setPage} summary={showingText(page, pageSize, rows.length)} />
          ) : (
            <div className="tw:mt-4 tw:text-entry tw:text-muted-foreground">{showingText(page, pageSize, 0)}</div>
          )}

          <div className="tw:mt-4 tw:flex tw:flex-wrap tw:justify-between tw:gap-3 tw:border-t tw:border-border tw:pt-4">
            <Button variant="destructive" onClick={() => setFilters(EMPTY_FILTERS)}>RESET</Button>
            <div className="tw:flex tw:gap-3">
              <Button variant="secondary" onClick={() => navigate('/freight/air-export')}>CANCEL</Button>
              <Button variant="default" onClick={exportCsv}><Download /> EXPORT CSV</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AirExportPage>
  );
}
