import { useEffect } from 'react';
import { DRAFT_STORAGE_KEY } from './airWaybillData';

const AUTOSAVE_DELAY_MS = 5000;

const readDraft = () => {
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const forgetDraft = () => {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // no storage
  }
};

// the AWB number and goods typed are kept in the browser; the next visit offers them back
export default function useAwbDraft(ctx) {
  const { awbPrefix, awbSuffix, hawbNumber, natureOfGoods, setAwbPrefix, setAwbSuffix, setNatureOfGoods, setConfirmModal } = ctx;

  const restoreFrom = (draft) => {
    if (draft.awbPrefix) setAwbPrefix(draft.awbPrefix);
    if (draft.awbSuffix) setAwbSuffix(draft.awbSuffix);
    if (draft.natureOfGoods) setNatureOfGoods(draft.natureOfGoods);
  };

  const handleDiscardDraft = () => {
    forgetDraft();
    ctx.setSavedDraftData(null);
    ctx.setDraftConfirmOpen(false);
  };

  const handleRestoreDraft = () => {
    restoreFrom(ctx.savedDraftData || {});
    ctx.setDraftConfirmOpen(false);
  };

  useEffect(() => {
    const savedDraft = readDraft();
    if (!savedDraft) return;
    setConfirmModal({
      isOpen: true,
      title: 'RESTORE DRAFT?',
      message: 'An unsaved draft was found from your previous session. Do you want to restore it?',
      onConfirm: () => {
        try {
          restoreFrom(JSON.parse(savedDraft));
        } catch (error) {
          console.error('Draft restore failed', error);
        }
        setConfirmModal({ isOpen: false });
      },
      onCancel: () => {
        forgetDraft();
        setConfirmModal({ isOpen: false });
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- asked once, when the screen opens

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
