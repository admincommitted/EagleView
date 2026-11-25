import { errorMessage } from '@/services/axiosInstance';
import { showSuccessToast } from '../../../printLogic';
import { chargeErrors, rateLineErrors, routeError } from '../../awbChecks';
import { createAwb, updateAwb } from '../../createAwb';
import { buildAwbPayload } from './airWaybillPayload';

const showError = (message) => showSuccessToast('Error', message, true);

// the first problem that stops the save, or null
function saveProblem(ctx) {
  const { awbPrefix, awbSuffix, depAirport, destAirport, parties, rateLines, otherCharges } = ctx;
  if (!awbPrefix || !awbSuffix || awbPrefix.length < 3 || awbSuffix.length < 8) return 'Valid AWB Number is mandatory!';
  const checkDigitError = ctx.getAwbError();
  if (checkDigitError) return `AWB Check Digit Error: ${checkDigitError}`;
  const origin = depAirport || '';
  const destination = destAirport || '';
  if (origin.length !== 3 || destination.length !== 3) return 'Valid 3-letter Origin and Destination Airports are mandatory!';
  if (!parties.Shipper?.name || !parties.Consignee?.name) return 'Shipper and Consignee names are mandatory!';
  if (!rateLines.some((line) => line.grossWeight && parseFloat(line.grossWeight) > 0)) return 'At least one Rate Line with Gross Weight is mandatory!';
  const moreErrors = [routeError(origin, destination), ...rateLineErrors(rateLines), ...chargeErrors(otherCharges)].filter(Boolean);
  return moreErrors.length ? moreErrors.join('\n') : null;
}

export default function useAwbSave(ctx) {
  // returns the saved record's id (SEND XFWB saves first, then sends this one); nothing when the save stopped
  const handleSaveToSQL = async () => {
    if (ctx.isSaving) return undefined;
    ctx.setIsSaving(true);
    try {
      const problem = saveProblem(ctx);
      if (problem) { showError(problem); return undefined; }
      const payload = buildAwbPayload(ctx);
      if (ctx.currentAwbId) {
        await updateAwb(ctx.currentAwbId, payload);
        showSuccessToast('Success', 'AWB Updated in SQL Database Successfully!');
        return ctx.currentAwbId;
      }
      const response = await createAwb(payload);
      ctx.setCurrentAwbId(response.data.awbId);
      showSuccessToast('Success', 'AWB Created in SQL Database Successfully!');
      return response.data.awbId;
    } catch (error) {
      console.error(error);
      showError(errorMessage(error) || 'Failed to save to database!');
      return undefined;
    } finally {
      ctx.setIsSaving(false);
    }
  };

  return { handleSaveToSQL };
}
