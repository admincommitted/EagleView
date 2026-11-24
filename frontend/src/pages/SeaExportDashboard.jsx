import React from 'react';
import FreightDashboard from '../components/Freight/FreightDashboard';

// 30-Oct-2026: this page listed three invented shipments ("MSCU123456789 on MSC REEF V.34") with
// hardcoded KPI numbers (45 FCL / 12 LCL / 5 pending VGM / 18 on board), and its buttons - New
// Booking, Generate MBL / HBL, Submit VGM, Manifest / AMS, View - did nothing. It now shares
// components/Freight/FreightDashboard and reads the real export jobs from /api/freight.
export default function SeaExportDashboard() {
    return (
        <FreightDashboard
            kind="sea-export"
            icon="ship"
            accent="#0d9488"
            title="Ocean Export Dashboard"
            subtitle="Bookings, B/L issue, VGM and manifest records - from the real export jobs"
            newJobPath="/export-entry"
            kpiCards={[
                { key: 'total', label: 'Sea export jobs', colour: '#0d9488' },
                { key: 'booked', label: 'Booking confirmed', colour: '#2dd4bf' },
                { key: 'blIssued', label: 'B/L issued', colour: '#0ea5e9' },
                { key: 'pendingVgm', label: 'VGM not recorded', colour: '#f59e0b', strong: '#b45309' },
                { key: 'sailed', label: 'Sailed / shipped', colour: '#10b981', strong: '#047857' },
            ]}
            actions={[
                { type: 'BOOKING', label: 'Confirm booking' },
                { type: 'MBL', label: 'Record MBL issue' },
                { type: 'HBL', label: 'Record HBL issue' },
                { type: 'VGM', label: 'Record VGM submission' },
                { type: 'MANIFEST', label: 'Record manifest / AMS' },
            ]}
        />
    );
}
