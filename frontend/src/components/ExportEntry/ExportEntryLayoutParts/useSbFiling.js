import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadBlob } from '@/lib/download';
import { errorMessage } from '@/services/axiosInstance';
import askConfirm from '../../common/askConfirm';
import { validateFullJob } from '../../../utils/calculations';
import { validateIcegateRules } from '../../../utils/IcegateValidators';
import { serverReply } from '../../JobEntry/JobEntryLayoutParts/serverReply';
import { exportEntryApi } from '../exportEntryApi';
import { amendmentFields, invoicesWithItems, sbRequestOf } from './sbRequest';

const IDLE = { loading: false, result: null, error: null };

export const screenRuleErrors = ({ exportData, items }) =>
  validateIcegateRules(exportData, items, exportData.invoices || []).map((error) => `Screen: ${error}`);

// Validate Job / Send to ICEGATE / signed file of the job on the screen.
// screen = { exportData, setExportData, items, dbkItems, licenseItems }; showValidation opens the check window.
export function useSbFiling({ screen, stopForUnsavedEdits, showValidation }) {
  const [icegateState, setIcegateState] = useState(IDLE);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [validating, setValidating] = useState(false);
  const { exportData, setExportData, items } = screen;

  const clearIcegateState = () => setIcegateState(IDLE);

  // screen checks + job totals + the ICEGATE pre-check of the JSON that will be sent, in one window
  const validateJob = async () => {
    if (await stopForUnsavedEdits('validate')) return;
    const payload = { ...exportData };
    if (payload.invoices?.length) payload.invoices = invoicesWithItems(payload.invoices, items);
    const jobCheck = validateFullJob(payload);
    const screenErrors = validateIcegateRules(exportData, items, exportData.invoices || []);
    const errors = [...new Set([...screenErrors, ...jobCheck.errors].map((error) => `Screen: ${error}`))];
    let warnings = jobCheck.warnings.map((warning) => `Screen: ${warning}`);
    setValidating(true);
    try {
      const reply = await serverReply(exportEntryApi.previewSb(sbRequestOf(screen, { amendment: !!exportData._amend })));
      if (reply.success && reply.validation) {
        errors.push(...reply.validation.errors);
        warnings = [...warnings, ...reply.validation.warnings];
      } else {
        errors.push(`ICEGATE check: ${reply.error || 'could not build the SB'}`);
      }
    } catch (error) {
      errors.push(`ICEGATE check: server not reached (${errorMessage(error)})`);
    } finally {
      setValidating(false);
    }
    if (!errors.length && !warnings.length) toast.success('Job validated - no problems found');
    showValidation({ errors, warnings, title: errors.length ? 'Validate Job - fix before sending' : 'Validate Job' });
  };

  const startIcegateSend = async () => {
    // a job with an SB No was filed - sending it again would file a second Shipping Bill (the server stops it too)
    const filedSbNo = String(exportData.sbNo || exportData.sbNumber || '').trim();
    if (filedSbNo && !exportData._amend) {
      toast.error(`This job already has SB No ${filedSbNo}${exportData.sbDate ? ` dt ${exportData.sbDate}` : ''} - it was filed. For a change use Amend in the Export job list.`, { duration: 7000 });
      return;
    }
    if (await stopForUnsavedEdits('check and send the SB')) return;
    const screenErrors = screenRuleErrors(screen);
    let validation = { errors: [], warnings: [] };
    try {
      const reply = await serverReply(exportEntryApi.previewSb(sbRequestOf(screen, { amendment: !!exportData._amend })));
      if (!reply.success) {
        toast.error(`Validation error: ${reply.error || 'could not build the SB'}`);
        return;
      }
      validation = reply.validation || validation;
    } catch (error) {
      toast.error(`Could not validate: ${errorMessage(error)}`);
      return;
    }
    const findings = { errors: [...screenErrors, ...validation.errors], warnings: validation.warnings };
    if (findings.errors.length || findings.warnings.length) {
      showValidation({ ...findings, title: 'Shipping Bill - Pre-Validation', onContinue: () => setShowSubmitModal(true) });
      return;
    }
    setShowSubmitModal(true);
  };

  // "Download signed file (not sent)": the SB signed with the token exactly as Confirm Submit signs it, for a check on
  // ICEGATE's signer site - nothing goes to ICEGATE
  const downloadSignedFile = async (profileId, pin) => {
    try {
      const reply = await serverReply(exportEntryApi.signSbFile(sbRequestOf(screen, { profileId, pin, ...amendmentFields(exportData) })));
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

  // The submit window passes (profileId, pin, isAmendment, ...): its third value lands in resendOk, as it always did.
  const submitToIcegate = async (profileId, pin, resendOk = false) => {
    setIcegateState({ loading: true, result: null, error: null });
    try {
      const reply = await serverReply(exportEntryApi.submitSb(sbRequestOf(screen, {
        indicator: 'P',
        profileId,
        pin,
        ...(resendOk ? { resendOk: true } : {}),
        ...amendmentFields(exportData),
      })));
      if (reply.success) {
        setIcegateState({ loading: false, result: reply, error: null });
        setShowSubmitModal(false);
        // the job on screen follows the server (a later Save would send the old empty ICEGATE status back)
        setExportData((job) => {
          const filed = { ...job, icegateStatus: job._amend ? 'Amended' : 'Filed', icegateUniqueId: reply.uniqueId || job.icegateUniqueId, isAmended: !!job._amend };
          if (!filed.status || filed.status === 'DRAFT') filed.status = 'SUBMITTED';
          delete filed._amend;
          return filed;
        });
        return;
      }
      // sent before and accepted by ICEGATE, SB No not back yet: sent again only on the operator's word
      if (reply.sent && !resendOk && await askConfirm({ title: 'Send this SB again?', message: reply.error, okLabel: 'Send again', cancelLabel: 'Do not send', tone: 'danger' })) {
        await submitToIcegate(profileId, pin, true);
        return;
      }
      setIcegateState({ loading: false, result: null, error: reply.error || reply.details?.errorMessage || 'SB Filing failed' });
      if (reply.validation) {
        setShowSubmitModal(false);
        showValidation({ ...reply.validation, title: 'Shipping Bill - Not sent' });
      }
    } catch (error) {
      setIcegateState({ loading: false, result: null, error: `Network error: ${errorMessage(error)}` });
    }
  };

  return {
    icegateState, setIcegateState, clearIcegateState,
    showSubmitModal, setShowSubmitModal,
    validating,
    validateJob, startIcegateSend, downloadSignedFile, submitToIcegate,
  };
}
