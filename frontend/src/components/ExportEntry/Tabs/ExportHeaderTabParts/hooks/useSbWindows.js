import { useEffect, useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { useExportContext } from '../../../ExportContext';

export const EMPTY_ETP = {
  JobNo: '', JobDate: '', SiteId: '', GatewayPort: '', StuffPort: '', CarrierCode: '', PortOfDischarge: '', CarrierNumber: '',
  BondCode: '', BondNumber: '', BondDate: '', BondSite: '', ExpTransShippmentDate: '', ExpTransShippmentNo: '', AirWayBillNo: '',
};

const FACTORY_ADDRESS_PROMPT = { title: 'Confirm Action', message: 'Do you want to save Factory Stuff Address?', okLabel: 'OK', cancelLabel: 'Cancel' };

const listOf = (value) => (Array.isArray(value) ? value : []);

// Y/N switches of the SB2 rows and the windows they open (packing, containers / ULDs, ETP, NFEI category, factory
// address, marks). The rows themselves live in exportData (PackingDetails, Containers, etpDetails ...).
export default function useSbWindows() {
  const { exportData, setExportData } = useExportContext();
  const [packingFlag, setPackingFlag] = useState('N');
  const [containerFlag, setContainerFlag] = useState('N');
  const [etpFlag, setEtpFlag] = useState('N');
  const [etpDetails, setEtpDetails] = useState(EMPTY_ETP);
  const [isPackingModalOpen, setIsPackingModalOpen] = useState(false);
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [isEtpModalOpen, setIsEtpModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isFactoryAddressModalOpen, setIsFactoryAddressModalOpen] = useState(false);
  const [isMarksNoModalOpen, setIsMarksNoModalOpen] = useState(false);

  const packingList = listOf(exportData.PackingDetails);
  const containerList = listOf(exportData.Containers);

  // an opened (or new) job brings its own switches and ETP details
  useEffect(() => {
    setPackingFlag(packingList.length || exportData.packingFlag === 'Y' ? 'Y' : 'N');
    setContainerFlag(containerList.length || exportData.containerFlag === 'Y' ? 'Y' : 'N');
    const etp = exportData.etpDetails && typeof exportData.etpDetails === 'object' ? exportData.etpDetails : null;
    setEtpDetails((prev) => (etp ? { ...prev, ...etp } : EMPTY_ETP));
    setEtpFlag(etp || exportData.etpFlag === 'Y' ? 'Y' : 'N');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a job is loaded or a new one started
  }, [exportData.id, exportData.jobNo]);

  const windowFlag = (field, setFlag, openWindow) => (value) => {
    const flag = String(value || '').toUpperCase();
    setFlag(flag);
    setExportData((prev) => ({ ...prev, [field]: flag }));
    if (flag === 'Y') openWindow(true);
  };

  const saveRows = (rowsKey, flagKey, setFlag, setOpen) => (rows) => {
    const flag = rows.length ? 'Y' : 'N';
    setFlag(flag);
    setOpen(false);
    setExportData((prev) => ({ ...prev, [rowsKey]: rows, [flagKey]: flag }));
  };

  // closing with nothing in the list puts the switch back to N
  const closeRows = (rows, flagKey, setFlag, setOpen) => () => {
    setOpen(false);
    if (rows.length) return;
    setFlag('N');
    setExportData((prev) => ({ ...prev, [flagKey]: 'N' }));
  };

  const changeFactoryStuffed = async (value) => {
    setExportData((prev) => ({ ...prev, factoryStuffed: value }));
    if (value === 'Yes' && await askConfirm(FACTORY_ADDRESS_PROMPT)) setIsFactoryAddressModalOpen(true);
  };

  const saveEtp = () => {
    setExportData((prev) => ({ ...prev, etpDetails }));
    setIsEtpModalOpen(false);
  };

  const resetWindows = () => {
    setPackingFlag('N');
    setContainerFlag('N');
    setEtpFlag('N');
    setEtpDetails(EMPTY_ETP);
  };

  return {
    packingFlag, containerFlag, etpFlag, etpDetails, setEtpDetails, packingList, containerList,
    factoryStuffed: /^Y/i.test(String(exportData.factoryStuffed || '')) ? 'Yes' : 'No',
    changePackingFlag: windowFlag('packingFlag', setPackingFlag, setIsPackingModalOpen),
    changeContainerFlag: windowFlag('containerFlag', setContainerFlag, setIsContainerModalOpen),
    changeEtpFlag: windowFlag('etpFlag', setEtpFlag, setIsEtpModalOpen),
    savePacking: saveRows('PackingDetails', 'packingFlag', setPackingFlag, setIsPackingModalOpen),
    saveContainers: saveRows('Containers', 'containerFlag', setContainerFlag, setIsContainerModalOpen),
    closePacking: closeRows(packingList, 'packingFlag', setPackingFlag, setIsPackingModalOpen),
    closeContainers: closeRows(containerList, 'containerFlag', setContainerFlag, setIsContainerModalOpen),
    changeFactoryStuffed, saveEtp, resetWindows,
    isPackingModalOpen, setIsPackingModalOpen, isContainerModalOpen, setIsContainerModalOpen, isEtpModalOpen, setIsEtpModalOpen,
    isCategoryModalOpen, setIsCategoryModalOpen, isFactoryAddressModalOpen, setIsFactoryAddressModalOpen, isMarksNoModalOpen, setIsMarksNoModalOpen,
  };
}
