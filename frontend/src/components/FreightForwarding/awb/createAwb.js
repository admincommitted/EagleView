// Save an AWB / MAWB / HAWB (new: createAwb, changed: updateAwb, void: voidAwb). The server answers 409 for a warning
// the operator may override, or for a reason it needs:
// - the number is not in the AWB stock (or is USED / VOID there) -> { okFlag: '_stockOk' }
// - the first carrier / flight is not the airline of the AWB prefix -> { okFlag: '_carrierOk' }
// - the AWB was already sent to the airline -> { needReason, reasonFlag: '_amendReason' | '_voidReason' }
//   (a departed one answers { flown } - a plain error: the correction then goes to the airline as a CCA)
import askConfirm, { askText } from '@/components/common/askConfirm';
import { freightApi } from '../freightApi';
import { showSuccessToast } from '../printLogic';

const MAX_ROUNDS = 5;
const AMENDED_NOTICE_DELAY_MS = 1200;
const SENT_NOTICE_DELAY_MS = 700;

const stoppedError = (message) => {
  const error = new Error(message);
  error.response = { data: { error: message } };
  return error;
};

async function withWarnings(send, payload) {
  let request = { ...payload };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    try {
      const response = await send(request);
      if (response?.data?.amended) {
        setTimeout(() => showSuccessToast('Amended', response.data.message || 'Saved as an amendment - send the XFWB / XFHL again.', false), AMENDED_NOTICE_DELAY_MS);
      }
      return response;
    } catch (error) {
      const answer = error?.response?.data;
      if (answer && answer.needReason && answer.reasonFlag && !request[answer.reasonFlag]) {
        const reason = await askText({
          title: 'Reason needed',
          message: answer.error,
          label: 'Reason (kept in the AWB log)',
          okLabel: 'Go on',
          cancelLabel: 'Do not go on',
        });
        if (reason && reason.trim()) { request = { ...request, [answer.reasonFlag]: reason.trim() }; continue; }
        throw stoppedError('Not done - no reason given. ' + answer.error);
      }
      const flag = answer && (answer.okFlag || (answer.stockWarning ? '_stockOk' : null));
      if (!flag || request[flag]) throw error;
      const saveAnyway = await askConfirm({ title: 'Save anyway?', message: answer.error, okLabel: 'Save anyway', cancelLabel: 'Do not save (check it)' });
      if (saveAnyway) { request = { ...request, [flag]: true }; continue; }
      throw stoppedError('Not saved - ' + answer.error);
    }
  }
  return send(request);
}

// the callers read the server's answer as response.data
const asResponse = (call) => async (request) => ({ data: await call(request) });

export const createAwb = (payload) => withWarnings(asResponse((request) => freightApi.createAwb(request)), payload);
export const updateAwb = (id, payload) => withWarnings(asResponse((request) => freightApi.updateAwb(id, request)), payload);
export const voidAwb = (id, payload) => withWarnings(asResponse((request) => freightApi.voidAwbWithReason(id, request)), payload);

// what to tell the operator when an AWB already sent to the airline is opened
export function sentNotice(awb) {
  const status = String((awb && (awb.status || awb.transmissionStatus)) || '').toUpperCase();
  // shown just after the "loaded" message (one message window at a time - this one matters more)
  if (status === 'TRANSMITTED') {
    setTimeout(() => showSuccessToast('Sent to the airline', 'This AWB has been sent (XFWB / XFHL). You can view and print it; a change is saved as an amendment with a reason and must be sent again. After the flight has left, corrections go as a CCA.', false), SENT_NOTICE_DELAY_MS);
  } else if (status === 'AMENDED') {
    setTimeout(() => showSuccessToast('Amended - not sent yet', 'This AWB was changed after it was sent to the airline. Send the XFWB / XFHL again.', false), SENT_NOTICE_DELAY_MS);
  }
}
