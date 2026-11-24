import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, User, Loader2, Trash2 } from 'lucide-react';

// 28-Oct-2026: the assistant now answers from the database (/api/chatbot: job / BE / SB / importer / summary / duty /
// exchange rate, Gemini for general questions) and every message is saved per user, so the chat comes back after a
// reload or on another computer. It used to reply with one fixed sentence and forgot everything on refresh.
const WELCOME = { id: 'welcome', text: "Hi there! I'm your Eagleview AI Assistant. Ask me about a job no, BE / SB no, importer, today's summary, a duty rate (CTH) or an exchange rate.", sender: 'bot', timestamp: new Date() };
const SUGGESTIONS = ["Today's summary", 'Pending jobs', 'BE 1234567', 'duty 85171300', 'rate USD', 'help'];
const toMsg = (m) => ({ id: m.id, text: m.text, sender: m.role === 'user' ? 'user' : 'bot', timestamp: m.createdAt });

export default function ChatBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const keepScroll = useRef(false);
  
  const messagesEndRef = useRef(null);

  // WhatsApp-style time formatter
  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (isToday) return timeStr;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' + timeStr;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (keepScroll.current) { keepScroll.current = false; return; }
    scrollToBottom();
  }, [messages, isTyping, isOpen]);

  // saved chat of this user, loaded the first time the window opens
  const loadHistory = async (before) => {
    try {
      setLoadError('');
      const r = await fetch('/api/chatbot/history?limit=50' + (before ? '&before=' + before : ''));
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'could not load the chat');
      if (before) keepScroll.current = true;
      setMessages(prev => (before ? [...d.data.map(toMsg), ...prev] : d.data.map(toMsg)));
      setHasMore(!!d.more);
      setLoaded(true);
    } catch (e) { setLoadError(e.message); setLoaded(true); }
  };
  useEffect(() => { if (isOpen && !loaded) loadHistory(); }, [isOpen]); // eslint-disable-line

  const handleSend = async (preset) => {
    const text = String(preset !== undefined ? preset : input).trim();
    if (!text || isTyping) return;
    const tempId = 'tmp-' + Date.now();
    setMessages(prev => [...prev, { id: tempId, text, sender: 'user', timestamp: new Date(), pending: true }]);
    setInput('');
    setIsTyping(true);
    try {
      const r = await fetch('/api/chatbot/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, page: window.location.pathname }) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'no answer');
      setMessages(prev => [...prev.filter(m => m.id !== tempId), ...d.data.map(toMsg)]);
    } catch (e) {
      setMessages(prev => [...prev.map(m => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
        { id: 'err-' + Date.now(), text: 'Could not reach the server (' + e.message + '). Your message was not saved - tap it to send again.', sender: 'bot', timestamp: new Date(), error: true }]);
    } finally {
      setIsTyping(false);
    }
  };

  const retry = (m) => { if (!m.failed) return; setMessages(prev => prev.filter(x => x.id !== m.id && !x.error)); handleSend(m.text); };

  const clearChat = async () => {
    if (!window.confirm('Delete your whole chat history with EagleView AI?')) return;
    try { await fetch('/api/chatbot/history', { method: 'DELETE' }); setMessages([]); setHasMore(false); } catch (e) { /* keep the chat on screen */ }
  };

  const shown = messages.length ? messages : [WELCOME];

  return (
    <>
      {/* Floating Avatar Button */}
      <div 
        style={{
          position: 'fixed', bottom: '35px', right: '35px', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer',
          transform: isOpen ? 'scale(0)' : 'scale(1)', transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsOpen(true)}
      >


        {/* The Bot Icon */}
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isHovered ? '0 10px 30px var(--primary-shadow, rgba(37, 99, 235, 0.5))' : '0 10px 25px var(--primary-shadow, rgba(37, 99, 235, 0.3))',
          transition: 'all 0.3s', transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          position: 'relative'
        }}>
          {/* Pulse effect */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '50%',
            border: '2px solid var(--primary-color-start, #0ea5e9)', animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite', opacity: 0.5
          }}></div>
          
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%', background: 'white',
            overflow: 'hidden', position: 'relative',
            
          }}>
            <img src="/robot.png" alt="Robot" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'var(--primary-color-start, #0ea5e9)',
              mixBlendMode: 'hue', zIndex: 1
            }}></div>

            <img src="/robot.png" alt="Robot Eyes" style={{ 
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', 
                filter: 'brightness(1.8) drop-shadow(0 0 6px var(--primary-color-start, #0ea5e9))', 
                WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 20%, transparent 35%)', 
                maskImage: 'radial-gradient(circle at 50% 45%, black 20%, transparent 35%)', 
                animation: 'blinkEyes 5s infinite', transformOrigin: 'center 45%', zIndex: 2
            }} />
          </div>

        </div>
      </div>

      {/* Chat Window */}
      <div style={{
        position: 'fixed', bottom: '30px', right: '30px', width: '380px', height: '550px',
        background: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05)',
        zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #0284c7))',
          padding: '20px', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', background: 'white',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2), inset 0 2px 4px rgba(255,255,255,0.3)',
              overflow: 'hidden', position: 'relative'
            }}>
              <img src="/robot.png" alt="Robot" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'var(--primary-color-start, #0ea5e9)',
                mixBlendMode: 'hue', zIndex: 1
              }}></div>

              <img src="/robot.png" alt="Robot Eyes" style={{ 
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', 
                  filter: 'brightness(1.8) drop-shadow(0 0 6px var(--primary-color-start, #0ea5e9))', 
                  WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 20%, transparent 35%)', 
                  maskImage: 'radial-gradient(circle at 50% 45%, black 20%, transparent 35%)', 
                  animation: 'blinkEyes 5s infinite', transformOrigin: 'center 45%', zIndex: 2
              }} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px', color: 'var(--bg-panel, var(--bg-panel, #ffffff))' }}>EAGLEVIEW AI</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }}></div>
                <span style={{ fontSize: '11px', color: '#e0f2fe', fontWeight: 600 }}>Always Online</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
          {messages.length > 0 && (
            <button type="button" title="Clear chat history" onClick={clearChat}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
              <Trash2 size={15} />
            </button>
          )}
          <button 
            type="button"
            title="Close"
            onClick={() => setIsOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '32px', height: '32px',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.2)'}
            onMouseOut={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1, background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '20px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          {hasMore && (
            <button type="button" onClick={() => loadHistory(messages.find(m => typeof m.id === 'number')?.id)}
              style={{ alignSelf: 'center', background: 'var(--bg-panel, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '999px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}>
              Load older messages
            </button>
          )}
          {isOpen && !loaded && <div style={{ alignSelf: 'center', fontSize: '11px', color: '#94a3b8' }}>Loading your chat...</div>}
          {loadError && <div style={{ alignSelf: 'center', fontSize: '11px', color: '#b91c1c' }}>Chat history not loaded: {loadError} <button type="button" onClick={() => loadHistory()} style={{ border: 'none', background: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px' }}>retry</button></div>}
          {shown.map((msg, idx) => (
            <div key={msg.id} style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              display: 'flex', gap: '10px', maxWidth: '85%',
              flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
            }}>
              {msg.sender === 'bot' && (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-color-start, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 'auto' }}>
                  
<div style={{
  width: '100%', height: '100%', borderRadius: '50%', background: 'white',
  overflow: 'hidden', position: 'relative'
}}>
  <img src="/robot.png" alt="Robot" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
  
  <div style={{
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    background: 'var(--primary-color-start, #0ea5e9)',
    mixBlendMode: 'hue', zIndex: 1
  }}></div>

  <img src="/robot.png" alt="Robot Eyes" style={{ 
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', 
      filter: 'brightness(1.8) drop-shadow(0 0 6px var(--primary-color-start, #0ea5e9))', 
      WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 20%, transparent 35%)', 
      maskImage: 'radial-gradient(circle at 50% 45%, black 20%, transparent 35%)', 
      animation: 'blinkEyes 5s infinite', transformOrigin: 'center 45%', zIndex: 2
  }} />
</div>

                </div>
              )}
              <div onClick={() => retry(msg)} title={msg.failed ? 'Not sent - tap to send again' : undefined} style={{
                cursor: msg.failed ? 'pointer' : 'default', opacity: msg.pending ? 0.75 : 1, outline: msg.failed ? '2px solid #fca5a5' : 'none',
                background: msg.sender === 'user' ? 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))' : 'var(--bg-panel, #ffffff)',
                color: msg.sender === 'user' ? 'white' : '#334155',
                padding: '10px 14px 6px 14px',
                borderRadius: msg.sender === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                fontSize: '13px', lineHeight: '1.5',
                boxShadow: msg.sender === 'user' ? '0 4px 10px var(--primary-shadow, rgba(37, 99, 235, 0.2))' : '0 2px 10px rgba(0,0,0,0.03)',
                border: msg.sender === 'bot' ? '1px solid var(--border-color, #e2e8f0)' : 'none',
                minWidth: '80px'
              }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: msg.error ? '#b91c1c' : undefined }}>{msg.text}</div>
                {/* WhatsApp-style timestamp */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  gap: '3px', marginTop: '4px'
                }}>
                  <span style={{
                    fontSize: '10px',
                    color: msg.sender === 'user' ? 'rgba(255,255,255,0.7)' : '#94a3b8',
                    letterSpacing: '0.2px',
                    fontWeight: 400,
                    whiteSpace: 'nowrap'
                  }}>
                    {msg.timestamp ? formatTime(msg.timestamp) : ''}
                  </span>
                  {msg.sender === 'user' && !msg.pending && !msg.failed && (
                    <svg width="14" height="10" viewBox="0 0 16 11" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M1 5.5L5 9.5L15 1.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 5.5L9 9.5L15 1.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing Indicator */}
          {isTyping && (
             <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '10px', maxWidth: '85%', alignItems: 'center' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-color-start, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Loader2 size={16} color="white" className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '12px 16px', borderRadius: '20px 20px 20px 4px', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '4px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-color, var(--border-color, #cbd5e1))', animation: 'bounce 1s infinite 0.1s' }}></div>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-color, var(--border-color, #cbd5e1))', animation: 'bounce 1s infinite 0.2s' }}></div>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-color, var(--border-color, #cbd5e1))', animation: 'bounce 1s infinite 0.3s' }}></div>
                </div>
             </div>
          )}
          
          {/* quick questions while the chat is empty */}
          {loaded && messages.length === 0 && !isTyping && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: '38px' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" onClick={() => handleSend(s)}
                  style={{ border: '1px solid var(--primary-color-start, #0ea5e9)', color: 'var(--primary-color-start, #0ea5e9)', background: 'var(--bg-panel, #fff)', borderRadius: '999px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '16px', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderTop: '1px solid var(--bg-input, #f1f5f9)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
              maxLength={2000}
              placeholder="Ask: job no, BE no, duty 85171300, rate USD..." 
              style={{
                width: '100%', padding: '14px 16px', borderRadius: '24px', border: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-app, var(--bg-app, #f8fafc))', outline: 'none', fontSize: '13px', color: 'var(--text-main, var(--text-main, #1e293b))',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button 
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            style={{ 
              background: input.trim() ? 'linear-gradient(135deg, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))' : 'var(--border-color, var(--border-color, #cbd5e1))', 
              border: 'none', color: 'white', width: '46px', height: '46px', borderRadius: '50%', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default',
              boxShadow: input.trim() ? '0 4px 12px var(--primary-shadow, rgba(37, 99, 235, 0.3))' : 'none',
              transition: 'all 0.2s', transform: input.trim() ? 'scale(1)' : 'scale(0.95)'
            }}
          >
            <Send size={18} style={{ marginLeft: '2px' }} />
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        
        @keyframes blinkEyes {
            0%, 96%, 98%, 100% { transform: scaleY(1); opacity: 1; }
            97%, 99% { transform: scaleY(0.1); opacity: 0.5; }
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
        }
        @keyframes spin {
            100% { transform: rotate(360deg); }
        }
        @keyframes ping {
            75%, 100% { transform: scale(1.5); opacity: 0; }
        }
      `}} />
    </>
  );
}
