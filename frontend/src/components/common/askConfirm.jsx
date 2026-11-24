// A question window in the EagleView style, used in place of the browser's own "localhost:5174 says ... OK / Cancel"
// box (20-Nov-2026). That box could not name its buttons, so the text had to say "OK = ..., Cancel = ...".
//
//   const go = await askConfirm({ title, message, note, okLabel, cancelLabel });   // true = the okLabel button
//
// The safe button (cancelLabel) has the focus, so a stray Enter does not go ahead. Esc, the X and a click outside the
// window are the same as the safe button. Only one window at a time: a second question asked while one is open is
// answered "no" at once (a double click on Save must not stack two windows).
//
// 20-Nov-2026: askText() is the same window with a box to type in (or a list to pick from), in place of the browser's
// prompt(). It resolves the text typed, or null for Cancel.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AlertTriangle, PenLine, X } from 'lucide-react';

// the focus goes back to what had it - unless the next window is already open (two questions one after the other)
function giveFocusBack(el) {
  try { if (document.querySelectorAll('[data-ask-confirm]').length <= 1 && el && el.focus) el.focus(); } catch (e) { /* gone */ }
}

const TONES = {
  warn: { icon: '#b45309', iconBg: '#fef3c7', okText: '#92400e', okBorder: '#f59e0b', okBg: '#fffbeb' },
  danger: { icon: '#b91c1c', iconBg: '#fee2e2', okText: '#991b1b', okBorder: '#f87171', okBg: '#fef2f2' },
};

