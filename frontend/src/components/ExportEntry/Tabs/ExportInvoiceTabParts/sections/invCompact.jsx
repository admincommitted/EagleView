// Compact layout pieces of the Invoice tab (29-Oct-2026): label beside the box, 26px boxes, thin section bands.
// Same look as the Items tab. Defined at module level so boxes keep the cursor while typing.
import React from 'react';
import KeySeg from '../../../../common/KeySeg';

export const Cell = ({ label, span, w, title, children }) => (
  <div className="ivd-cell" style={span ? { gridColumn: `span ${span}` } : undefined}>
    <span className="ivd-lbl" style={w ? { width: w, minWidth: w } : undefined} title={title || label}>{label}</span>
    <div className="ivd-ctl">{children}</div>
  </div>);

// keyboard: one Tab stop, arrow keys or the first letter change it
export const Seg = ({ value, options, onChange, title, style, btnStyle }) => (
  <KeySeg className="ivd-seg" value={value} options={options} onChange={onChange} title={title} style={style} btnStyle={btnStyle} />);

export const INV_CSS = `
.ivd { font-size: 12px; }
.ivd-box { border: 1px solid var(--border-color, #cbd5e1); border-radius: 6px; background: var(--bg-app, #f8fafc); overflow: visible; }
.ivd-band { display: flex; align-items: center; gap: 10px; padding: 4px 10px; background: var(--primary-bg-light, #f0f9ff); border-bottom: 1px solid #e2e8f0; color: var(--primary-color-start, #0ea5e9); font-weight: 700; font-size: 11.5px; letter-spacing: .03em; border-radius: 6px 6px 0 0; }
.ivd-band small { font-weight: 600; letter-spacing: 0; }
.ivd-body { padding: 6px 10px; display: grid; gap: 5px; }
.ivd-grid { display: grid; gap: 5px 12px; align-items: center; }
.ivd-cell { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ivd-lbl { width: 92px; min-width: 92px; font-size: 11px; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ivd-ctl { flex: 1; min-width: 0; display: flex; gap: 4px; align-items: center; }
.ivd input.input-field, .ivd select.input-field, .ivd .ivd-ctl input, .ivd .ivd-ctl select, .ivd .react-datepicker__input-container input { border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px; padding-left: 8px !important; height: 26px !important; min-height: 26px; padding-top: 0 !important; padding-bottom: 0 !important; font-size: 12px; box-sizing: border-box; width: 100%; }
.ivd-ctl > div { min-width: 0; }
.ivd-ro { background: #f1f5f9 !important; color: #475569; }
.ivd-sub { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: .06em; }
.ivd-seg { display: inline-flex; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px; overflow: hidden; height: 26px; flex-shrink: 0; }
.ivd-seg button { border: none; border-right: 1px solid #e2e8f0; background: #fff; padding: 0 10px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; }
.ivd-seg button:last-child { border-right: none; }
.ivd-seg button.on { background: #0ea5e9; color: #fff; }
.ivd button:focus-visible { outline: 2px solid #0ea5e9; outline-offset: 1px; position: relative; z-index: 1; }
.ivd-tbl { width: 100%; border-collapse: collapse; }
.ivd-tbl th { text-align: left; font-size: 10.5px; font-weight: 700; color: #64748b; padding: 2px 4px; border-bottom: 1px solid #e2e8f0; }
.ivd-tbl td { padding: 2px 4px !important; height: 30px; border: none !important; }
.ivd-tbl tr { height: 30px; }
.ivd-tbl td:first-child { font-size: 11px; font-weight: 600; color: #334155; white-space: nowrap; }
.ivd-tbl input { margin: 0 !important; height: 26px !important; padding-top: 0 !important; padding-bottom: 0 !important; width: 100%; box-sizing: border-box; font-size: 12px; }
.ivd-btns { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 10px; background: var(--primary-bg-light, #f0f9ff); border: 1px solid #bae6fd; border-radius: 6px; }
.ivd-btns .btn { height: 28px; padding: 0 10px !important; font-size: 11.5px !important; display: inline-flex; align-items: center; gap: 4px; }
`;
