import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div className="glass-panel" style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '600px',
        maxWidth: '90vw',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '0.75rem 1rem', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'var(--bg-app, var(--bg-app, #f8fafc))', 
          borderTopLeftRadius: '8px', 
          borderTopRightRadius: '8px' 
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--primary-color)' }}>{title}</h3>
          <X size={16} style={{ cursor: 'pointer', color: 'var(--text-muted, var(--text-muted, #64748b))' }} onClick={onClose} />
        </div>
        
        {/* Body */}
        <div style={{ padding: '1rem' }}>
          {children}
        </div>
        
        {/* Footer */}
        <div style={{ 
          padding: '0.75rem 1rem', 
          borderTop: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '0.5rem', 
          background: 'var(--bg-app, var(--bg-app, #f8fafc))', 
          borderBottomLeftRadius: '8px', 
          borderBottomRightRadius: '8px' 
        }}>
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '0.25rem 1rem' }}>OK</button>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.25rem 1rem' }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
