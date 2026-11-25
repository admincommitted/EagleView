import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadBlob } from '@/lib/download';
import { errorMessage } from '@/services/axiosInstance';
import { jobEntryApi } from '../jobEntryApi';
import { serverReply } from './serverReply';
import { beRequestOf } from './beFiles';

const IDLE = { loading: false, result: null, error: null };

const hasFindings = (validation) => validation && (validation.errors.length || validation.warnings.length);

// Validate / Send to ICEGATE / signed file of the job on the screen.
export function useIcegateFiling({ screenJob, setJobData, saveJob, stopForUnsavedEdits, filedLock, openAmendment }) {
  const [icegateState, setIcegateState] = useState(IDLE);
  const [validationResult, setValidationResult] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const { jobData } = screenJob;

  const clearIcegateState = () => setIcegateState(IDLE);

  // the same pre-validation as Send to ICEGATE, without saving or sending
  const validateJob = async () => {
    if (await stopForUnsavedEdits('validate')) return;
    const progressToast = toast.loading('Validating the Bill of Entry...');
    try {
      const reply = await serverReply(jobEntryApi.previewBe(beRequestOf(screenJob, { forFiling: true })));
      toast.dismiss(progressToast);
      if (!reply.success) {
        toast.error(`Could not build the BE: ${reply.error || 'unknown error'}`);
        return;
      }
      const validation = reply.validation || { errors: [], warnings: [] };
      if (!hasFindings(validation)) {
        toast.success('No errors - this job is ready to file');
        return;
      }
      setValidationResult({ ...validation, title: 'Bill of Entry - Validation' });
    } catch (error) {
      toast.dismiss(progressToast);
      toast.error(`Could not validate: ${errorMessage(error)}`);
    }
  };

  // The job is saved first: the filed BE and the saved job must match, and the ICEGATE Unique ID is written to it.
  const startIcegateSend = async () => {
    if (jobData._amendmentId) {
      toast.error('This is an amended job - send it from the BE Amendment window (file / sign / send to ICEGATE)');
      openAmendment();
      return;
    }
    if (String(jobData.beNo || '').trim()) {
      toast.error(`This job already has BE No ${jobData.beNo} - it was filed. For a change use ACTIONS > BE Amendment. If the BE No is wrong, clear it in Job Header > BE Filing Details and save.`, { duration: 9000 });
      return;
    }
    const saved = await saveJob();
    if (!saved) {
      toast.error('The job could not be saved, so it was not sent to ICEGATE');
      return;
    }
    try {
      const reply = await serverReply(jobEntryApi.previewBe(beRequestOf(screenJob)));
      if (!reply.success) {
        toast.error(`Validation error: ${reply.error || 'could not build the BE'}`);
        return;
      }
      if (hasFindings(reply.validation)) {
        setValidationResult({ ...reply.validation, title: 'Bill of Entry - Pre-Validation', onContinue: () => setShowSubmitModal(true) });
        return;
      }
    } catch (error) {
      toast.error(`Could not validate: ${errorMessage(error)}`);
      return;
    }
    setShowSubmitModal(true);
  };

  // "Download signed file (not sent)": signed exactly as Confirm Submit signs it, for a check on ICEGATE's signer site
  const downloadSignedFile = async (profileId, tokenPin) => {
    if (await stopForUnsavedEdits('make the signed file')) return;
    try {
      const reply = await serverReply(jobEntryApi.signBeFile(beRequestOf(screenJob, { profileId, pin: tokenPin })));
      if (!reply.success) {
        toast.error(reply.error || 'The file could not be signed', { duration: 8000 });
        return;
      }
      downloadBlob(new Blob([reply.json], { type: 'application/json' }), reply.fileName);
      toast.success(`Signed file downloaded (ICEGATE ID ${reply.senderId || '-'}, signed by ${reply.signerCn || '-'}). It was NOT sent to ICEGATE - check it on filesign.icegate.gov.in (Verify).`, { duration: 10000 });
      if (!reply.certificate) toast.error('The signer did not put the certificate in the file - update the signer tool', { duration: 8000 });
    } catch (error) {
      toast.error(`Could not make the signed file: ${errorMessage(error)}`);
    }
  };

  const submitToIcegate = async (profileId, tokenPin, isAmendment, amendmentType, amendReason) => {
    if (await stopForUnsavedEdits('file the BE')) return;
    setIcegateState({ loading: true, result: null, error: null });
    try {
      const reply = await serverReply(jobEntryApi.submitBe(beRequestOf(screenJob, {
        indicator: 'P', profileId, pin: tokenPin, tokenPin, amendment: isAmendment, amendmentType, amendReason,
      })));
      if (reply.success) {
        setIcegateState({ loading: false, result: reply, error: null });
        setShowSubmitModal(false);
        setJobData((job) => ({ ...job, icegateStatus: isAmendment ? 'Amended' : 'Filed', icegateUniqueId: reply.uniqueId, isAmended: !!isAmendment, filedAt: new Date().toISOString(), hasFiledJson: true, amendUnlockedAt: null, amendUnlockedBy: null }));
        filedLock.endAmendMode();
        toast.success(`Sent to ICEGATE - Unique ID ${reply.uniqueId || ''}`, { duration: 6000 });
      } else {
        // the submit window stays open on an error, so another ICEGATE ID can be tried
        setIcegateState({ loading: false, result: null, error: reply.error || reply.details?.errorMessage || 'Filing failed' });
        if (reply.validation) {
          setShowSubmitModal(false);
          setValidationResult({ ...reply.validation, title: 'Bill of Entry - Not sent' });
        }
      }
    } catch (error) {
      setIcegateState({ loading: false, result: null, error: `Network error: ${errorMessage(error)}` });
    }
  };

  return {
    icegateState, setIcegateState, clearIcegateState,
    validationResult, setValidationResult,
    showSubmitModal, setShowSubmitModal,
    validateJob, startIcegateSend, downloadSignedFile, submitToIcegate,
  };
}
