import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { accountsApi } from '@/pages/AccountsHubParts/accountsApi';
import { EVEN_ON_ERROR, newDraftKey, refusedUnlessOk } from './billingData';

/** Files attached before the voucher exists are parked under a draft key and claimed once it is posted. */
export default function useDraftAttachments(prefix) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const draftKey = useRef(newDraftKey(prefix));

  /** Throws when the upload is refused; resolves with the server's answer. */
  const upload = async (files, documentType) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('draftKey', draftKey.current);
    if (documentType) formData.append('documentType', documentType);
    setUploading(true);
    try {
      return refusedUnlessOk(await accountsApi.uploadVoucherDocuments(formData));
    } finally {
      setUploading(false);
    }
  };

  const reloadDocs = async () => {
    try {
      const body = await accountsApi.voucherDocuments({ draftKey: draftKey.current }, EVEN_ON_ERROR);
      setDocs(body?.data || []);
    } catch {
      // the list is a convenience; the upload result already told the user
    }
  };

  const linkToVoucher = async (voucherId, failureMessage) => {
    if (!voucherId || !docs.length) return;
    try {
      await accountsApi.claimVoucherDocuments(draftKey.current, voucherId, EVEN_ON_ERROR);
    } catch {
      toast.error(failureMessage);
    }
  };

  const startNewDraft = () => {
    setDocs([]);
    draftKey.current = newDraftKey(prefix);
  };

  return { docs, setDocs, uploading, upload, reloadDocs, linkToVoucher, startNewDraft };
}
