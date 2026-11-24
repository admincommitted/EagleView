// "What is still to fill" line for the three AWB screens (22-Nov-2026).
// It reads the screen: every box drawn with the red "must fill" border that is still empty is listed by its label;
// a click on a name puts the cursor in that box. It is only the count of the red boxes - the full e-AWB check is
// still VALIDATE EDI (the "Full check" link). Nothing is saved or changed by this line.
import React from 'react';

const RED = /rgb\(239, 68, 68\)|#ef4444/i;

function labelOf(el) {
  const party = el.closest('.party-row-container');
  let t = '';
  const cell = el.closest('div');
  let lab = null;
  for (let n = el.parentElement, i = 0; n && i < 4 && !lab; n = n.parentElement, i++) lab = n.querySelector(':scope > label, :scope > span > label');
  if (lab) t = lab.textContent;
  if (!t && cell && cell.previousElementSibling && cell.previousElementSibling.tagName === 'LABEL') t = cell.previousElementSibling.textContent;
  if (!t) t = el.getAttribute('placeholder') || el.getAttribute('name') || 'Box';
  t = String(t).replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  if (/^prefi/i.test(t) || /digit no/i.test(t)) t = /create-hawb/.test(window.location.pathname) ? 'MAWB No' : 'AWB No';
  if (/DEL001/i.test(t)) t = 'HAWB No';
  if (party && party.getAttribute('data-title')) t = party.getAttribute('data-title') + ' ' + t.toLowerCase();
  return t;
}

function scan() {
  const root = document.querySelector('.main-content') || document;
  const out = [];
  root.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.disabled || el.readOnly || el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden') return;
    if (!el.offsetParent) return;
    const st = (el.getAttribute('style') || '');
    if (!RED.test(st)) return;
    if (String(el.value || '').trim() !== '') return;
    const label = labelOf(el);
    if (!out.some((o) => o.label === label)) out.push({ label, el });
  });
  return out;
}

export default function MissingStrip({ ctx, align }) {
  const [list, setList] = React.useState([]);
  const keyRef = React.useRef('');
  React.useEffect(() => {
    const run = () => {
      const now = scan();
      const key = now.map((o) => o.label).join('|');
      if (key !== keyRef.current) { keyRef.current = key; setList(now); }
    };
    run();
    const t = setInterval(run, 1200);
    return () => clearInterval(t);
  }, []);
  const go = (label) => {
    const hit = scan().find((o) => o.label === label);
    if (hit && hit.el) { hit.el.scrollIntoView({ block: 'center' }); hit.el.focus(); }
  };
  const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#b91c1c', textDecoration: 'underline', whiteSpace: 'nowrap', height: 'auto' };
  const shown = list.slice(0, 6);
  return (
    <div className="awb-missing" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: align || 'flex-end', gap: '2px 8px', fontSize: '11px', lineHeight: 1.5 }}>
      {list.length === 0
        ? <span style={{ color: '#15803d', fontWeight: 600 }}>Must-fill boxes are filled</span>
        : <>
            <span style={{ color: '#b91c1c', fontWeight: 700 }}>{list.length} to fill:</span>
            {shown.map((o) => <button key={o.label} type="button" tabIndex={-1} style={link} title={'Go to ' + o.label} onClick={() => go(o.label)}>{o.label}</button>)}
            {list.length > shown.length && <span style={{ color: '#b91c1c' }}>+{list.length - shown.length} more</span>}
          </>}
      <button type="button" tabIndex={-1} onClick={() => ctx && ctx.runIataValidation && ctx.runIataValidation()} title="Full e-AWB check (same as VALIDATE EDI)" style={{ ...link, color: 'var(--theme-base, #0284c7)', textDecoration: 'none' }}>Full check</button>
    </div>
  );
}
