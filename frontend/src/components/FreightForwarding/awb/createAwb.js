// Save an AWB / MAWB / HAWB (new: createAwb, changed: updateAwb, void: voidAwb). The server answers 409 for a warning
// the operator may override, or for a reason it needs:
// - 10-Nov-2026: the number is not in the AWB stock (or is USED / VOID there) -> { okFlag: '_stockOk' }
// - 11-Nov-2026: the first carrier / flight is not the airline of the AWB prefix -> { okFlag: '_carrierOk' }
// - 11-Nov-2026: the AWB was already sent to the airline -> { needReason, reasonFlag: '_amendReason' | '_voidReason' }
//   (a departed one answers { flown } - a plain error: the correction then goes to the airline as a CCA)
import axios from 'axios';
import { showSuccessToast } from '../printLogic';

async function withWarnings(send, payload) {
  let p = { ...payload };
  for (let i = 0; i < 5; i++) {
    try {
      const r = await send(p);
      if (r && r.data && r.data.amended) setTimeout(() => showSuccessToast('Amended', r.data.message || 'Saved as an amendment - send the XFWB / XFHL again.', false), 1200);
      return r;
    } catch (e) {
      const d = e && e.response && e.response.data;
      if (d && d.needReason && d.reasonFlag && !p[d.reasonFlag]) {
        const why = window.prompt(d.error + '\n\nType the reason (kept in the AWB log). Cancel = do not go on.', '');
        if (why && why.trim()) { p = { ...p, [d.reasonFlag]: why.trim() }; continue; }
        const x = new Error('Not done - no reason given');
        x.response = { data: { error: 'Not done - no reason given. ' + d.error } };
        throw x;
      }
      const flag = d && (d.okFlag || (d.stockWarning ? '_stockOk' : null));
      if (!flag || p[flag]) throw e;
      if (window.confirm(d.error + '\n\nOK = save anyway\nCancel = do not save (check it)')) { p = { ...p, [flag]: true }; continue; }
      const x = new Error('Not saved - ' + d.error);
      x.response = { data: { error: 'Not saved - ' + d.error } };
      throw x;
    }
  }
  return send(p);
}

export const createAwb = (payload) => withWarnings((p) => axios.post('/api/awb/create', p), payload);
export const updateAwb = (id, payload) => withWarnings((p) => axios.put(`/api/awb/update/${id}`, p), payload);
export const voidAwb = (id, payload) => withWarnings((p) => axios.put(`/api/awb/void/${id}`, p), payload);

// what to tell the operator when an AWB already sent to the airline is opened
export function sentNotice(awb) {
  const st = String((awb && (awb.status || awb.transmissionStatus)) || '').toUpperCase();
  // shown just after the "loaded" message (one message window at a time - this one matters more)
  if (st === 'TRANSMITTED') setTimeout(() => showSuccessToast('Sent to the airline', 'This AWB has been sent (XFWB / XFHL). You can view and print it; a change is saved as an amendment with a reason and must be sent again. After the flight has left, corrections go as a CCA.', false), 700);
  else if (st === 'AMENDED') setTimeout(() => showSuccessToast('Amended - not sent yet', 'This AWB was changed after it was sent to the airline. Send the XFWB / XFHL again.', false), 700);
}
