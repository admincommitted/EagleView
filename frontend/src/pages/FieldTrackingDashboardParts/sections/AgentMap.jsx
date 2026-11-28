import { useEffect } from 'react';
import L from 'leaflet';
import { Battery } from 'lucide-react';
import { LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { statusMarkerColor } from '../agentStatus';

const MAP_CENTER = [28.60, 77.20];

const BASE_LAYERS = [
  { name: '🗺️ Street View', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', maxZoom: 19, checked: true },
  { name: '🛰️ Satellite View', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri &mdash; Source: Esri, USDA, USGS', maxZoom: 19 },
  { name: '🌙 Dark Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19 },
  { name: '⬜ Light Clean', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19 },
  { name: '🏔️ Terrain View', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'Map data: &copy; OpenStreetMap contributors', maxZoom: 17 },
];

const ROLE_EMOJI = { 'fleet driver': '🚚', 'doc collection': '🛵', 'customs clerk': '📋', 'airport runner': '✈️' };

// Leaflet draws the marker from an HTML string, so its look is written as inline CSS here
function agentIcon(agent, isSelected) {
  const color = statusMarkerColor(agent.status);
  const vehicleEmoji = ROLE_EMOJI[agent.role?.toLowerCase()] || '👤';
  return new L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); width: 150px;">
              <div style="background:${isSelected ? '#0f172a' : '#ffffff'}; color:${isSelected ? '#ffffff' : '#0f172a'}; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:700; white-space:nowrap; border:${isSelected ? 'none' : '1px solid #cbd5e1'}; margin-bottom:4px; z-index:${isSelected ? '100' : '10'}; pointer-events: auto;">
                  ${agent.name}
              </div>
              <div style="width:28px; height:28px; background:${color}; border-radius:50%; border:3px solid white; z-index:${isSelected ? '100' : '10'}; position:relative; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                 ${vehicleEmoji}
                 ${isSelected ? '<div style="position:absolute; inset:-8px; background:rgba(14,165,233,0.4); border-radius:50%; animation:ping 1.5s infinite"></div>' : ''}
              </div>
           </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function FlyToAgent({ agent }) {
  const map = useMap();
  useEffect(() => {
    if (agent?.lat) map.flyTo([agent.lat, agent.lng], 14, { duration: 1.5 });
  }, [agent, map]);
  return null;
}

export default function AgentMap({ agents, selectedAgent, locationHistory, onSelect }) {
  return (
    <div className="tw:relative tw:z-[1] tw:min-h-[320px] tw:flex-1">
      <MapContainer center={MAP_CENTER} zoom={11} zoomControl scrollWheelZoom attributionControl={false} className="tw:h-full tw:w-full">
        <LayersControl position="topright">
          {BASE_LAYERS.map((layer) => (
            <LayersControl.BaseLayer key={layer.name} checked={layer.checked} name={layer.name}>
              <TileLayer url={layer.url} attribution={layer.attribution} maxZoom={layer.maxZoom} />
            </LayersControl.BaseLayer>
          ))}
        </LayersControl>

        <FlyToAgent agent={selectedAgent} />

        {locationHistory.length > 1 && (
          <Polyline positions={locationHistory.map((point) => [point.lat, point.lng])} color="#0ea5e9" weight={3} opacity={0.7} dashArray="6" />
        )}

        {agents.filter((agent) => agent.status !== 'Offline' && agent.lat).map((agent) => (
          <Marker key={agent.id} position={[agent.lat, agent.lng]} icon={agentIcon(agent, selectedAgent?.id === agent.id)} eventHandlers={{ click: () => onSelect(agent) }}>
            <Popup>
              <div>
                <div className="tw:mb-1 tw:text-[14px] tw:font-bold">{agent.name}</div>
                <div className="tw:text-entry tw:text-muted-foreground">{agent.role}</div>
                <div className="tw:mt-2 tw:flex tw:items-center tw:gap-1 tw:text-entry"><Battery className="tw:size-3" /> {agent.battery}% | {agent.speed}</div>
                <div className="tw:mt-1 tw:text-[11px] tw:text-muted-foreground">📍 {agent.location}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="tw:pointer-events-none tw:absolute tw:right-5 tw:bottom-[30px] tw:z-[1000]">
        <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:bg-background tw:px-4 tw:py-2 tw:text-[13px] tw:font-bold">
          <span className="tw:size-2 tw:animate-[ping_2s_infinite] tw:rounded-full tw:bg-success tw:ring-[3px] tw:ring-success/15" />
          Live Fleet Tracking
        </div>
      </div>
    </div>
  );
}
