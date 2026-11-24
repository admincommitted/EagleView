import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Send, X, Users, AlertCircle, CheckCircle, Info } from 'lucide-react';

// only an admin can send to all users (the server refuses it for others), and nobody needs to message himself. 28-Oct-2026
const tokenUser = () => { try { return JSON.parse(atob((localStorage.getItem('token') || '').split('.')[1])) || {}; } catch (e) { return {}; } };

export default function BroadcastModal({ isOpen, onClose, onlineUsers }) {
  const me = tokenUser();
  const isAdmin = String(me.role || '').toLowerCase() === 'admin';
  const others = (onlineUsers || []).filter(u => String(u.userId) !== String(me.id));
  const [targetUser, setTargetUser] = useState(isAdmin ? 'all' : '');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error('Title and message are required');
      return;
    }
    if (!targetUser) { toast.error(others.length ? 'Choose who to send to' : 'No other user is online'); return; }
    
    setIsSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId: targetUser === 'all' ? 'all' : parseInt(targetUser, 10),
          title,
          message,
          type
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Message sent successfully!');
        setTitle('');
        setMessage('');
        onClose();
      } else {
        toast.error('Failed to send message: ' + data.error);
      }
    } catch (err) {
      toast.error('Error connecting to server');
    } finally {
      setIsSending(false);
    }
  };

  const getTypeIcon = () => {
    if (type === 'success') return <CheckCircle size={18} color="#10b981" />;
    if (type === 'error') return <AlertCircle size={18} color="#ef4444" />;
    return <Info size={18} color="var(--primary-text, #3b82f6)" />;
  };

  const getGradient = () => {
    if (type === 'success') return 'linear-gradient(135deg, #064e3b, #10b981)';
    if (type === 'error') return 'linear-gradient(135deg, #7f1d1d, #ef4444)';
    return 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))';
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'var(--bg-panel, #ffffff)', width: '450px', borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden',
        border: '1px solid var(--border-color, #e2e8f0)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '1.5rem', 
          background: getGradient(), 
          color: 'white',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '50%' }}>
              <Send size={20} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>Broadcast Message</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>Send live alerts to users</p>
            </div>
          </div>
          <button onClick={onClose} style={{ 
            background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '50%', padding: '6px',
            cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s'
          }} onMouseOver={(e) => e.currentTarget.style.background='rgba(0,0,0,0.2)'} onMouseOut={(e) => e.currentTarget.style.background='rgba(0,0,0,0.1)'}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSend} style={{ padding: '1.5rem' }}>
          {/* Target */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #334155)' }}>
              <Users size={14} /> Send To
            </label>
            <select 
              value={targetUser} 
              onChange={(e) => setTargetUser(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--bg-input, #f8fafc)', color: 'var(--text-main, #0f172a)', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary-text, #3b82f6)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color, #cbd5e1)'}
            >
              {isAdmin ? <option value="all">🌐 All users ({others.length} online now; saved for the others)</option> : <option value="" disabled>{others.length ? 'Choose a user...' : 'No other user online'}</option>}
              {others.map(u => (
                <option key={u.userId} value={u.userId}>👤 {u.name || u.username || u.email}{u.email ? ` (${u.email})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Type & Title Row */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ flex: '1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #334155)' }}>
                {getTypeIcon()} Notification Type
              </label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--bg-input, #f8fafc)', color: 'var(--text-main, #0f172a)', outline: 'none' }}
              >
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Alert / Error</option>
              </select>
            </div>
            
            <div style={{ flex: '2' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #334155)' }}>
                Message Title
              </label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Server Maintenance"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--bg-input, #f8fafc)', color: 'var(--text-main, #0f172a)', outline: 'none' }}
              />
            </div>
          </div>

          {/* Message Body */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #334155)' }}>
              Message Details
            </label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your message here..."
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'var(--bg-input, #f8fafc)', color: 'var(--text-main, #0f172a)', outline: 'none', resize: 'vertical' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-muted, #64748b)', fontWeight: 600, border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background='var(--bg-input, #f1f5f9)'} 
              onMouseOut={(e) => e.currentTarget.style.background='transparent'}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSending} 
              style={{ 
                padding: '10px 24px', 
                background: getGradient(), 
                color: 'white', fontWeight: 600, border: 'none', borderRadius: '8px', 
                cursor: isSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
            >
              <Send size={16} />
              {isSending ? 'Sending...' : 'Broadcast'}
            </button>
          </div>
        </form>
      </div>

      <style>
        {`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        `}
      </style>
    </div>
  );
}
