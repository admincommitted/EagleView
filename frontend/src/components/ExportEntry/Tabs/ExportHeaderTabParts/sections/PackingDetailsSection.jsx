import { ContainerWindow, PackingWindow } from './ContainerPackingWindows';

// rows are kept in exportData.Containers / PackingDetails, which the SB JSON reads (containerModel / packingListModel)
export default function PackingDetailsSection({ ctx }) {
  const {
    exportData, shipmentMode, factoryStuffed, packingList, containerList, isPackingModalOpen, isContainerModalOpen,
    savePacking, saveContainers, closePacking, closeContainers,
  } = ctx;
  return (
    <>
      <PackingWindow open={isPackingModalOpen} onClose={closePacking} list={packingList} onSave={savePacking} totalPackages={exportData.autoField_14} />
      <ContainerWindow open={isContainerModalOpen} onClose={closeContainers} list={containerList} onSave={saveContainers} mode={shipmentMode}
        totalPackages={exportData.autoField_14} factoryStuffed={factoryStuffed === 'Yes' ? 'Y' : 'N'} />
    </>
  );
}
