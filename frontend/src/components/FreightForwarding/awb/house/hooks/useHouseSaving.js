import { useRef } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { freightApi } from '../../../freightApi';
import { downloadAWBPDF, printAWB, showSuccessToast } from '../../../printLogic';
import { runEdiValidation } from '../../awbValidate';
import { createAwb, updateAwb, voidAwb } from '../../createAwb';
import { houseSavePayload, houseSaveProblem } from './housePayload';
import { loggedInUser } from './houseWaybillData';

const saveErrorText = (error) =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to save to database!';

// SAVE / VOID / LOGS / VALIDATE EDI / PRINT. form is the whole screen context (read when the button is pressed).
export default function useHouseSaving(form) {
  const savingRef = useRef(false);

  // one save at a time: a double click must not create the AWB twice. Returns the saved AWB id.
  const handleSaveToSQL = async () => {
    if (savingRef.current) return undefined;
    savingRef.current = true;
    try {
      const problem = houseSaveProblem(form);
      if (problem) {
        showSuccessToast('Error', problem, true);
        return undefined;
      }
      const payload = houseSavePayload(form);
      if (form.currentAwbId) {
        await updateAwb(form.currentAwbId, payload);
        showSuccessToast('Success', 'AWB Updated in SQL Database Successfully!');
        return form.currentAwbId;
      }
      const response = await createAwb(payload);
      form.setCurrentAwbId(response.data.awbId);
      showSuccessToast('Success', 'AWB Created in SQL Database Successfully!');
      return response.data.awbId;
    } catch (error) {
      console.error(error);
      showSuccessToast('Error', saveErrorText(error), true);
      return undefined;
    } finally {
      savingRef.current = false;
    }
  };

  const handleVoidAWB = async () => {
    if (!form.currentAwbId) {
      showSuccessToast('Error', 'No AWB loaded to void. Please save or modify first.', true);
      return;
    }
    const confirmed = await askConfirm({ title: 'Void AWB', message: 'Are you sure you want to VOID this AWB?', okLabel: 'Void', tone: 'danger' });
    if (!confirmed) return;
    try {
      await voidAwb(form.currentAwbId, { type: 'HAWB', user: loggedInUser() });
      showSuccessToast('Success', 'AWB successfully VOIDED.');
      form.handleClearForm();
    } catch (error) {
      showSuccessToast('Error', error?.response?.data?.error || 'Failed to void AWB.', true);
    }
  };

  // the house logs are kept under the HAWB number
  const handleViewLogs = async () => {
    if (!form.hawbNumber) {
      showSuccessToast('Error', 'No HAWB selected', true);
      return;
    }
    try {
      const answer = await freightApi.awbLogs(encodeURIComponent(form.hawbNumber));
      if (answer.success) {
        form.setLogsData(answer.data);
        form.setShowLogsModal(true);
      } else {
        showSuccessToast('Error', answer.message || 'Failed to fetch logs', true);
      }
    } catch {
      showSuccessToast('Error', 'Failed to fetch logs', true);
    }
  };

  const runIataValidation = () => runEdiValidation(form, 'HAWB');

  const handlePrintOptionsSubmit = ({ selectedCopies, includeTerms, actionType }) => {
    if (actionType === 'print') printAWB(selectedCopies, includeTerms);
    else if (actionType === 'pdf') downloadAWBPDF(selectedCopies, includeTerms);
  };

  return { handleSaveToSQL, handleVoidAWB, handleViewLogs, runIataValidation, handlePrintOptionsSubmit, getLoggedInUser: loggedInUser };
}
