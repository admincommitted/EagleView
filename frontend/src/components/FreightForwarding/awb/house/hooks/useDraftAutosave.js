import { useEffect } from 'react';
import { DRAFT_STORAGE_KEY } from './houseWaybillData';

const AUTOSAVE_DELAY_MS = 5000;

// AWB numbers and nature of goods are kept in the browser while typing; a draft left from an earlier visit is offered back
export default function useDraftAutosave(form) {
  const {
    awbPrefix, awbSuffix, hawbNumber, natureOfGoods, savedDraftData,
    setAwbPrefix, setAwbSuffix, setNatureOfGoods, setSavedDraftData, setDraftConfirmOpen, setConfirmModal,
  } = form;

  const applyDraft = (draft) => {
    if (draft.awbPrefix) setAwbPrefix(draft.awbPrefix);
    if (draft.awbSuffix) setAwbSuffix(draft.awbSuffix);
    if (draft.natureOfGoods) setNatureOfGoods(draft.natureOfGoods);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setSavedDraftData(null);
    setDraftConfirmOpen(false);
  };

  const handleRestoreDraft = () => {
    applyDraft(savedDraftData || {});
    setDraftConfirmOpen(false);
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
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
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setConfirmModal({ isOpen: false });
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, when the screen opens

  useEffect(() => {
    const timer = setTimeout(() => {
      if (awbPrefix || awbSuffix || natureOfGoods) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ awbPrefix, awbSuffix, hawbNumber, natureOfGoods }));
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [awbPrefix, awbSuffix, hawbNumber, natureOfGoods]);

  return { STORAGE_KEY: DRAFT_STORAGE_KEY, handleDiscardDraft, handleRestoreDraft };
}
