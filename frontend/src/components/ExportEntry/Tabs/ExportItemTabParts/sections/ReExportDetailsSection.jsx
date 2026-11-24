// Screen section: Re-Export Details Window
// Split out of ExportItemTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
// 29-Oct-2026: the Re-Export window is ReExportModal.jsx (rebuilt); both windows are shown on <body> (BodyPortal).
import ReExportModal from './ReExportModal';
import ItemDetailWindow from './ItemDetailWindows';
import React from 'react';

export default function ReExportDetailsSection({ ctx }) {
  const { formData, handleFormChange, setFormData, isManfModalOpen, isReExportModalOpen, setIsManfModalOpen, setIsReExportModalOpen } = ctx;
  return (
    <>
    <ReExportModal open={isReExportModalOpen} onClose={() => setIsReExportModalOpen(false)} formData={formData} handleFormChange={handleFormChange} />

      {/* Manufacturer window: ItemDetailWindows.jsx (29-Oct-2026) - before, its fields never reached the SB JSON */}
      {isManfModalOpen && <ItemDetailWindow which="manf" onClose={() => setIsManfModalOpen(false)} formData={formData} setFormData={setFormData} />}

      {/* E-SANCHIT MODAL */}
    </>
  );
}
