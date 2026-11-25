import { useExportContext } from '../../ExportContext';
import useItemMasters from './hooks/useItemMasters';
import useItemForm from './hooks/useItemForm';
import useSwInfoRows from './hooks/useSwInfoRows';
import useItemCalculations from './hooks/useItemCalculations';
import useItemList from './hooks/useItemList';
import useItemPopups from './hooks/useItemPopups';
import useItemActions from './hooks/useItemActions';

export default function useExportItemTab() {
  const { items, setItems, exportData, setExportData, registerPendingEdits, remapItemRows } = useExportContext();
  const masters = useItemMasters();
  const form = useItemForm({ registerPendingEdits });
  useSwInfoRows({ ...form, exportData, rodtepsMaster: masters.rodtepsMaster });
  useItemCalculations({ ...form, exportData, drawbacksMaster: masters.drawbacksMaster });
  const list = useItemList({ ...form, items, setItems, exportData, remapItemRows, states: masters.states });
  const popups = useItemPopups({ handleFormChange: form.handleFormChange, updateItem: list.updateItem });
  const ctx = { items, setItems, exportData, setExportData, ...masters, ...form, ...list, ...popups };
  return { ...ctx, ...useItemActions(ctx) };
}
