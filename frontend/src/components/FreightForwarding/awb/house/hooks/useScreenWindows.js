import { useState } from 'react';
import { newDocPouchId } from './houseWaybillData';
import useWindowFlags from './useWindowFlags';

const WINDOW_FLAGS = [
  'showHandling', 'showDueCarrier', 'showDueAgent', 'showCommodity', 'showHSCode',
  'showPrintOptions', 'showModifyModal', 'showLogsModal', 'showAwbVault', 'showDocsMenu',
  'showDgd', 'showAvi', 'showCsd', 'showLithium', 'showCoo', 'showLabel', 'showBooking',
  'showCca', 'showTemp', 'showManifest', 'showSli', 'showDo',
];

// the screen's pop-up windows, the document windows' saved data (extraDocs) and the e-document pouch of this AWB
export default function useScreenWindows() {
  const windowFlags = useWindowFlags(WINDOW_FLAGS);
  const [hsCodeTargetIndex, setHsCodeTargetIndex] = useState(null);
  const [logsData, setLogsData] = useState([]);
  const [draftConfirmOpen, setDraftConfirmOpen] = useState(false);
  const [savedDraftData, setSavedDraftData] = useState(null);
  const [extraDocs, setExtraDocs] = useState({});
  const [tempAwbId, setTempAwbId] = useState(newDocPouchId);

  return {
    ...windowFlags,
    hsCodeTargetIndex, setHsCodeTargetIndex, logsData, setLogsData,
    draftConfirmOpen, setDraftConfirmOpen, savedDraftData, setSavedDraftData,
    extraDocs, setExtraDocs, tempAwbId, setTempAwbId,
  };
}
