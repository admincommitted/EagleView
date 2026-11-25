import { useEffect, useState } from 'react';
import { CheckCircle, CheckCircle2, FileText, HelpCircle, Info, Mail, Phone, Plane, X, XCircle } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Card, CardContent, CardHeader, CardTitle, DataTable, StatCard } from '@/components/ui';
import SftpStatusBadge from '../common/SftpStatusBadge';
import AirExportInsights from './AirExportInsights';
import { freightApi } from './freightApi';
import { MILESTONES, pageCountOf, pageSlice, showingText, stageLabel, useOpenAwb } from './AirExportParts/airExport';
import { AirExportPage, DocTypeBadge, Milestone, PageSizeSelect, Pager } from './AirExportParts/widgets';

const AWB_LIST_LIMIT = 1000;
const PAGE_SIZES = [5, 10, 25, 50];
const SPIN_AFTER_REFRESH_MS = 500;

const STAT_TILES = [
  { stage: 'SAVED', label: 'Saved not submitted', icon: FileText, tone: 'primary', count: 'saved' },
  { stage: 'SUBMITTED', label: 'Submitted and pending RCS', icon: Plane, tone: 'warning', count: 'submitted' },
  { stage: 'REJECTED', label: 'Rejected', icon: XCircle, tone: 'danger', count: 'rejected' },
  { stage: 'READY_FOR_CARRIAGE', label: 'Ready for carriage', icon: CheckCircle, tone: 'success', count: 'ready' },
];

const EMPTY_COUNTS = { saved: 0, submitted: 0, rejected: 0, ready: 0 };

const toBoardRow = (awb) => ({
  ...Object.fromEntries(MILESTONES.map((milestone) => [milestone, awb[milestone]])),
  id: awb.id,
  docType: awb.type,
  awb: awb.awbNumber || '',
  hawb: awb.type === 'HAWB' ? (awb.hawbNumber || '') : '',
  stage: awb.stage || 'SAVED',
  submitted: Boolean(awb.submittedToAirline),
  shipper: awb.shipperName || '-',
  consignee: awb.consigneeName || '-',
});

function useAwbBoard() {
  const [airlines, setAirlines] = useState([]);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [refreshing, setRefreshing] = useState(false);

  const loadAirlines = async () => {
    try {
      const list = await freightApi.airlineMaster();
      setAirlines(Array.isArray(list) ? list : []);
    } catch {
      // airline names then come from the built-in airline list
    }
  };

  const loadAwbs = async () => {
    try {
      const data = await freightApi.awbList(AWB_LIST_LIMIT);
      setRows(data.success && Array.isArray(data.data) ? data.data.map(toBoardRow) : []);
      const kpi = data.kpi || {};
      setCounts({
        saved: kpi.savedNotSubmitted ?? 0,
        submitted: kpi.submittedPendingRcs ?? 0,
        rejected: kpi.rejected ?? 0,
        ready: kpi.readyForCarriage ?? 0,
      });
    } catch (error) {
      console.error('Failed to fetch AWBs:', errorMessage(error));
    }
  };

  const load = async () => {
    await loadAirlines();
    await loadAwbs();
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), SPIN_AFTER_REFRESH_MS);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { airlines, rows, counts, refreshing, refresh };
}

const boardColumns = () => [
  { key: 'docType', header: 'Document Type', align: 'center', cell: (row) => <span title={stageLabel(row.stage)}><DocTypeBadge type={row.docType} /></span> },
  { key: 'awb', header: 'AWB/Master AWB Number' },
  { key: 'hawb', header: 'House Waybill Number' },
  { key: 'saved', header: 'Saved', align: 'center', cell: () => <CheckCircle2 className="tw:mx-auto tw:size-4.5 tw:text-primary" /> },
  { key: 'submitted', header: 'Submitted to Airline', align: 'center', cell: (row) => row.submitted && <CheckCircle2 className="tw:mx-auto tw:size-4.5 tw:text-success" /> },
  ...MILESTONES.map((milestone) => ({
    key: milestone,
    header: milestone.toUpperCase(),
    align: 'center',
    cell: (row) => <Milestone value={row[milestone]} rejected={milestone === 'fna'} />,
  })),
  { key: 'shipper', header: 'Exporter Name', className: 'tw:min-w-[150px]' },
  { key: 'consignee', header: 'Consignee Name', className: 'tw:min-w-[150px]' },
];