function ConfirmWindow({ title, message, note, okLabel, cancelLabel, tone, onDone }) {
  const safeRef = useRef(null);
  const t = TONES[tone] || TONES.warn;
  useEffect(() => {
    const before = document.activeElement;
    if (safeRef.current) safeRef.current.focus();
    // capture: the screens have their own Esc handlers (JSON preview, menus) - Esc here only closes this window
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(false); return; }
      if (e.key === 'Tab') { // keep the focus on the two buttons
        const b = Array.from(document.querySelectorAll('[data-ask-confirm] button[data-ask-btn]'));
        if (!b.length) return;
        const i = b.indexOf(document.activeElement);
        e.preventDefault();
        b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); giveFocusBack(before); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const btn = { minHeight: '32px', padding: '6px 16px', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.2px' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2147483600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onDone(false); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="ask-confirm-title" aria-describedby="ask-confirm-text"
        style={{ background: '#fff', borderRadius: '8px', width: '470px', maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden', color: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: t.iconBg, color: t.icon, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><AlertTriangle size={16} /></span>
          <strong id="ask-confirm-title" style={{ fontSize: '14px', flex: 1 }}>{title || 'Please confirm'}</strong>
          <button type="button" onClick={() => onDone(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}><X size={18} /></button>
        </div>
        <div id="ask-confirm-text" style={{ padding: '14px 16px 12px', display: 'grid', gap: '10px' }}>
          <div style={{ fontSize: '13px', lineHeight: 1.5, fontWeight: 600, whiteSpace: 'pre-line' }}>{message}</div>
          {/* one line per button: "Button name: what it does" - the name is bold */}
          {note && <div style={{ fontSize: '11.5px', lineHeight: 1.6, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', display: 'grid', gap: '4px' }}>
            {String(note).split('\n').map((s, i) => { const k = s.indexOf(': '); return <div key={i}>{k > 0 && k < 45 ? <><b style={{ color: '#0f172a' }}>{s.slice(0, k)}</b>{s.slice(k)}</> : s}</div>; })}
          </div>}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
          <button type="button" data-ask-btn="ok" onClick={() => onDone(true)}
            style={{ ...btn, background: t.okBg, color: t.okText, border: '1px solid ' + t.okBorder }}>{okLabel || 'OK'}</button>
          <button type="button" data-ask-btn="safe" ref={safeRef} onClick={() => onDone(false)}
            style={{ ...btn, background: '#0f766e', color: '#fff', border: '1px solid #0f766e', outlineOffset: '2px' }}>{cancelLabel || 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}

// The input window. value = the text already in the box; choices = [{ value, label }] shows a list instead of a box;
// check(text) returns '' or a message shown under the box (the window stays open); required: false lets OK take a blank.
function TextWindow({ title, message, note, label, value, placeholder, okLabel, cancelLabel, required, choices, check, upper, onDone }) {
  const list = Array.isArray(choices) && choices.length ? choices : null;
  const [v, setV] = useState(value !== undefined && value !== null ? String(value) : (list ? String(list[0].value) : ''));
  const [err, setErr] = useState('');
  const fieldRef = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const f = fieldRef.current;
    if (f) { f.focus(); if (f.select && !list) f.select(); }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(null); return; }
      if (e.key === 'Tab') { // keep the focus inside the window
        const b = Array.from(document.querySelectorAll('[data-ask-confirm] [data-ask-focus]'));
        if (!b.length) return;
        const i = b.indexOf(document.activeElement);
        e.preventDefault();
        b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); giveFocusBack(before); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e) => {
    if (e) e.preventDefault();
    const t = String(v ?? '').trim();
    if (required !== false && !t) { setErr('Please fill this in'); return; }
    const bad = typeof check === 'function' ? check(t) : '';
    if (bad) { setErr(bad); return; }
    onDone(t);
  };
  const btn = { minHeight: '32px', padding: '6px 16px', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.2px' };
  const box = { width: '100%', boxSizing: 'border-box', border: '1px solid ' + (err ? '#f87171' : '#cbd5e1'), borderRadius: '6px', padding: '7px 10px', fontSize: '13px', color: '#0f172a', background: '#fff', outlineOffset: '1px' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2147483600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onDone(null); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="ask-text-title" onSubmit={submit}
        style={{ background: '#fff', borderRadius: '8px', width: '470px', maxWidth: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', overflow: 'hidden', color: '#0f172a', margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ccfbf1', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><PenLine size={15} /></span>
          <strong id="ask-text-title" style={{ fontSize: '14px', flex: 1 }}>{title || 'Please type'}</strong>
          <button type="button" onClick={() => onDone(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '14px 16px 12px', display: 'grid', gap: '10px' }}>
          {message && <div style={{ fontSize: '13px', lineHeight: 1.5, fontWeight: 600, whiteSpace: 'pre-line' }}>{message}</div>}
          <label style={{ display: 'grid', gap: '5px', fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>
            {label || (list ? 'Pick one' : 'Value')}
            {list ? (
              <select data-ask-focus ref={fieldRef} value={v} size={Math.min(8, Math.max(3, list.length))} onChange={(e) => { setV(e.target.value); setErr(''); }}
                onDoubleClick={() => submit()} style={{ ...box, padding: '4px' }}>
                {list.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label || String(o.value)}</option>)}
              </select>
            ) : (
              <input data-ask-focus ref={fieldRef} value={v} placeholder={placeholder || ''} autoComplete="off" spellCheck={false}
                onChange={(e) => { setV(upper ? e.target.value.toUpperCase() : e.target.value); setErr(''); }} style={box} />
            )}
          </label>
          {err && <div role="alert" style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c' }}>{err}</div>}
          {note && <div style={{ fontSize: '11.5px', lineHeight: 1.6, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', whiteSpace: 'pre-line' }}>{note}</div>}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
          <button type="button" data-ask-focus data-ask-btn="cancel" onClick={() => onDone(null)}
            style={{ ...btn, background: '#fff', color: '#334155', border: '1px solid #cbd5e1' }}>{cancelLabel || 'Cancel'}</button>
          <button type="submit" data-ask-focus data-ask-btn="ok"
            style={{ ...btn, background: '#0f766e', color: '#fff', border: '1px solid #0f766e', outlineOffset: '2px' }}>{okLabel || 'OK'}</button>
        </div>
      </form>
    </div>
  );
}

let openNow = false;
// draws one window on <body>; resolves what the window answers (busy = the answer when another window is open)
function openWindow(Win, opts, busy, wrap) {
  if (typeof document === 'undefined' || !document.body) return Promise.resolve(busy);
  if (openNow) return Promise.resolve(busy);
  openNow = true;
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-ask-confirm', '');
    document.body.appendChild(host);
    const root = createRoot(host);
    let done = false;
    const finish = (v) => {
      if (done) return; done = true;
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
      openNow = false;
      resolve(wrap(v));
    };
    // drawn at once, so a second click on the button that asked lands on this window, not on the button
    flushSync(() => root.render(<Win {...opts} onDone={finish} />));
  });
}
export default function askConfirm(opts = {}) { return openWindow(ConfirmWindow, opts, false, (v) => !!v); }
export { askConfirm };
export function askText(opts = {}) { return openWindow(TextWindow, opts, null, (v) => (v === null || v === undefined ? null : String(v))); }

// "X has changes that were not put in with MODIFY" before a job is saved / checked / built / filed.
// what = 'build the file', 'validate' ... ; back = the button that keeps the changes on the screen.
export function askUnsavedEdits(msg, what, back = 'Go back to MODIFY') {
  const w = String(what || 'go ahead');
  const W = w.charAt(0).toUpperCase() + w.slice(1);
  return askConfirm({
    title: 'Changes not put in',
    message: msg,
    note: W + ' anyway: uses the values already put in - the changes on the screen are left out.\n'
      + back + ': the changes stay on the screen - press ' + String(back).replace(/^go back to /i, '') + ' first, then ' + w + ' again.',
    okLabel: W + ' anyway',
    cancelLabel: back,
  });
}
