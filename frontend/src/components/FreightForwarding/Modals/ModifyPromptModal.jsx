import React, { useState, useEffect } from 'react';

export default function ModifyPromptModal({ isOpen, onClose, onSubmit, type = "MAWB" }) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (isOpen) setInputValue("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSubmit(inputValue.trim());
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Modify {type}
        </h3>
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Enter {type} Number to modify (e.g. {type === 'HAWB' ? 'H123456' : '125-12345678'}):</p>
        
        <form onSubmit={handleSubmit}>
          <input 
            autoFocus
            type="text" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            placeholder={`${type} Number`}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '20px', fontSize: '14px', outline: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#475569', fontSize: '12px' }}>CANCEL</button>
            <button type="submit" style={{ padding: '8px 16px', border: 'none', backgroundColor: '#3b82f6', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>SEARCH</button>
          </div>
        </form>
      </div>
    </div>
  );
}


