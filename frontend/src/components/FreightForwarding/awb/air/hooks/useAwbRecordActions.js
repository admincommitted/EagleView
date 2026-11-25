import askConfirm from '@/components/common/askConfirm';
import { freightApi } from '../../../freightApi';
import { downloadAWBPDF, printAWB, showSuccessToast } from '../../../printLogic';
import { runEdiValidation } from '../../awbValidate';
import { voidAwb } from '../../createAwb';
import { forgetDraft } from './useAwbDraft';

const showError = (message) => showSuccessToast('Error', message, true);

const VOID_PROMPT = { title: 'Void this AWB?', message: 'Are you sure you want to VOID this AWB?', okLabel: 'Void AWB', cancelLabel: 'Keep it', tone: 'danger' };

// CLEAR, VOID, VIEW LOGS, print and VALIDATE EDI of the AWB screen
export default function useAwbRecordActions(ctx) {
  const handlePrintOptionsSubmit = ({ selectedCopies, includeTerms, actionType }) => {
    if (actionType === 'print') printAWB(selectedCopies, includeTerms);
    else if (actionType === 'pdf') downloadAWBPDF(selectedCopies, includeTerms);
  };

  const runIataValidation = () => runEdiValidation(ctx, 'AWB');

  // a fresh screen: every box as on a new page (the screen is mounted again); no RESTORE DRAFT? prompt on it
  const handleClearForm = () => {
    forgetDraft();
    ctx.freshScreen();
    showSuccessToast('Info', 'Form Cleared.', false);
  };

  const handleVoidAWB = async () => {
    if (!ctx.currentAwbId) { showSuccessToast('Error', 'No AWB loaded to void. Please save or modify first.', true); return; }
    if (!(await askConfirm(VOID_PROMPT))) return;
    try {
      // a sent AWB asks for the reason
      await voidAwb(ctx.currentAwbId, { type: 'AWB', user: ctx.getLoggedInUser() });
      showSuccessToast('Success', 'AWB successfully VOIDED.');
      ctx.handleClearForm();
    } catch (error) {
      showError(error?.response?.data?.error || 'Failed to void AWB.');
    }
  };

  const handleViewLogs = async () => {
    const { awbPrefix, awbSuffix } = ctx;
    if (!awbPrefix || !awbSuffix) { showSuccessToast('Error', 'No AWB selected', true); return; }
    try {
      const answer = await freightApi.awbLogs(`${awbPrefix}-${awbSuffix}`);
      if (answer.success) {
        ctx.setLogsData(answer.data);
        ctx.setShowLogsModal(true);
      } else {
        showError(answer.message || 'Failed to fetch logs');
      }
    } catch {
      showError('Failed to fetch logs');
    }
  };

  return { handlePrintOptionsSubmit, runIataValidation, handleClearForm, handleVoidAWB, handleViewLogs };
}
