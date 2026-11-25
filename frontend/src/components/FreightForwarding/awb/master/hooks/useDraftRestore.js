import { useEffect, useState } from 'react';

export const STORAGE_KEY = 'CreateMasterWaybill_DRAFT';
const AUTOSAVE_DELAY_MS = 5000;

// the AWB number and goods text kept in the browser while typing, offered back on the next visit
export default function useDraftRestore({ awbPrefix, awbSuffix, natureOfGoods, setAwbPrefix, setAwbSuffix, setNatureOfGoods, setConfirmModal }) {
  const [draftConfirmOpen, setDraftConfirmOpen] = useState(false);
  const [savedDraftData, setSavedDraftData] = useState(null);

  const applyDraft = (draft) => {
    if (draft.awbPrefix) setAwbPrefix(draft.awbPrefix);
    if (draft.awbSuffix) setAwbSuffix(draft.awbSuffix);
    if (draft.natureOfGoods) setNatureOfGoods(draft.natureOfGoods);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedDraftData(null);
    setDraftConfirmOpen(false);
  };

  const handleRestoreDraft = () => {
    applyDraft(savedDraftData || {});
    setDraftConfirmOpen(false);
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (!savedDraft) return;
    setConfirmModal({
      isOpen: true,
      title: 'RESTORE DRAFT?',
      message: 'An unsaved draft was found from your previous session. Do you want to restore it?',
      onConfirm: () => {
        try {
          applyDraft(JSON.parse(savedDraft));
        } catch (error) {
          console.error('Draft restore failed', error);
        }
        setConfirmModal({ isOpen: false });
      },
      onCancel: () => {
        localStorage.removeItem(STORAGE_KEY);
        setConfirmModal({ isOpen: false });
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- asked once, when the screen opens

  useEffect(() => {
    const timer = setTimeout(() => {
      if (awbPrefix || awbSuffix || natureOfGoods) localStorage.setItem(STORAGE_KEY, JSON.stringify({ awbPrefix, awbSuffix, natureOfGoods }));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [awbPrefix, awbSuffix, natureOfGoods]);

  return { STORAGE_KEY, draftConfirmOpen, setDraftConfirmOpen, savedDraftData, setSavedDraftData, handleDiscardDraft, handleRestoreDraft };
}
