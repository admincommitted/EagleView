import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, DataTable } from '@/components/ui';
import StatusBadge from './StatusBadge';
import { money, TRIP_STATUS } from './fleetFormat';

const joinDot = (parts) => parts.filter(Boolean).join(' · ');
const SUB_LINE = 'tw:text-[11px] tw:font-normal tw:text-muted-foreground';
const isOpen = (trip) => !['DELIVERED', 'CANCELLED'].includes(trip.status);
const advanceWaiting = (trip) => trip.advanceToDriver > 0 && !trip.advancePosted;

/** The board's buttons for one trip, in the order they are shown. */
function tripActions(trip, { onStatus, onPostAdvance }) {
  return [
    trip.status === 'PENDING_DISPATCH' && { key: 'dispatch', label: 'Dispatch', variant: 'warning', onClick: () => onStatus(trip, 'IN_TRANSIT') },
    trip.status === 'IN_TRANSIT' && { key: 'deliver', label: 'Delivered', variant: 'success', onClick: () => onStatus(trip, 'DELIVERED') },
    advanceWaiting(trip) && { key: 'advance', label: 'Post advance', variant: 'warning', onClick: () => onPostAdvance(trip) },
    isOpen(trip) && { key: 'cancel', label: 'Cancel', variant: 'destructive', onClick: () => onStatus(trip, 'CANCELLED') },
  ].filter(Boolean);
}

function TripActions({ trip, handlers }) {
  return (
    <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-1.5">
      {tripActions(trip, handlers).map((action) => (
        <Button key={action.key} size="sm" variant={action.variant} onClick={action.onClick}>{action.label}</Button>
      ))}
      {!trip.advancePosted && trip.status !== 'DELIVERED' && (
        <Button size="icon-sm" variant="ghost" className="tw:text-destructive" title="Delete" aria-label={`Delete ${trip.lrNo}`} onClick={() => handlers.onDelete(trip)}><Trash2 /></Button>
      )}
    </div>
  );
}

function tripColumns(handlers) {
  return [
    {
      key: 'lrNo', header: 'LR No.', className: 'tw:font-bold tw:text-primary',
      cell: (trip) => (
        <>
          {trip.lrNo}
          <div className={SUB_LINE}>
            {joinDot([trip.date ? trip.date.split('-').reverse().join('-') : '', trip.jobNo && `job ${trip.jobNo}`, trip.ewayBill && `e-way ${trip.ewayBill}`])}
          </div>
        </>
      ),
    },
    {
      key: 'vehicle', header: 'Vehicle & Driver',
      cell: (trip) => (
        <>
          <div className="tw:font-bold">{trip.vehicleNo || <span className="tw:text-warning">no vehicle yet</span>}</div>
          <div className={SUB_LINE}>{joinDot([trip.driverName ? `Driver: ${trip.driverName}` : 'Driver not assigned', trip.driverPhone])}</div>
        </>
      ),
    },
    {
      key: 'route', header: 'Route', className: 'tw:whitespace-normal',
      cell: (trip) => (
        <>
          {[trip.origin, trip.destination].filter(Boolean).join(' → ') || '—'}
          <div className={SUB_LINE}>
            {joinDot([
              trip.distanceKm && `${Number(trip.distanceKm)} km`,
              trip.commodity,
              trip.chargedWeight && `${Number(trip.chargedWeight)} t`,
              trip.freightBasis && trip.freightRate && `${trip.freightBasis} @ ${Number(trip.freightRate)}`,
            ])}
          </div>
        </>
      ),
    },
    { key: 'freight', header: 'Total Freight', align: 'right', cell: (trip) => money(trip.freightAmount) },
    {
      key: 'advance', header: 'Advance Paid', align: 'right', className: 'tw:text-destructive',
      cell: (trip) => (
        <>
          {money(trip.advanceToDriver)}
          {trip.advanceToDriver > 0 && (
            <div className={cn('tw:text-[11px] tw:font-semibold', trip.advancePosted ? 'tw:text-success' : 'tw:text-warning')}>
              {trip.advancePosted ? 'posted to ledger' : 'not posted'}
            </div>
          )}
          {trip.balance ? <div className={SUB_LINE}>balance {money(trip.balance)}</div> : null}
        </>
      ),
    },
    {
      key: 'status', header: 'Trip Status', align: 'center',
      cell: (trip) => (
        <>
          <StatusBadge status={trip.status} tones={TRIP_STATUS} fallback={{ variant: 'info' }} />
          {trip.podReceived && <div className="tw:mt-0.5 tw:text-[10px] tw:text-success">POD received</div>}
        </>
      ),
    },
    { key: 'action', header: 'Action', align: 'center', cell: (trip) => <TripActions trip={trip} handlers={handlers} /> },
  ];
}

export function TripBoardTable({ trips, loading, filtered, handlers }) {
  const emptyText = filtered ? 'No trip matches that.' : 'No lorry receipt yet. Use "New Trip / Lorry Receipt" to raise the first one.';
  return (
    <DataTable columns={tripColumns(handlers)} rows={trips} emptyText={loading ? 'Loading trips...' : emptyText} className="tw:text-entry" />
  );
}
