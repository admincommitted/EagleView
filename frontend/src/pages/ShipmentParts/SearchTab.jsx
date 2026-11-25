import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge, Button, DateInput, Input, SelectBox } from '@/components/ui';
import { toDisplayDate } from '@/lib/dates';
import { FormGrid, GridField, GridPanel, Panel, StatusMessage } from './layout';
import { shipmentApi } from './shipmentApi';
import { fyStartIso, OPTIONS, stageVariant, todayIso } from './shipmentForm';

const LIST_LIMIT = 500;
const STATUS_FILTERS = [
  { value: 'all', label: 'ALL' },
  { value: 'some', label: 'Status updated, not complete' },
  { value: 'none', label: 'No Status Updated' },
];

const keepsRow = (row, statusFilter) => {
  if (statusFilter === 'none') return !row.currentStatus;
  if (statusFilter === 'some') return Boolean(row.currentStatus) && row.stage !== 'Complete';
  return true;
};

const nonEmpty = (filters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value));

function searchColumns(isImport, labels) {
  const text = (key, header, extra) => ({ key, header, ...extra });
  const date = (key, header, pick = (row) => row[key]) => ({ key, header, cell: (row) => toDisplayDate(pick(row)) });
  return [
    date('docketDate', 'Docket Date'),
    { key: 'docketNo', header: 'Docket No', cell: (row) => <b className="tw:text-head">{row.docketNo}</b> },
    text('ediJobNo', 'EDI Job No'),
    { key: 'billNo', header: isImport ? 'BE No' : 'SB No', cell: (row) => (isImport ? row.beNo : row.sbNo) || '' },
    date('billDate', isImport ? 'BE Date' : 'SB Date', (row) => (isImport ? row.beDate : row.sbDate)),
    text('mainParty', labels.main),
    text('otherParty', labels.other),
    text('pkgs', 'No Of Pkgs', { align: 'right' }),
    text('grossWeight', 'Gross Weight', { align: 'right' }),
    text('overseasAgent', 'Over Seas Agent'),
    text('subAgent', 'Sub Agent'),
    text('houseType', 'Type'),
    { key: 'stage', header: 'Status', cell: (row) => <Badge variant={stageVariant(row.stage)}>{row.stage || 'Register'}</Badge> },
    text('currentStatus', 'Current Status'),
    text('jobType', 'Job Type'),
    text('hawbNo', labels.house + ' No'),
    date('hawbDate', labels.house + ' Date'),
    text('mawbNo', labels.master + ' No'),
    date('mawbDate', labels.master + ' Date'),
    text('chargeableWeight', 'Chargeable Weight', { align: 'right' }),
    text('originPort', 'Origin Port'),
    text('destinationPort', 'Destination'),
    text('dischargePort', 'Discharge Port'),
    text('clearanceAt', 'Clearance At'),
    text('docketOwner', 'Docket Owner'),
    { key: 'remarks', header: 'Remark', cell: (row) => <span title={row.remarks || ''} className="tw:inline-block tw:max-w-[280px] tw:truncate tw:align-top">{row.remarks || ''}</span> },
    text('shipmentTerm', 'Shipment Term'),
    text('createdBy', 'Entered By'),
    date('createdAt', 'Entered Date'),
    text('modifiedBy', 'Modified By'),
    { key: 'updatedAt', header: 'Modify Date', cell: (row) => (row.modifiedBy ? toDisplayDate(row.updatedAt) : '') },
  ];
}

export default function SearchTab({ division, divisionInfo, isImport, labels, branch, onOpen }) {
  const [filters, setFilters] = useState({
    from: fyStartIso(), to: todayIso(), stage: '', ediJobNo: '', docketNo: '', mainParty: '', subAgent: '', otherParty: '', overseasAgent: '',
    originPort: '', destinationPort: '', referenceNo: '', mawbNo: '', hawbNo: '', docketOwner: '', createdBy: '', poNo: '',
  });
  const [rows, setRows] = useState(null);
  const [problem, setProblem] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const run = async () => {
    setProblem('');
    try {
      setRows(await shipmentApi.list({ division, branch, ...nonEmpty(filters) }));
    } catch (error) {
      setProblem(error.message);
      setRows([]);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searches by itself only when the division changes
  useEffect(() => { run(); }, [division]);

  const setFilter = (key) => (value) => setFilters({ ...filters, [key]: value });
  const textFilters = [
    ['docketNo', 'Docket No'], ['mainParty', labels.main], ['subAgent', 'Sub Agt'], ['otherParty', labels.other], ['overseasAgent', 'OverSeas Agt'],
    ['originPort', 'Origin Port'], ['destinationPort', 'Dstn Port'], ['referenceNo', 'Reference No.'], ['mawbNo', labels.master + ' No.'],
    ['hawbNo', labels.house + ' No'], ['docketOwner', 'Docket Owner'], ['createdBy', 'Entered By'], ['poNo', 'Po No.'],
  ];
  const shown = (rows || []).filter((row) => keepsRow(row, statusFilter));
  const tooMany = (rows || []).length >= LIST_LIMIT ? ' - only the latest 500; narrow the dates or filters' : '';

  return (
    <>
      <Panel title="Search">
        <FormGrid columns={8}>
          <GridField label="From"><DateInput value={filters.from} onValueChange={setFilter('from')} /></GridField>
          <GridField label="To"><DateInput value={filters.to} onValueChange={setFilter('to')} /></GridField>
          <GridField label="Operation Type">
            <SelectBox clearable clearLabel="Select" placeholder="Select" value={filters.stage} onValueChange={setFilter('stage')} options={OPTIONS.searchStage} />
          </GridField>
          <GridField label="EDI Job No"><Input value={filters.ediJobNo} onChange={(event) => setFilter('ediJobNo')(event.target.value)} /></GridField>
          {textFilters.map(([key, label]) => (
            <GridField key={key} label={label}>
              <Input value={filters[key]} onChange={(event) => setFilter(key)(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && run()} />
            </GridField>
          ))}
          <Button variant="default" onClick={run}><Search /> Search</Button>
        </FormGrid>
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <Button key={filter.value} size="sm" variant={statusFilter === filter.value ? 'default' : 'ghost'} onClick={() => setStatusFilter(filter.value)}>{filter.label}</Button>
          ))}
        </div>
        <StatusMessage message={problem && { tone: 'error', text: problem }} />
      </Panel>
      <GridPanel
        title={`${divisionInfo.label} Shipments (${shown.length})${tooMany}`}
        heightClassName="tw:min-h-[200px] tw:max-h-[460px]"
        columns={searchColumns(isImport, labels)}
        rows={shown}
        onRowClick={onOpen}
        emptyText={rows ? 'No docket for this search' : 'Loading'}
      />
    </>
  );
}
