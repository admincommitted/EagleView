// Keeps what is typed in a document window (DG declaration, SLI, DO, ...) - 29-Oct-2026.
// The windows were print-only: their inputs were not connected to anything and were empty again next time.
// This wrapper reads every input / select / textarea of the window when something changes and stores the values per
// document type in the AWB screen (extraDocs, saved with the AWB in table AwbExtraDocs). When the AWB is already
// saved, the document is also saved straight away (PUT /api/awb/extra/...). Opening the window puts the values back.
import React from 'react';
import { DocCtx } from '../Modals/docKit';

const FIELDS = 'input, select, textarea';
const skip = (el) => ['button', 'submit', 'reset', 'file', 'image', 'hidden'].includes(String(el.type || '').toLowerCase());
const sig = (el) => `${el.tagName}:${el.type || ''}:${el.name || el.placeholder || ''}`;

function collect(root) {
  if (!root) return null;
  const out = [];
  let any = false;
  root.querySelectorAll(FIELDS).forEach((el, i) => {
    if (skip(el)) return;
    const isCheck = el.type === 'checkbox' || el.type === 'radio';
    const v = isCheck ? !!el.checked : el.value;
    if (isCheck ? v : String(v || '').trim() !== '') any = true;
    out.push({ i, s: sig(el), v });
  });
  return any ? { fields: out, savedAt: new Date().toISOString() } : null;
}

// set a value the way React notices it (works for controlled and uncontrolled fields)
function setField(el, v) {
  if (el.type === 'checkbox' || el.type === 'radio') { if (!!el.checked !== !!v) el.click(); return; }
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  if (String(el.value) === String(v ?? '')) return;
  setter.call(el, v ?? '');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function fill(root, data) {
  if (!root || !data || !Array.isArray(data.fields)) return;
  const els = root.querySelectorAll(FIELDS);
  // 11-Nov-2026: an empty saved value does not blank a field the window filled from the AWB
  for (const f of data.fields) { const el = els[f.i]; if (el && !skip(el) && sig(el) === f.s && !(typeof f.v === 'string' && f.v === '' && el.value)) setField(el, f.v); }
}

export default function PersistedDoc({ docType, isOpen, extraDocs, setExtraDocs, awbId, awbType, children }) {
  const ref = React.useRef(null);
  const filling = React.useRef(false);
  const timer = React.useRef(null);
  const saved = extraDocs ? extraDocs[docType] : null;

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const t = setTimeout(() => { filling.current = true; try { fill(ref.current, saved); } finally { filling.current = false; } }, 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  // 11-Nov-2026: the document windows now draw on top of the page (portal), outside this wrapper - find their sheet
  const root = () => document.querySelector(`[data-doc-root="${docType}"]`) || ref.current;
  const capture = () => {
    if (filling.current || !setExtraDocs) return;
    const data = collect(root());
    setExtraDocs(prev => ({ ...(prev || {}), [docType]: data }));
    if (awbId) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const token = localStorage.getItem('token');
        fetch(`/api/awb/extra/${awbType}/${awbId}/${docType}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data }) }).catch(() => {});
      }, 800);
    }
  };
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const api = {
    docType,
    // the window calls this once it has filled the sheet from the AWB: what was typed before goes back on top
    restore: (el) => { filling.current = true; try { fill(el || root(), saved); } finally { filling.current = false; } },
    capture: () => capture(),
  };
  return <DocCtx.Provider value={api}><div ref={ref} onInput={capture} onChange={capture} style={{ display: 'contents' }}>{children}</div></DocCtx.Provider>;
}

// store one document (or list) in the screen and, when the AWB is saved already, in the database right away
export function saveExtraDoc(ctx, docType, data, awbId, awbType) {
  if (ctx && ctx.setExtraDocs) ctx.setExtraDocs(prev => ({ ...(prev || {}), [docType]: data }));
  if (awbId) {
    const token = localStorage.getItem('token');
    fetch(`/api/awb/extra/${awbType}/${awbId}/${docType}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data }) }).catch(() => {});
  }
}
