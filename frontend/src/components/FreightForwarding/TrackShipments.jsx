import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import TrackTimelineModal from './TrackTimelineModal';
import CustomerUpdatesModal from './CustomerUpdatesModal';
import { exportRowsToExcel } from './awbExcel';
import { useOpenAwb } from './AirExportParts/airExport';
import { AirExportPage } from './AirExportParts/widgets';
import { TRACK_EXCEL_COLUMNS } from './TrackShipmentsParts/trackConfig';
import { useTracking } from './TrackShipmentsParts/useTracking';
import TrackFilters from './TrackShipmentsParts/TrackFilters';
import TrackResults from './TrackShipmentsParts/TrackResults';

export default function TrackShipments() {
  const location = useLocation();
  const openAwb = useOpenAwb();
  const tracking = useTracking(location.state?.trackAwb);
  const [timeline, setTimeline] = useState(null);
  const [showUpdates, setShowUpdates] = useState(false);

  const openRow = (row) => openAwb(row.documentType, row.documentType === 'HOUSE' ? row.hawbNumber : row.awbNumber);

  return (
    <AirExportPage activeTab="track" className="tw:py-2 tw:pb-10">
      <TrackFilters filters={tracking.filters} setFilter={tracking.setFilter} pickLists={tracking.pickLists} onSearch={tracking.search} onClear={tracking.clear} />
      <TrackResults
        tracking={tracking}
        onHistory={setTimeline}
        onOpenRow={openRow}
        onExcel={() => exportRowsToExcel('AWB_Tracking', 'Tracking', TRACK_EXCEL_COLUMNS, tracking.rows)}
        onCustomerUpdates={() => setShowUpdates(true)}
      />
      {timeline && (
        <TrackTimelineModal
          awbNumber={timeline.awbNumber}
          hawbNumber={timeline.hawbNumber}
          onClose={() => setTimeline(null)}
          onChanged={tracking.reload}
          onOpenAwb={() => { setTimeline(null); openRow(timeline.row); }}
        />
      )}
      {showUpdates && <CustomerUpdatesModal onClose={() => setShowUpdates(false)} />}
    </AirExportPage>
  );
}
