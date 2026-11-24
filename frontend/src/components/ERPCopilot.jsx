import React, { useState, useRef, useEffect } from 'react';

// 30-Oct-2026: the Send button and the message box did nothing - the panel showed one hardcoded
// greeting ("Try asking me to optimize the routing or check weather risks!") and that was all it
// could ever say. There is a real chatbot behind /api/chatbot, so it talks to that now, and the
// greeting no longer promises routing optimisation or weather risk, neither of which exists here.
export default function ERPCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bodyRef = useRef(null);

  const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };

  // the last conversation comes back when the panel is opened, so it is not lost on a page change
  useEffect(() => {
    if (!isOpen || loaded) return;
    (async () => {
      try {
        const r = await fetch('/api/chatbot/history', { headers: auth() });
        const j = await r.json().catch(() => ({}));
        setMessages((j && j.data) || []);
      } catch (err) { /* an empty history is fine */ }
      setLoaded(true);
    })();
  }, [isOpen, loaded]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setText('');
    // show what was asked straight away, then the answer when it comes
    setMessages(m => [...m, { id: 'local-' + Date.now(), role: 'user', text: t }]);
    setSending(true);
    try {
      const r = await fetch('/api/chatbot/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ text: t, page: window.location.pathname }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(j.error || ('HTTP ' + r.status));
      // the server returns both the question and the answer with their real ids
      setMessages(m => [...m.filter(x => !String(x.id).startsWith('local-')), ...(j.data || [])]);
    } catch (err) {
      setMessages(m => [...m, { id: 'err-' + Date.now(), role: 'bot', text: 'Could not reach the assistant: ' + err.message }]);
    }
    setSending(false);
  };

  return (
    <>
      {/* Floating Copilot Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 9999,
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '24px',
            boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>??</span> ERP Copilot
        </button>
      )}

      {/* Copilot Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '70px',
          left: '20px',
          width: '320px',
          height: '420px',
          background: 'var(--text-main, var(--text-main, #1e293b))',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #000000'
        }}>
          {/* Header */}
          <div style={{
            background: '#4f46e5',
            color: '#fff',
            padding: '12px',
            fontWeight: 'bold',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>?? AI ERP Copilot</span>
            <span 
              onClick={() => setIsOpen(false)}
              style={{ cursor: 'pointer', fontSize: '16px' }}
            >
              ?
            </span>
          </div>

          {/* Body */}
          <div ref={bodyRef} style={{
            flex: 1,
            padding: '12px',
            overflowY: 'auto',
            color: 'var(--primary-bg-light, #e0f2fe)',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {!messages.length && (
              <div style={{
                background: '#334155',
                padding: '8px 12px',
                borderRadius: '8px',
                alignSelf: 'flex-start',
                maxWidth: '85%'
              }}>
                Ask me about a job, a party, a BE or SB, duty, or where something is in the system.
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} style={{
                background: m.role === 'user' ? '#4f46e5' : '#334155',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                whiteSpace: 'pre-wrap'
              }}>
                {m.text}
              </div>
            ))}
            {sending && (
              <div style={{ background: '#334155', padding: '8px 12px', borderRadius: '8px', alignSelf: 'flex-start', opacity: 0.7 }}>
                thinking...
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: '10px',
            background: 'var(--text-main, var(--text-main, #0f172a))',
            borderTop: '1px solid #334155',
            display: 'flex',
            gap: '8px'
          }}>
            <input 
              type="text" 
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="Ask about a job, party, BE / SB, duty..." 
              style={{
                flex: 1,
                background: 'var(--text-main, var(--text-main, #1e293b))',
                border: '1px solid #000000',
                color: '#fff',
                padding: '8px',
                borderRadius: '4px',
                outline: 'none',
                fontSize: '13px'
              }} 
            />
            <button onClick={send} disabled={sending || !text.trim()} style={{
              background: sending || !text.trim() ? '#64748b' : '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0 12px',
              cursor: sending || !text.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
