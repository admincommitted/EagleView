import FreightDashboard from '../components/Freight/FreightDashboard';

const KPI_CARDS = [
  { key: 'total', label: 'Sea import jobs', colour: '#0284c7' },
  { key: 'arrivingNoBe', label: 'No BE filed yet', colour: '#38bdf8', hint: 'not yet cleared' },
  { key: 'pendingDo', label: 'Pending D.O. release', colour: '#f59e0b', strong: '#b45309' },
  { key: 'customsHold', label: 'Query / customs hold', colour: '#ef4444', strong: '#b91c1c' },
  { key: 'igmNotRecorded', label: 'IGM not recorded', colour: '#8b5cf6', strong: '#6d28d9' },
];

const ACTIONS = [
  { type: 'CONSOLE', label: 'Register import console' },
  { type: 'IGM', label: 'Record IGM filing' },
  { type: 'DO', label: 'Issue Delivery Order (D.O.)' },
  { type: 'DESTUFF', label: 'De-stuffing / CFS' },
];

export default function SeaImportDashboard() {
  return (
    <FreightDashboard
      kind="sea-import"
      icon="anchor"
      accent="#0284c7"
      title="Ocean Import Dashboard"
      subtitle="Incoming cargo, IGM record, Delivery Orders and customs status - from the real import jobs"
      newJobPath="/job-entry"
      kpiCards={KPI_CARDS}
      actions={ACTIONS}
    />
  );
}
