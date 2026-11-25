import { useEffect, useMemo, useState } from 'react';

// every window of the screen: showDgd / setShowDgd ... (setters take a value or an updater, like useState)
const WINDOW_NAMES = [
  'AwbVault', 'Dimension', 'RateLine', 'Handling', 'DueCarrier', 'DueAgent', 'Commodity', 'HSCode',
  'SubAgentMaster', 'OverseasMaster', 'Dgd', 'Avi', 'Csd', 'Lithium', 'Coo', 'Label', 'Booking', 'Cca', 'Temp',
  'Manifest', 'Sli', 'Do', 'DocsMenu', 'LogsModal', 'PrintOptions', 'ModifyModal',
];

const CLOSED_MODAL = { isOpen: false, title: '', message: '', type: 'success' };

export default function useScreenDialogs() {
  const [openWindows, setOpenWindows] = useState({});
  const [logsData, setLogsData] = useState([]);
  const [draftConfirmOpen, setDraftConfirmOpen] = useState(false);
  const [savedDraftData, setSavedDraftData] = useState(null);
  const [uiModal, setUiModal] = useState(CLOSED_MODAL);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, onCancel: null });

  const windowSetters = useMemo(() => Object.fromEntries(WINDOW_NAMES.map((name) => [
    `setShow${name}`,
    (next) => setOpenWindows((previous) => ({ ...previous, [name]: typeof next === 'function' ? next(previous[name] ?? false) : next })),
  ])), []);
  const windowFlags = Object.fromEntries(WINDOW_NAMES.map((name) => [`show${name}`, openWindows[name] ?? false]));

  // showSuccessToast / showValidationErrorsModal (printLogic) open the message window of the screen
  useEffect(() => {
    const showMessage = (event) => {
      setUiModal({ isOpen: true, title: event.detail.title, message: event.detail.message, type: event.detail.isError ? 'error' : 'success' });
    };
    const showValidationErrors = (event) => {
      const errorList = event.detail.errors.join('\n• ');
      setUiModal({ isOpen: true, title: 'VALIDATION ERRORS', message: 'Please fix the following EDI errors:\n• ' + errorList, type: 'error' });
    };
    window.addEventListener('show-toast', showMessage);
    window.addEventListener('show-validation-errors', showValidationErrors);
    return () => {
      window.removeEventListener('show-toast', showMessage);
      window.removeEventListener('show-validation-errors', showValidationErrors);
    };
  }, []);

  return {
    ...windowFlags, ...windowSetters,
    logsData, setLogsData, draftConfirmOpen, setDraftConfirmOpen, savedDraftData, setSavedDraftData,
    uiModal, setUiModal, confirmModal, setConfirmModal,
  };
}