function RecentTransactions({ rows, stageFilter, onClearStage, page, onPageChange }) {
  const openAwb = useOpenAwb();
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const visibleRows = stageFilter ? rows.filter((row) => row.stage === stageFilter) : rows;
  const pageCount = pageCountOf(visibleRows.length, pageSize);

  const openRow = (row) => openAwb(row.docType, row.docType === 'HAWB' ? row.hawb : row.awb);

  return (
    <Card className="tw:flex-1">
      <CardHeader className="tw:border-b tw:border-border tw:py-3">
        <CardTitle className="tw:uppercase">Recent Transactions Status</CardTitle>
        <SftpStatusBadge />
      </CardHeader>
      <CardContent className="tw:gap-3 tw:pt-3">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:font-bold">
          <PageSizeSelect value={pageSize} sizes={PAGE_SIZES} onValueChange={(size) => { setPageSize(size); onPageChange(1); }} />
          {stageFilter && (
            <Button size="sm" variant="default" className="tw:rounded-full" onClick={onClearStage}>
              {stageLabel(stageFilter)} <X />
            </Button>
          )}
          <span className="tw:ml-auto tw:font-normal tw:normal-case tw:text-muted-foreground">Double-click a row to open it</span>
        </div>
        <DataTable
          columns={boardColumns()}
          rows={pageSlice(visibleRows, page, pageSize)}
          rowKey={(row) => row.docType + row.id}
          onRowDoubleClick={openRow}
          emptyText="No AWB yet"
          containerClassName="tw:min-h-[220px] tw:rounded tw:border tw:border-border"
        />
        <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} summary={showingText(page, pageSize, visibleRows.length)} />
      </CardContent>
    </Card>
  );
}

const SUPPORT_CONTACTS = [
  { icon: Phone, text: '+91 9654997939' },
  { icon: Mail, text: 'admin@committedcargo.com' },
];

function SupportFooter() {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:bg-linear-to-br tw:from-head tw:to-primary tw:px-6 tw:py-4 tw:text-primary-foreground tw:shadow-md tw:md:flex-row tw:md:items-center tw:md:justify-between">
      <div className="tw:flex tw:items-center tw:gap-3">
        <div className="tw:flex tw:rounded-lg tw:bg-white/20 tw:p-2.5"><HelpCircle className="tw:size-5.5" /></div>
        <div>
          <div className="tw:text-sm tw:font-extrabold tw:tracking-wide tw:uppercase">IT & Operations Support</div>
          <div className="tw:mt-0.5 tw:text-[11px] tw:text-primary-foreground/80">24/7 dedicated assistance for your EDI workflows</div>
        </div>
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        {SUPPORT_CONTACTS.map((contact) => (
          <div key={contact.text} className="tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-white/30 tw:bg-white/15 tw:px-4 tw:py-2">
            <contact.icon className="tw:size-3.5" />
            <span className="tw:text-[13px] tw:font-bold tw:tracking-wide">{contact.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AirExportDashboard() {
  const { airlines, rows, counts, refreshing, refresh } = useAwbBoard();
  const [stageFilter, setStageFilter] = useState('');
  const [page, setPage] = useState(1);

  const pickStage = (stage) => {
    setStageFilter((current) => (current === stage ? '' : stage));
    setPage(1);
  };

  return (
    <AirExportPage activeTab="dashboard" className="tw:gap-4 tw:py-4">
      <div className="tw:flex tw:w-fit tw:max-w-full tw:items-center tw:gap-3 tw:rounded-md tw:border tw:border-primary/30 tw:border-l-4 tw:border-l-primary tw:bg-linear-to-r tw:from-primary/10 tw:to-card tw:px-5 tw:py-3 tw:text-[13px] tw:font-bold tw:tracking-wide tw:text-head tw:uppercase">
        <div className="tw:flex tw:rounded-full tw:bg-primary/15 tw:p-1.5"><Info className="tw:size-4.5 tw:text-primary" /></div>
        <span>You can use EagleView 360 to send e-AWBs, and also you can generate laser-printed/plain paper AWBs.</span>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:xl:grid-cols-4">
        {STAT_TILES.map((tile) => (
          <StatCard
            key={tile.stage}
            label={tile.label}
            value={counts[tile.count]}
            icon={tile.icon}
            tone={tile.tone}
            title="Click to show only these in the table"
            active={stageFilter === tile.stage}
            onClick={() => pickStage(tile.stage)}
            onRefresh={refreshing ? undefined : refresh}
            className="tw:min-h-[120px]"
          />
        ))}
      </div>

      <AirExportInsights airlines={airlines} />

      <RecentTransactions rows={rows} stageFilter={stageFilter} onClearStage={() => pickStage(stageFilter)} page={page} onPageChange={setPage} />

      <SupportFooter />
    </AirExportPage>
  );
}
