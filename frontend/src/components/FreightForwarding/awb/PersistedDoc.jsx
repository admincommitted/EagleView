// Keeps what is typed in a document window (DG declaration, SLI, DO, ...).
// This wrapper reads every input / select / textarea of the window when something changes and stores the values per
// document type in the AWB screen (extraDocs, saved with the AWB in table AwbExtraDocs). When the AWB is already
// saved, the document is also saved straight away. Opening the window puts the values back.
import { useEffect, useRef } from 'react';
import { DocCtx } from '../Modals/docKit';
import { freightApi } from '../freightApi';

const FIELDS = 'input, select, textarea';
const SKIPPED_TYPES = ['button', 'submit', 'reset', 'file', 'image', 'hidden'];
const FILL_DELAY_MS = 30;
const SAVE_DELAY_MS = 800;

const isSkipped = (element) => SKIPPED_TYPES.includes(String(element.type || '').toLowerCase());
const signatureOf = (element) => `${element.tagName}:${element.type || ''}:${element.name || element.placeholder || ''}`;
const isCheckable = (element) => element.type === 'checkbox' || element.type === 'radio';

function collect(root) {
  if (!root) return null;
  const fields = [];
  let anyFilled = false;
  root.querySelectorAll(FIELDS).forEach((element, index) => {
    if (isSkipped(element)) return;
    const value = isCheckable(element) ? !!element.checked : element.value;
    if (isCheckable(element) ? value : String(value || '').trim() !== '') anyFilled = true;
    fields.push({ i: index, s: signatureOf(element), v: value });
  });
  return anyFilled ? { fields, savedAt: new Date().toISOString() } : null;
}

// set a value the way React notices it (works for controlled and uncontrolled fields)
function setField(element, value) {
  if (isCheckable(element)) {
    if (!!element.checked !== !!value) element.click();
    return;
  }
  const prototypes = { SELECT: window.HTMLSelectElement.prototype, TEXTAREA: window.HTMLTextAreaElement.prototype };
  const prototype = prototypes[element.tagName] || window.HTMLInputElement.prototype;
  const setValue = Object.getOwnPropertyDescriptor(prototype, 'value').set;
  if (String(element.value) === String(value ?? '')) return;
  setValue.call(element, value ?? '');
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function fill(root, saved) {
  if (!root || !saved || !Array.isArray(saved.fields)) return;
  const elements = root.querySelectorAll(FIELDS);
  for (const field of saved.fields) {
    const element = elements[field.i];
    if (!element || isSkipped(element) || signatureOf(element) !== field.s) continue;
    // an empty saved value does not blank a field the window filled from the AWB
    if (typeof field.v === 'string' && field.v === '' && element.value) continue;
    setField(element, field.v);
  }
}

const saveToServer = async (awbType, awbId, docType, data) => {
  try {
    await freightApi.saveAwbExtraDoc(awbType, awbId, docType, data);
  } catch {
    // kept on the screen; saved again with the AWB
  }
};

export default function PersistedDoc({ docType, isOpen, extraDocs, setExtraDocs, awbId, awbType, children }) {
  const wrapperRef = useRef(null);
  const fillingRef = useRef(false);
  const saveTimerRef = useRef(null);
  const saved = extraDocs ? extraDocs[docType] : null;

  const fillQuietly = (root) => {
    fillingRef.current = true;
    try { fill(root, saved); } finally { fillingRef.current = false; }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => fillQuietly(wrapperRef.current), FILL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- fill once when the window opens

  // the document windows draw on top of the page (portal), outside this wrapper - find their sheet
  const sheetRoot = () => document.querySelector(`[data-doc-root="${docType}"]`) || wrapperRef.current;

  const capture = () => {
    if (fillingRef.current || !setExtraDocs) return;
    const data = collect(sheetRoot());
    setExtraDocs((previous) => ({ ...(previous || {}), [docType]: data }));
    if (!awbId) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveToServer(awbType, awbId, docType, data), SAVE_DELAY_MS);
  };

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const docApi = {
    docType,
    // the window calls this once it has filled the sheet from the AWB: what was typed before goes back on top
    restore: (element) => fillQuietly(element || sheetRoot()),
    capture,
  };
  return (
    <DocCtx.Provider value={docApi}>
      <div ref={wrapperRef} onInput={capture} onChange={capture} className="tw:contents">{children}</div>
    </DocCtx.Provider>
  );
}

// store one document (or list) in the screen and, when the AWB is saved already, in the database right away
export function saveExtraDoc(ctx, docType, data, awbId, awbType) {
  if (ctx && ctx.setExtraDocs) ctx.setExtraDocs((previous) => ({ ...(previous || {}), [docType]: data }));
  if (awbId) saveToServer(awbType, awbId, docType, data);
}