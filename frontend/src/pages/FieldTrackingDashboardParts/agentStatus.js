export function formatLastSeen(lastSeen) {
  if (!lastSeen) return '—';
  const minutes = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} mins ago`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} hours ago`;
  return `${Math.floor(minutes / 1440)} days ago`;
}

const isMoving = (status) => status === 'In Transit' || status === 'Active';

// colour of the map marker (drawn as Leaflet HTML, so a real colour value)
export const statusMarkerColor = (status) => (isMoving(status) ? '#10b981' : status === 'Idle' ? '#f59e0b' : '#94a3b8');

export const statusTextClass = (status) => (isMoving(status) ? 'tw:text-success' : status === 'Idle' ? 'tw:text-warning' : 'tw:text-muted-foreground');
export const statusBadgeClass = (status) => (isMoving(status) ? 'tw:bg-success/15' : status === 'Idle' ? 'tw:bg-warning/15' : 'tw:bg-muted');
export const statusDotClass = (status) => (isMoving(status) ? 'tw:bg-success' : status === 'Idle' ? 'tw:bg-warning' : 'tw:bg-muted-foreground');

export const batteryTextClass = (level) => (level > 50 ? 'tw:text-success' : level > 20 ? 'tw:text-warning' : 'tw:text-destructive');

export const fromServerAgent = (agent) => ({
  ...agent,
  lat: agent.currentLat,
  lng: agent.currentLng,
  location: agent.currentLocation,
  battery: agent.battery ?? 100,
  speed: agent.speed ?? '0 km/h',
  task: agent.currentTask ?? 'None',
  lastSeen: agent.lastSeenText ?? formatLastSeen(agent.lastSeen),
});
