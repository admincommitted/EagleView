import { useState } from 'react';
import TrackTimelineModal from './TrackTimelineModal';
import { exportRowsToExcel } from './awbExcel';
import { useOpenAwb } from './AirExportParts/airExport';
import { AirExportPage } from './AirExportParts/widgets';
import { EXCEL_COLUMNS, numberOf } from './SearchAirWaybillParts/searchConfig';
import { printAwbGrid } from './SearchAirWaybillParts/printAwbGrid';
import { useAwbSearch } from './SearchAirWaybillParts/useAwbSearch';
import { useAwbActions } from './SearchAirWaybillParts/useAwbActions';
import SearchFilters from './SearchAirWaybillParts/SearchFilters';
import SearchResults from './SearchAirWaybillParts/SearchResults';

export default function SearchAirWaybill() {
  const openAwb = useOpenAwb();
  const search = useAwbSearch();
  const actions = useAwbActions(search.researchQuietly);
  const [history, setHistory] = useState(null);

  const tickedOrAll = () => (search.pickedRows.length ? search.pickedRows : search.sorted);
  const exportExcel = () => exportRowsToExcel('AWB_Search', 'AWB Search', EXCEL_COLUMNS, tickedOrAll());
  const printGrid = () => printAwbGrid(tickedOrAll());

  const openRow = (row, extraState) => openAwb(row.type, numberOf(row), extraState);
  const openNumber = (kind, row) => {
    if (kind === 'hawb') openAwb('HAWB', row.hawbNo);
    else if (row.type === 'HAWB') openAwb('MAWB', row.awbNo);
    else openRow(row);
  };
  const clearAll = () => {
    search.clear();
    actions.clearResults();
  };

  return (
    <AirExportPage activeTab="search" className="tw:pb-10">
      <SearchFilters
        filters={search.filters}
        setFilter={search.setFilter}
        pickLists={search.pickLists}
        onSearch={() => search.search()}
        onClear={clearAll}
        onPrint={printGrid}
        onExcel={exportExcel}
        hasRows={search.rows.length > 0}
      />
      <SearchResults
        search={search}
        actions={actions}
        onPrint={printGrid}
        onExcel={exportExcel}
        onOpenRow={openRow}
        onOpenNumber={openNumber}
        onHistory={(row) => setHistory({ awbNumber: row.awbNo, hawbNumber: row.type === 'HAWB' ? row.hawbNo : null, row })}
      />
      {history && (
        <TrackTimelineModal
          awbNumber={history.awbNumber}
          hawbNumber={history.hawbNumber}
          onClose={() => setHistory(null)}
          onChanged={search.researchQuietly}
          onOpenAwb={() => { setHistory(null); openRow(history.row); }}
        />
      )}
    </AirExportPage>
  );
}
