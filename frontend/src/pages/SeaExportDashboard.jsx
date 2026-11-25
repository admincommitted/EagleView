import FreightDashboard from '../components/Freight/FreightDashboard';

const KPI_CARDS = [
  { key: 'total', label: 'Sea export jobs', colour: '#0d9488' },
  { key: 'booked', label: 'Booking confirmed', colour: '#2dd4bf' },
  { key: 'blIssued', label: 'B/L issued', colour: '#0ea5e9' },
  { key: 'pendingVgm', label: 'VGM not recorded', colour: '#f59e0b', strong: '#b45309' },
  { key: 'sailed', label: 'Sailed / shipped', colour: '#10b981', strong: '#047857' },
];

const ACTIONS = [
  { type: 'BOOKING', label: 'Confirm booking' },
  { type: 'MBL', label: 'Record MBL issue' },
  { type: 'HBL', label: 'Record HBL issue' },
  { type: 'VGM', label: 'Record VGM submission' },
  { type: 'MANIFEST', label: 'Record manifest / AMS' },
];

export default function SeaExportDashboard() {
  return (
    <FreightDashboard
      kind="sea-export"
      icon="ship"
      accent="#0d9488"
      title="Ocean Export Dashboard"
      subtitle="Bookings, B/L issue, VGM and manifest records - from the real export jobs"
      newJobPath="/export-entry"
      kpiCards={KPI_CARDS}
      actions={ACTIONS}
    />
  );
}
