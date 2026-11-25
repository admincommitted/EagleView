import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadBlob } from '@/lib/download';
import { errorMessage } from '@/services/axiosInstance';
import { jobEntryApi } from '../jobEntryApi';
import { serverReply } from './serverReply';
import { beJsonFileName, beRequestOf, downloadJson, validationErrorCount } from './beFiles';

const ICEGATE_ID_PICK = {
  json: { title: 'BE file (JSON) - ICEGATE ID', actionLabel: 'Download' },
  flat: { title: 'BE flat file (.be) - ICEGATE ID', actionLabel: 'Download' },
  preview: { title: 'Preview JSON - ICEGATE ID', actionLabel: 'Show JSON' },
};

function warnAboutFindings(reply) {
  const errorCount = validationErrorCount(reply.validation);
  if (errorCount) toast(`${errorCount} validation error(s) - fix them before filing`, { icon: '⚠️' });
  if (reply.filedNote) toast(reply.filedNote, { icon: '⚠️', duration: 9000 });
}

// BE JSON / .be flat file / JSON preview of the job on the screen, or of a job read for the job list's right-click
// menu (listJob, same shape as screenJob). Each asks first which ICEGATE ID goes in the file.
export function useBeFiles({ screenJob, stopForUnsavedEdits, showValidation, openAmendment, openListAmendment }) {
  const [icegateIdPick, setIcegateIdPick] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // An amended job goes to ICEGATE as an amendment file (CACHI01_A). A full BE file of it, uploaded by mistake,
  // would file a new BE.
  const isAmendedJob = (source, listJob) => {
    if (!source.jobData._amendmentId) return false;
    toast('This is an amended job - its file for ICEGATE is the amendment file. Make / download it here.', { icon: '📝', duration: 6000 });
    if (listJob) openListAmendment(source.jobData);
    else openAmendment();
    return true;
  };

  const downloadBeJson = async (profileId, loginId, listJob) => {
    const source = listJob || screenJob;
    if (isAmendedJob(source, listJob)) return;
    if (!listJob && await stopForUnsavedEdits('build the file')) return;
    try {
      const reply = await serverReply(jobEntryApi.previewBe(beRequestOf(source, { forFiling: true, profileId })));
      if (!reply.success) {
        toast.error(`Could not build the BE file: ${reply.error || ''}`);
        return;
      }
      warnAboutFindings(reply);
      const senderId = reply.cachi01?.headerField?.senderID || loginId || '';
      downloadJson(reply.cachi01, beJsonFileName(source.jobData.jobNo, senderId));
      if (senderId) toast.success(`BE file downloaded - ICEGATE ID ${senderId}`);
    } catch (error) {
      toast.error(`Could not build the BE file: ${errorMessage(error)}`);
    }
  };

  // ICES 1.5 flat file (.be), for upload on ICEGATE / the BE filing utility
  const downloadFlatBe = async (profileId, loginId, listJob) => {
    const source = listJob || screenJob;
    if (isAmendedJob(source, listJob)) return;
    if (!listJob && await stopForUnsavedEdits('build the file')) return;
    try {
      const reply = await serverReply(jobEntryApi.flatBeFile(beRequestOf(source, { profileId })));
      if (!reply.success) {
        toast.error(`Could not build the .be file: ${reply.error || ''}`);
        return;
      }
      if (loginId) toast.success(`.be file made - ICEGATE ID ${loginId}`);
      warnAboutFindings(reply);
      if (reply.unconfirmedTables?.length) toast(`Check on ICEGATE: section name(s) ${reply.unconfirmedTables.join(', ')} not yet seen in a filed .be`, { icon: 'ℹ️', duration: 6000 });
      downloadBlob(new Blob([reply.content], { type: 'text/plain' }), reply.fileName || 'BE.be');
    } catch (error) {
      toast.error(`Could not build the .be file: ${errorMessage(error)}`);
    }
  };

  // the preview is the file to submit (forFiling: a filed job's BE No is left blank)
  const previewBeJson = async (profileId, listJob) => {
    const source = listJob || screenJob;
    setLoadingPreview(true);
    try {
      const reply = await serverReply(jobEntryApi.previewBe(beRequestOf(source, { forFiling: true, profileId })));
      if (!reply.success) {
        toast.error(`Preview error: ${reply.error}`);
        return;
      }
      setPreview({ json: reply.cachi01, listJobData: listJob ? source.jobData : null });
      const validation = reply.validation;
      if (validation && (validation.errors.length || validation.warnings.length)) {
        toast(`${validation.errors.length} error(s), ${validation.warnings.length} warning(s) found in this BE`, { icon: validation.errors.length ? '⛔' : '⚠️' });
        showValidation({ ...validation, title: 'Bill of Entry - Pre-Validation' });
      }
    } catch (error) {
      toast.error(`Network error: ${errorMessage(error)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const askIcegateId = (what, listJob) => setIcegateIdPick({ what, listJob });

  const pickedIcegateId = (profileId, loginId) => {
    const { what, listJob } = icegateIdPick;
    setIcegateIdPick(null);
    if (what === 'flat') downloadFlatBe(profileId, loginId, listJob);
    else if (what === 'preview') previewBeJson(profileId, listJob);
    else downloadBeJson(profileId, loginId, listJob);
  };

  const pickTexts = icegateIdPick && ICEGATE_ID_PICK[icegateIdPick.what];
  const idPickModal = {
    open: !!icegateIdPick,
    jobData: icegateIdPick?.listJob ? icegateIdPick.listJob.jobData : screenJob.jobData,
    title: icegateIdPick ? `${pickTexts.title}${icegateIdPick.listJob ? ` - job ${icegateIdPick.listJob.jobData.jobNo || ''}` : ''}` : ICEGATE_ID_PICK.json.title,
    actionLabel: pickTexts ? pickTexts.actionLabel : 'Download',
    onClose: () => setIcegateIdPick(null),
    onPick: pickedIcegateId,
  };

  return { askIcegateId, idPickModal, preview, setPreview, loadingPreview };
}
