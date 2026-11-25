import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadBlob } from '@/lib/download';
import { errorMessage } from '@/services/axiosInstance';
import { serverReply } from '../../JobEntry/JobEntryLayoutParts/serverReply';
import { exportEntryApi } from '../exportEntryApi';
import { sbRequestOf } from './sbRequest';
import { screenRuleErrors } from './useSbFiling';

const ICEGATE_ID_PICK = {
  flat: { title: 'SB flat file (.sb) - ICEGATE ID', actionLabel: 'Download' },
  preview: { title: 'Preview JSON (SB) - ICEGATE ID', actionLabel: 'Show JSON' },
};

// Export Flat File (.sb) and Preview JSON of the job on the screen; each asks first which ICEGATE ID goes in the file.
export function useSbFiles({ screen, showValidation }) {
  const [icegateIdPick, setIcegateIdPick] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [flatBusy, setFlatBusy] = useState(false);
  const { exportData } = screen;

  // the ICES 1.5 flat file, built by the server from the same CACHE01 data and checked first: errors stop it, warnings ask
  const downloadFlatSb = async (profileId, loginId) => {
    setFlatBusy(true);
    try {
      const reply = await serverReply(exportEntryApi.flatSbFile(sbRequestOf(screen, { profileId })));
      if (!reply.success) {
        toast.error(`Flat file not made: ${reply.error || 'error'}`);
        return;
      }
      const download = () => {
        downloadBlob(new Blob([reply.content], { type: 'text/plain' }), reply.fileName || 'SB.sb');
        toast.success(`${reply.fileName} downloaded${loginId ? ` (ICEGATE ID ${loginId})` : ''} - upload it on ICEGATE (sign it first if your port asks)`);
        if (reply.filedNote) toast(reply.filedNote, { icon: 'ℹ️', duration: 8000 });
      };
      const validation = reply.validation || { errors: [], warnings: [] };
      const findings = { errors: [...screenRuleErrors(screen), ...validation.errors], warnings: validation.warnings };
      if (findings.errors.length) {
        showValidation({ ...findings, title: 'Flat file (.sb) - fix these first' });
        return;
      }
      if (findings.warnings.length) {
        showValidation({ ...findings, title: 'Flat file (.sb) - please check', onContinue: download, continueLabel: 'Download anyway' });
        return;
      }
      download();
    } catch (error) {
      toast.error(`Flat file not made: ${errorMessage(error)}`);
    } finally {
      setFlatBusy(false);
    }
  };

  // the check result is shown in the preview header
  const previewSbJson = async (profileId) => {
    setLoadingPreview(true);
    try {
      const reply = await serverReply(exportEntryApi.previewSb(sbRequestOf(screen, { amendment: !!exportData._amend, profileId })));
      if (reply.success) setPreview({ json: reply.cache01, validation: reply.validation || null });
      else toast.error(`Preview error: ${reply.error}`);
    } catch (error) {
      toast.error(`Network error: ${errorMessage(error)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const askIcegateId = (what) => setIcegateIdPick(what);

  const pickedIcegateId = (profileId, loginId) => {
    const what = icegateIdPick;
    setIcegateIdPick(null);
    if (what === 'flat') downloadFlatSb(profileId, loginId);
    else previewSbJson(profileId);
  };

  const pickTexts = ICEGATE_ID_PICK[icegateIdPick === 'flat' ? 'flat' : 'preview'];
  const idPickModal = {
    open: !!icegateIdPick,
    title: pickTexts.title,
    actionLabel: pickTexts.actionLabel,
    onClose: () => setIcegateIdPick(null),
    onPick: pickedIcegateId,
  };

  return { askIcegateId, idPickModal, preview, setPreview, loadingPreview, flatBusy };
}
