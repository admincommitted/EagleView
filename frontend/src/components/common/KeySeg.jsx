import React, { useRef } from 'react';

// Segmented choice (FOB | CI | CIF | CF ...) that works from the keyboard (29-Oct-2026):
// Tab stops once on the chosen option; Left / Right arrows change it; typing a letter picks the next option that
// starts with it (C -> CI -> CIF -> CF); Space / Enter / click choose. options: ['A', 'B'] or [['Y', 'Yes'], ['N', 'No']].
export default function KeySeg({ value, options, onChange, className, title, style, btnStyle }) {
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  const cur = opts.findIndex((o) => o[0] === value);
  const refs = useRef([]);
  const pick = (n) => { onChange(opts[n][0]); setTimeout(() => refs.current[n] && refs.current[n].focus(), 0); };
  const onKey = (e, i) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick((i + 1) % opts.length); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick((i - 1 + opts.length) % opts.length); }
    else if (e.key.length === 1 && /[a-z0-9%]/i.test(e.key) && !e.ctrlKey && !e.altKey) {
      const k = e.key.toUpperCase();
      for (let d = 1; d <= opts.length; d++) { const n = (i + d) % opts.length; if (String(opts[n][1]).toUpperCase().startsWith(k) || String(opts[n][0]).toUpperCase().startsWith(k)) { e.preventDefault(); pick(n); return; } }
    }
  };
  return (
    <div className={className} role="radiogroup" title={title} style={style}>
      {opts.map(([v, l], i) => (
        <button key={v} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={v === value}
          tabIndex={i === (cur >= 0 ? cur : 0) ? 0 : -1} className={v === value ? 'on' : ''} style={btnStyle}
          onClick={() => onChange(v)} onKeyDown={(e) => onKey(e, i)}>{l}</button>
      ))}
    </div>);
}
