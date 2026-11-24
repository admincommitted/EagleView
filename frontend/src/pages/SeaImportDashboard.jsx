import React from 'react';
import FreightDashboard from '../components/Freight/FreightDashboard';

// 30-Oct-2026: this page listed three invented shipments ("CMAU999888777 on CMA CGM MARCO POLO V.42")
// with hardcoded KPI numbers (28 FCL / 15 LCL / 6 pending D.O. / 2 customs hold), and all five of its
// buttons - Register Import Console, File IGM, Issue Delivery Order, De-stuffing / CFS, View - did
// nothing. It was also a near-copy of the air import and sea export pages, so all three now share
// components/Freight/FreightDashboard, reading the real jobs from /api/freight.
export default function SeaImportDashboard() {
    return (
        <FreightDashboard
            kind="sea-import"
            icon="anchor"
            accent="#0284c7"
            title="Ocean Import Dashboard"
            subtitle="Incoming cargo, IGM record, Delivery Orders and customs status - from the real import jobs"
            newJobPath="/job-entry"
            kpiCards={[
                { key: 'total', label: 'Sea import jobs', colour: '#0284c7' },
                { key: 'arrivingNoBe', label: 'No BE filed yet', colour: '#38bdf8', hint: 'not yet cleared' },
                { key: 'pendingDo', label: 'Pending D.O. release', colour: '#f59e0b', strong: '#b45309' },
                { key: 'customsHold', label: 'Query / customs hold', colour: '#ef4444', strong: '#b91c1c' },
                { key: 'igmNotRecorded', label: 'IGM not recorded', colour: '#8b5cf6', strong: '#6d28d9' },
            ]}
            actions={[
                { type: 'CONSOLE', label: 'Register import console' },
                { type: 'IGM', label: 'Record IGM filing' },
                { type: 'DO', label: 'Issue Delivery Order (D.O.)' },
                { type: 'DESTUFF', label: 'De-stuffing / CFS' },
            ]}
        />
    );
}
