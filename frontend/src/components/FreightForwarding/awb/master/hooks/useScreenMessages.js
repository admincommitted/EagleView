import { useEffect, useState } from 'react';

// the screen's message box (filled by showSuccessToast / showValidationErrorsModal events) and its confirm box
export default function useScreenMessages() {
  const [uiModal, setUiModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, onCancel: null });

  useEffect(() => {
    const showMessage = (event) => {
      setUiModal({ isOpen: true, title: event.detail.title, message: event.detail.message, type: event.detail.isError ? 'error' : 'success' });
    };
    const showValidationErrors = (event) => {
      const errorList = event.detail.errors.join('\n• ');
      setUiModal({ isOpen: true, title: 'VALIDATION ERRORS', message: `Please fix the following EDI errors:\n• ${errorList}`, type: 'error' });
    };
    window.addEventListener('show-toast', showMessage);
    window.addEventListener('show-validation-errors', showValidationErrors);
    return () => {
      window.removeEventListener('show-toast', showMessage);
      window.removeEventListener('show-validation-errors', showValidationErrors);
    };
  }, []);

  return { uiModal, setUiModal, confirmModal, setConfirmModal };
}
