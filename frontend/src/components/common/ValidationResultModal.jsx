// Shows ICEGATE pre-validation result: errors block sending, warnings can be accepted. Added 28-Oct-2026.
import React from 'react';
import { AlertTriangle, XCircle, CheckCircle, X } from 'lucide-react';
import BodyPortal from './BodyPortal';

export default function ValidationResultModal({ result, onClose }) {
  if (!result) return null;
  const errors = result.errors || [];
  const warnings = result.warnings || [];
  const canContinue = errors.length === 0 && typeof result.onContinue === 'function';
  const group = (list) => list.reduce((acc, line) => {
    const i = line.indexOf(': ');
    const k = i > 0 ? line.slice(0, i) : 'General';
    (acc[k] = acc[k] || []).push(i > 0 ? line.slice(i + 2) : line);
    return acc;
  }, {});
  const Section = ({ title, list, color, bg, Icon }) => (
    list.length ? (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color, fontSize: '13px', marginBottom: '6px' }}>
          <Icon size={16} /> {title} ({list.length})
        </div>
        {Object.entries(group(list)).map(([where, msgs]) => (
          <div key={where} style={{ background: bg, borderRadius: '6px', padding: '6px 10px', marginBottom: '6px' }}>
            <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-main, #0f172a)' }}>{where}</div>
            <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '12px', color: 'var(--text-main, #334155)' }}>
              {msgs.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        ))}
      </div>
    ) : null
  );
  // shown on <body> so a panel around the screen cannot cut it (29-Oct-2026)
  return (
    <BodyPortal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--bg-panel, #fff)', borderRadius: '12px', width: '100%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '14px' }}>{result.title || 'ICEGATE Pre-Validation'}</strong>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', padding: '4px', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
          {errors.length === 0 && warnings.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: 700 }}><CheckCircle size={16} /> No problems found.</div>
          )}
          <Section title="Errors - fix before sending" list={errors} color="#dc2626" bg="#fef2f2" Icon={XCircle} />
          <Section title="Warnings - please check" list={warnings} color="#b45309" bg="#fffbeb" Icon={AlertTriangle} />
        </div>
        <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--bg-panel, #fff)', fontWeight: 600, cursor: 'pointer' }}>{canContinue ? 'Cancel' : 'Close'}</button>
          {canContinue && (
            <button onClick={() => { const go = result.onContinue; onClose(); go(); }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              {result.continueLabel || (warnings.length ? 'Continue anyway' : 'Continue')}
            </button>
          )}
        </div>
      </div>
    </div>
    </BodyPortal>
  );
}
