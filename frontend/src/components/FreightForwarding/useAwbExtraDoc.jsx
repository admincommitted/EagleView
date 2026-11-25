import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { freightApi } from './freightApi';

// Keeps a printable AWB document (Delivery Order, SLI, Consignment Security Declaration) with its AWB
// (/awb/extra/AWB/:id/:docType). The fields are walked out of the DOM rather than lifted into React state: the
// templates are printed as they stand and have dozens of unnamed boxes, so a DOM walk keeps the markup untouched.
const FIELDS = 'input, select, textarea';
const SKIPPED_TYPES = ['button', 'submit', 'file'];
const fieldKey = (element, index) => index + '|' + element.tagName + '|' + (element.type || '') + '|' + (element.name || element.placeholder || '');
const isCheck = (element) => element.type === 'checkbox' || element.type === 'radio';
const plainNumber = (value) => String(value || '').replace(/[^0-9A-Za-z]/g, '');

function eachField(root, visit) {
  root.querySelectorAll(FIELDS).forEach((element, index) => {
    if (!SKIPPED_TYPES.includes(String(element.type || ''))) visit(element, index);
  });
}

export default function useAwbExtraDoc(awbNumber, docType, formRef) {
  const [awbId, setAwbId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [lookupDone, setLookupDone] = useState(false);

  // find the AWB this document belongs to; without it the window still prints, it just cannot save
  useEffect(() => {
    const number = String(awbNumber || '').trim();
    if (!number) { setLookupDone(true); return undefined; }
    let cancelled = false;
    const findAwb = async () => {
      try {
        const answer = await freightApi.awbList(500);
        const list = Array.isArray(answer) ? answer : (answer.data || []);
        const hit = list.find((awb) => plainNumber(awb.awbNumber || awb.fullAwbNumber || awb.awbNo) === plainNumber(number));
        if (!cancelled) setAwbId(hit ? hit.id : null);
      } catch {
        // the window still prints without the AWB id
      }
      if (!cancelled) setLookupDone(true);
    };
    findAwb();
    return () => { cancelled = true; };
  }, [awbNumber]);

  // put a previously saved copy back on screen (nothing saved before is the normal case)
  useEffect(() => {
    if (!awbId || !formRef.current) return undefined;
    let cancelled = false;
    const restore = async () => {
      try {
        const answer = await freightApi.awbExtraDoc('AWB', awbId, docType);
        const fields = Array.isArray(answer?.data?.fields) ? answer.data.fields : null;
        if (!fields || cancelled || !formRef.current) return;
        const savedValues = new Map(fields.map((field) => [field.k, field.v]));
        eachField(formRef.current, (element, index) => {
          const value = savedValues.get(fieldKey(element, index));
          if (value === undefined) return;
          if (isCheck(element)) element.checked = Boolean(value);
          else element.value = value == null ? '' : value;
        });
        if (answer.updatedAt) setSavedAt(answer.updatedAt);
      } catch {
        // nothing to put back
      }
    };
    restore();
    return () => { cancelled = true; };
  }, [awbId, docType, formRef]);

  const save = async () => {
    if (!String(awbNumber || '').trim()) { toast.error('Open this from an AWB - the document is kept with its AWB'); return; }
    if (!awbId) {
      toast.error(lookupDone
        ? 'AWB ' + awbNumber + ' is not saved yet, so there is nothing to keep this with. Save the AWB first.'
        : 'Still looking up the AWB, try again in a moment');
      return;
    }
    if (!formRef.current) return;
    setBusy(true);
    try {
      const fields = [];
      eachField(formRef.current, (element, index) => fields.push({ k: fieldKey(element, index), v: isCheck(element) ? Boolean(element.checked) : element.value }));
      await freightApi.saveAwbExtraDoc('AWB', awbId, docType, { fields, savedAt: new Date().toISOString() });
      setSavedAt(new Date().toISOString());
      toast.success('Kept with AWB ' + awbNumber + ' - it comes back filled in next time');
    } catch (error) {
      toast.error('Could not save: ' + (error.response ? error.response.data?.error || 'HTTP ' + error.response.status : error.message));
    }
    setBusy(false);
  };

  return { awbId, busy, save, savedAt, canSave: Boolean(awbId) };
}
