import 'leaflet/dist/leaflet.css';
import React from 'react';
import useFieldTrackingDashboard from './FieldTrackingDashboardParts/useFieldTrackingDashboard';
import FieldOperationsSection from './FieldTrackingDashboardParts/sections/FieldOperationsSection';
import LocationHistorySection from './FieldTrackingDashboardParts/sections/LocationHistorySection';

// FieldTrackingDashboard: state/logic in ./FieldTrackingDashboardParts/use*.jsx, screen sections in ./FieldTrackingDashboardParts/sections/.
export default function FieldTrackingDashboard() {
  const ctx = {};
  Object.assign(ctx, useFieldTrackingDashboard(ctx));
  return <div style={{ padding: '12px', margin: '0 auto', fontFamily: 'Inter, sans-serif', height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>

            <FieldOperationsSection ctx={ctx} />
            <LocationHistorySection ctx={ctx} />

        </div>;
}
