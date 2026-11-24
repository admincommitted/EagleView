import React from 'react';
import FreightDashboard from '../components/Freight/FreightDashboard';

// 30-Oct-2026: this page listed three invented shipments ("176-99887766 on EK 512 from Frankfurt")
// with hardcoded KPI numbers, and its buttons - Register Arrival (MAWB), Send CAN, Issue D.O., View -
// did nothing. It now shares components/Freight/FreightDashboard with the two sea dashboards and
// reads the real air import jobs from /api/freight.
export default function AirImportDashboard() {
    return (
        <FreightDashboard
            kind="air-import"
            icon="plane"
            accent="#4f46e5"
            title="Air Import Dashboard"
            subtitle="Incoming air cargo, arrival notices, Delivery Orders and customs status - from the real import jobs"
            newJobPath="/job-entry"
            kpiCards={[
                { key: 'total', label: 'Air import jobs', colour: '#4f46e5' },
                { key: 'arrivingNoBe', label: 'No BE filed yet', colour: '#818cf8', hint: 'not yet cleared' },
                { key: 'pendingDo', label: 'Pending D.O. release', colour: '#f59e0b', strong: '#b45309' },
                { key: 'customsHold', label: 'Query / customs hold', colour: '#ef4444', strong: '#b91c1c' },
            ]}
            actions={[
                { type: 'CONSOLE', label: 'Register console / arrival' },
                { type: 'CAN', label: 'Send Cargo Arrival Notice' },
                { type: 'DO', label: 'Issue Delivery Order (D.O.)' },
                { type: 'DESTUFF', label: 'Break-bulk / warehouse' },
            ]}
        />
    );
}
