import { useRef } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { chargeErrors, rateLineErrors, routeError } from '../../awbChecks';
import { createAwb, updateAwb } from '../../createAwb';
import { freightApi } from '../../../freightApi';
import { showSuccessToast } from '../../../printLogic';
import { buildMasterPayload } from './masterPayload';

const LINK_ERROR_TOAST_MS = 15000;

// the first problem that stops the save, else null
const saveProblem = (form) => {
  const { awbPrefix, awbSuffix, getAwbError, depAirport, destAirport, parties, rateLines, otherCharges } = form;
  if (!awbPrefix || !awbSuffix || awbPrefix.length < 3 || awbSuffix.length < 8) return 'Valid AWB Number is mandatory!';
  const checkDigitError = getAwbError();
  if (checkDigitError) return `AWB Check Digit Error: ${checkDigitError}`;
  const origin = depAirport || '';
  const destination = destAirport || '';
  if (origin.length !== 3 || destination.length !== 3) return 'Valid 3-letter Origin and Destination Airports are mandatory!';
  if (!parties['Shipper']?.name || !parties['Consignee']?.name) return 'Shipper and Consignee names are mandatory!';
  if (!rateLines.some((line) => line.grossWeight && parseFloat(line.grossWeight) > 0)) return 'At least one Rate Line with Gross Weight is mandatory!';
  const lineProblems = [routeError(origin, destination), ...rateLineErrors(rateLines), ...chargeErrors(otherCharges)].filter(Boolean);
  return lineProblems.length ? lineProblems.join('\n') : null;
};

// every linked house is (re)pointed at this master; a house that could not be linked is shown, not swallowed
const linkHousesToMaster = async (houses, masterAwbNumber, masterAwbId) => {
  const failed = [];
  for (const house of houses) {
    if (!house.id) continue;
    try {
      await freightApi.linkHawbToMaster(house.id, { masterAwbNumber, masterAwbId });
    } catch (error) {
      failed.push(`HAWB ${house.awb}: ${error?.response?.data?.error || error?.message || 'not linked'}`);
    }
  }
  return failed;
};

// SAVE: create or update the MAWB, then link its houses. Returns the AWB id (SEND XFWB / XFZB save first).
export default function useMasterSave(form) {
  const { currentAwbId, setCurrentAwbId, awbPrefix, awbSuffix, linkedHawbs, setLinkedHawbs } = form;
  const saving = useRef(false);

  const handleSaveToSQL = async () => {
    if (saving.current) return undefined;
    saving.current = true;
    try {
      const problem = saveProblem(form);
      if (problem) {
        showSuccessToast('Error', problem, true);
        return undefined;
      }
      const payload = buildMasterPayload(form);
      let response;
      if (currentAwbId) {
        response = await updateAwb(currentAwbId, payload);
        showSuccessToast('Success', 'AWB Updated in SQL Database Successfully!');
      } else {
        response = await createAwb(payload);
        setCurrentAwbId(response.data.awbId);
        showSuccessToast('Success', 'AWB Created in SQL Database Successfully!');
      }
      const savedId = currentAwbId || response.data.awbId;

      if (linkedHawbs?.length > 0) {
        const failed = await linkHousesToMaster(linkedHawbs, `${awbPrefix}-${awbSuffix}`, savedId);
        // a toast of its own: the save message box would cover a second box
        if (failed.length) {
          toast.error(`The AWB is saved, but ${failed.length === 1 ? 'this house was' : 'these houses were'} NOT linked:\n${failed.join('\n')}`, {
            duration: LINK_ERROR_TOAST_MS,
            className: 'tw:max-w-[520px] tw:whitespace-pre-line',
          });
        } else {
          setLinkedHawbs((previous) => (previous || []).map((house) => (house.local ? { ...house, local: false } : house)));
        }
      }
      return savedId;
    } catch (error) {
      console.error(error);
      showSuccessToast('Error', errorMessage(error) || 'Failed to save to database!', true);
      return undefined;
    } finally {
      saving.current = false;
    }
  };

  return { handleSaveToSQL };
}
