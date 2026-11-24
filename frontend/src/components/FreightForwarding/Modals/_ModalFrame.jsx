// Shared frame for the small AWB windows (29-Oct-2026): title bar, body, footer with Close.
import React from 'react';

export default function ModalFrame({ title, width = 560, onClose, children, footer }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} role="dialog" aria-label={title}>
      <div style={{ backgroundColor: '#eef2f6', border: '1px solid #000000', borderRadius: '4px', width: `${width}px`, maxWidth: 'calc(100vw - 24px)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ backgroundColor: 'var(--text-muted, #64748b)', padding: '6px 12px', borderBottom: '1px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{title}</span>
          <button onClick={onClose} title="Close" style={{ background: 'white', border: '1px solid #000000', cursor: 'pointer', padding: '0 6px', fontSize: '12px' }}>X</button>
        </div>
        <div style={{ padding: '8px', overflowY: 'auto' }}>{children}</div>
        <div style={{ padding: '8px', borderTop: '1px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--primary-bg-light, #e0f2fe)', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#475569' }}>{footer}</span>
          <button onClick={onClose} style={{ padding: '4px 16px', backgroundColor: '#f8fafc', border: '1px solid #000000', borderRadius: '2px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export const inp = { width: '100%', padding: '4px', border: '1px solid #000000', fontSize: '12px', boxSizing: 'border-box' };
export const sel = { ...inp, border: '2px solid #0ea5e9', color: 'var(--primary-color-end, #2563eb)' };
export const lab = { fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '2px' };
export const addBtn = { backgroundColor: 'var(--primary-color-end, #2563eb)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-end' };
export const th = { padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e2e8f0', fontWeight: 600, fontSize: '11px', background: '#f8fafc' };
export const td = { padding: '4px 8px', borderTop: '1px solid #e2e8f0', fontSize: '12px' };
export const delBtn = { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700 };
