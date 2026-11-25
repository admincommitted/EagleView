import { useEffect, useState } from 'react';

// the message window: showSuccessToast / showValidationErrorsModal (printLogic) send window events that open it
export default function useScreenMessages() {
  const [uiModal, setUiModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, onCancel: null });

  useEffect(() => {
    const handleToast = (event) => {
      setUiModal({ isOpen: true, title: event.detail.title, message: event.detail.message, type: event.detail.isError ? 'error' : 'success' });
    };
    const handleValidationErrors = (event) => {
      const errorList = event.detail.errors.join('\n• ');
      setUiModal({ isOpen: true, title: 'VALIDATION ERRORS', message: `Please fix the following EDI errors:\n• ${errorList}`, type: 'error' });
    };
    window.addEventListener('show-toast', handleToast);
    window.addEventListener('show-validation-errors', handleValidationErrors);
    return () => {
      window.removeEventListener('show-toast', handleToast);
      window.removeEventListener('show-validation-errors', handleValidationErrors);
    };
  }, []);

  return { uiModal, setUiModal, confirmModal, setConfirmModal };
}
