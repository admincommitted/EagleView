import toast from 'react-hot-toast';
import { asList } from '@/utils/asList';
import CodeSearchModals from './CodeSearchModals';
import SwStatementModal from './SwStatementModal';
import SwInfoModal from './SwInfoModal';
import ReExportModal from './ReExportModal';
import ESanchitDocsModal from './ESanchitDocsModal';
import CcrModal from './CcrModal';
import ValidationModals from './ValidationModals';

export default function ItemPopups({ ctx }) {
  const {
    formData, setFormData, handleFormChange, items, setItems, exportData, setExportData, selectedRowId, keepInBase,
    isReExportModalOpen, setIsReExportModalOpen, isESanchitModalOpen, setIsESanchitModalOpen,
    esanchitMasters, icegateProfiles, defaultIcegateId, selectedIcegateProfile, setSelectedIcegateProfile,
  } = ctx;

  // the item open in the form gets its documents in the list too (they were lost unless Modify was clicked)
  const saveDocuments = (rows) => {
    const hasSbDocuments = asList(exportData?.eSanchitList).length > 0;
    const isOpen = selectedRowId && items.some((item) => item.id === selectedRowId);
    setFormData((previous) => {
      const patch = { eSanchitList: rows, suppDocs: rows.length ? 'Y' : (previous.suppDocs === 'Y' ? 'N' : previous.suppDocs) };
      if (isOpen) keepInBase(patch);
      return { ...previous, ...patch };
    });
    if (isOpen) setItems(items.map((item) => (item.id === selectedRowId ? { ...item, eSanchitList: rows, suppDocs: rows.length ? 'Y' : 'N' } : item)));
    setIsESanchitModalOpen(false);
    toast.success(`${rows.length} item document(s) kept${hasSbDocuments && !rows.length ? ' (SB-level documents are on the job)' : ''}${selectedRowId ? '' : ' - click Save to add the item'}`);
  };

  return (
    <>
      <CodeSearchModals ctx={ctx} />
      <SwStatementModal ctx={ctx} />
      <SwInfoModal ctx={ctx} />
      {isReExportModalOpen && <ReExportModal open onClose={() => setIsReExportModalOpen(false)} formData={formData} handleFormChange={handleFormChange} />}
      <ESanchitDocsModal
        open={isESanchitModalOpen}
        onClose={() => setIsESanchitModalOpen(false)}
        onSave={saveDocuments}
        itemRows={asList(formData.eSanchitList)}
        exportData={exportData} setExportData={setExportData} items={items} setItems={setItems}
        itemLabel={`Item ${formData.itemSr || '-'} of invoice ${formData.invSr || 1}${formData.desc ? ` (${String(formData.desc).slice(0, 30)})` : ''}`}
        esanchitMasters={esanchitMasters} icegateProfiles={icegateProfiles} defaultIcegateId={defaultIcegateId}
        selectedIcegateProfile={selectedIcegateProfile} setSelectedIcegateProfile={setSelectedIcegateProfile}
      />
      <CcrModal ctx={ctx} />
      <ValidationModals ctx={ctx} />
    </>
  );
}
