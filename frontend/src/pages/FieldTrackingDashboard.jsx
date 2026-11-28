import 'leaflet/dist/leaflet.css';
import useFieldTracking from './FieldTrackingDashboardParts/useFieldTracking';
import DashboardHeader from './FieldTrackingDashboardParts/sections/DashboardHeader';
import AgentSidebar from './FieldTrackingDashboardParts/sections/AgentSidebar';
import AgentMap from './FieldTrackingDashboardParts/sections/AgentMap';
import SelectedAgentPanel from './FieldTrackingDashboardParts/sections/SelectedAgentPanel';
import DashboardWindows from './FieldTrackingDashboardParts/sections/DashboardWindows';

// Leaflet markers are HTML strings, so the marker pulse and the map size are plain CSS, present while the screen is open
const MAP_CSS = `
  @keyframes ping {
    0% { transform: scale(0.5); opacity: 1; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  .leaflet-marker-icon { transition: transform 3s linear !important; }
  .leaflet-container { width: 100%; height: 100%; background: #e2e8f0; z-index: 1; }
  .leaflet-control-container .leaflet-top { z-index: 999; }
  .custom-leaflet-icon { background: transparent; border: none; }
`;

export default function FieldTrackingDashboard() {
  const dashboard = useFieldTracking();
  const { selectedAgent, setSelectedAgent, setOpenWindow } = dashboard;

  return (
    <div className="tw:mx-auto tw:flex tw:flex-col tw:p-3 tw:lg:h-[calc(100vh-140px)] tw:lg:overflow-hidden">
      <style>{MAP_CSS}</style>
      <DashboardHeader agents={dashboard.agents} loading={dashboard.loading} onRefresh={dashboard.fetchAgents} onOpenWindow={setOpenWindow} />

      <div className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[260px_1fr]">
        <AgentSidebar
          loading={dashboard.loading}
          agents={dashboard.filteredAgents}
          selectedAgent={selectedAgent}
          searchQuery={dashboard.searchQuery}
          onSearch={dashboard.setSearchQuery}
          onSelect={setSelectedAgent}
          onAddAgent={() => setOpenWindow('addAgent')}
        />
        <div className="tw:relative tw:flex tw:min-h-[420px] tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-border tw:bg-card">
          <AgentMap agents={dashboard.agents} selectedAgent={selectedAgent} locationHistory={dashboard.locationHistory} onSelect={setSelectedAgent} />
          {selectedAgent && (
            <SelectedAgentPanel
              agent={selectedAgent}
              isReplaying={dashboard.isReplaying}
              onHistory={dashboard.handleViewHistory}
              onReplay={dashboard.handleRouteReplay}
              onAssignTask={() => setOpenWindow('task')}
              onMarkDone={dashboard.markTaskDone}
              onSiren={() => setOpenWindow('siren')}
            />
          )}
        </div>
      </div>

      <DashboardWindows dashboard={dashboard} />
    </div>
  );
}
