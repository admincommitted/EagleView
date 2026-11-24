// Screen section: Packing Details + Container / ULD Details windows
// Split out of ExportHeaderTab.jsx (28-Oct-2026). 29-Oct-2026: both windows rebuilt in ContainerPackingWindows.jsx
// (Edit works, Cancel drops the changes, Excel read for containers, ICEGATE package codes, shown on <body>).
import React from 'react';
import { ContainerWindow, PackingWindow } from './ContainerPackingWindows';

export default function PackingDetailsSection({ ctx }) {
  const { containerList, exportData, isContainerModalOpen, isPackingModalOpen, packingList, setContainerFlag, setContainerList, setExportData,
    setIsContainerModalOpen, setIsPackingModalOpen, setPackingFlag, setPackingList, shipmentMode, factoryStuffed } = ctx;
  const saveContainers = (rows) => {
    const flag = rows.length ? 'Y' : 'N';
    setContainerList(rows); setContainerFlag(flag); setIsContainerModalOpen(false);
    setExportData(prev => ({ ...prev, Containers: rows, containerFlag: flag }));
  };
  const savePacking = (rows) => {
    const flag = rows.length ? 'Y' : 'N';
    setPackingList(rows); setPackingFlag(flag); setIsPackingModalOpen(false);
    setExportData(prev => ({ ...prev, PackingDetails: rows, packingFlag: flag }));
  };
  // closing with nothing in the list puts the switch back to N
  const closeContainers = () => { setIsContainerModalOpen(false); if (!(containerList || []).length) { setContainerFlag('N'); setExportData(prev => ({ ...prev, containerFlag: 'N' })); } };
  const closePacking = () => { setIsPackingModalOpen(false); if (!(packingList || []).length) { setPackingFlag('N'); setExportData(prev => ({ ...prev, packingFlag: 'N' })); } };
  return (
    <>
      <PackingWindow open={isPackingModalOpen} onClose={closePacking} list={packingList} onSave={savePacking} totalPackages={exportData.autoField_14} />
      <ContainerWindow open={isContainerModalOpen} onClose={closeContainers} list={containerList} onSave={saveContainers} mode={shipmentMode}
        totalPackages={exportData.autoField_14} factoryStuffed={/^Y/i.test(String(factoryStuffed || exportData.factoryStuffed || '')) ? 'Y' : 'N'} />
    </>
  );
}
