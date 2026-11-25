import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Truck } from 'lucide-react';
import { askConfirm } from '../components/common/askConfirm';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Input, SelectBox } from '@/components/ui';
import AdvancedLRForm from './AdvancedLRForm';
import { fleetApi, fleetMastersOrEmpty } from './PurchaseParts/fleetApi';
import Notice from './PurchaseParts/Notice';
import PageHeader from './PurchaseParts/PageHeader';
import PostAdvancePanel from './PurchaseParts/PostAdvancePanel';
import { TripBoardTable } from './PurchaseParts/fleetTrips';
import { money, TRIP_STATUS, tripStatusLabel } from './PurchaseParts/fleetFormat';

const BLANK_LEDGERS = { voucherTypeId: '', debitLedgerId: '', creditLedgerId: '' };

const totalsText = (totals) => {
  if (!totals) return '';
  const notPosted = totals.advancesNotPosted ? ` · ${totals.advancesNotPosted} advance(s) not yet posted to the ledger` : '';
  return `Freight ${money(totals.freight)} · advances ${money(totals.advance)}${notPosted}`;
};

export default function FleetManagement() {
  const [trips, setTrips] = useState([]);
  const [counts, setCounts] = useState({});
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [masters, setMasters] = useState({ ledgers: [], paymentVoucherTypes: [] });
  const [advanceFor, setAdvanceFor] = useState(null);
  const [advanceLedgers, setAdvanceLedgers] = useState(BLANK_LEDGERS);
  const [posting, setPosting] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const filters = { ...(search && { q: search }), ...(statusFilter && { status: statusFilter }) };
      const [board, fleetMasters] = await Promise.all([fleetApi.lorryReceipts(filters), fleetMastersOrEmpty()]);
      setTrips(board.data || []);
      setCounts(board.counts || {});
      setTotals(board.totals || null);
      const paymentVoucherTypes = fleetMasters.paymentVoucherTypes || [];
      setMasters({ ledgers: fleetMasters.ledgers || [], paymentVoucherTypes });
      if (paymentVoucherTypes.length) {
        setAdvanceLedgers((current) => (current.voucherTypeId ? current : { ...current, voucherTypeId: paymentVoucherTypes[0].id }));
      }
    } catch (error) {
      setTrips([]);
      setTotals(null);
      setLoadError(errorMessage(error));
    }
    setLoading(false);
  }, [search, statusFilter]);
  useEffect(() => { loadTrips(); }, [loadTrips]);

  const setTripStatus = async (trip, status) => {
    try {
      await fleetApi.updateLorryReceipt(trip.id, { status, ...(status === 'DELIVERED' && { podReceived: true }) });
      toast.success(`${trip.lrNo} → ${tripStatusLabel(status)}`);
      await loadTrips();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const postAdvance = async () => {
    setPosting(true);
    try {
      const reply = await fleetApi.postDriverAdvance(advanceFor.id, advanceLedgers);
      toast.success(reply.note || 'Advance posted');
      setAdvanceFor(null);
      await loadTrips();
    } catch (error) {
      toast.error(`Not posted: ${errorMessage(error)}`);
    }
    setPosting(false);
  };

  const deleteTrip = async (trip) => {
    if (!(await askConfirm({ title: 'Delete lorry receipt', message: `Delete lorry receipt ${trip.lrNo}?`, okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await fleetApi.deleteLorryReceipt(trip.id);
      toast.success('Deleted');
      await loadTrips();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const statusOptions = Object.entries(TRIP_STATUS).map(([status, { label }]) => ({ value: status, label: `${label}${counts[status] ? ` (${counts[status]})` : ''}` }));

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[1400px] tw:flex-col tw:gap-5 tw:p-3 tw:md:p-6">
      <PageHeader
        icon={Truck}
        title="Fleet & Transport Management (TMS)"
        subtitle="Trip sheets, Lorry Receipts, Driver Advances & Vehicle Profitability"
        actions={<Button variant="default" size="lg" onClick={() => setShowNewTrip(!showNewTrip)}>{showNewTrip ? 'Close Form' : 'New Trip / Lorry Receipt'}</Button>}
      />

      {showNewTrip && (
        <AdvancedLRForm onClose={() => setShowNewTrip(false)} onSaved={async () => { setShowNewTrip(false); await loadTrips(); }} />
      )}

      {loadError && <Notice tone="danger">{loadError}</Notice>}

      {advanceFor && (
        <PostAdvancePanel trip={advanceFor} masters={masters} ledgers={advanceLedgers} onLedgersChange={setAdvanceLedgers}
          posting={posting} onPost={postAdvance} onCancel={() => setAdvanceFor(null)} />
      )}

      <Card className="tw:overflow-hidden">
        <CardHeader className="tw:flex-col tw:items-stretch tw:border-b tw:border-border tw:py-4 tw:lg:flex-row tw:lg:items-center">
          <div>
            <CardTitle className="tw:text-sm">Dispatch Board</CardTitle>
            <CardDescription className="tw:mt-1">{totalsText(totals)}</CardDescription>
          </div>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Input leftIcon={Search} data-allow-text="" className="tw:w-full tw:sm:w-[220px]" placeholder="LR / vehicle / driver / route"
              value={search} onChange={(event) => setSearch(event.target.value)} />
            <SelectBox className="tw:w-full tw:sm:w-44" placeholder="All statuses" clearable clearLabel="All statuses"
              value={statusFilter} onValueChange={setStatusFilter} options={statusOptions} />
            <Badge variant="info" className="tw:text-[11px]">{counts.IN_TRANSIT || 0} in transit</Badge>
          </div>
        </CardHeader>
        <TripBoardTable trips={trips} loading={loading} filtered={Boolean(search || statusFilter)}
          handlers={{ onStatus: setTripStatus, onPostAdvance: setAdvanceFor, onDelete: deleteTrip }} />
        <div className="tw:border-t tw:border-border tw:bg-page tw:px-5 tw:py-2.5 tw:text-[11px] tw:text-muted-foreground">
          Freight is computed from the rate and its basis (per ton x weight, per km x distance, or flat).
          An advance shows as posted only when a payment voucher was actually written for it.
        </div>
      </Card>
    </div>
  );
}
