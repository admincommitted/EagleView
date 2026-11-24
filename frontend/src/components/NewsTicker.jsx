import React, { useState, useEffect, useCallback } from 'react';
import { useGlobalContext } from '../GlobalContext';
import { X, Megaphone } from 'lucide-react';

/*
 * Live Alerts ticker under the menu bar. 28-Oct-2026 rework:
 * - it showed every 'info' notification for ever - old test messages and ones already read kept scrolling.
 *   Now: only UNREAD alerts of the last 3 days that are broadcasts or were sent by a person (not system job
 *   alerts, which stay under the bell); warning / error broadcasts are shown too (before only 'info');
 * - X marks the shown alerts as read (same as the bell), so they do not come back after a refresh;
 *   clicking an alert marks it read and opens its link, if it has one;
 * - read / removed under the bell disappears here too (shared 'notifications-changed' event), and the list is
 *   refreshed every 2 minutes; the same live push twice is not shown twice;
 * - scroll speed follows the text length (long text ran too fast); no scrolling when the user prefers reduced motion.
 */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const TYPE_COLOR = { info: '#93c5fd', success: '#86efac', warning: '#fcd34d', error: '#fca5a5' };

const isTickerAlert = (n) => n && !n.isRead
    && (n.broadcast || n.userId == null || (n.sentBy && n.sentBy !== 'SYSTEM'))
    && (!n.createdAt || Date.now() - new Date(n.createdAt).getTime() < MAX_AGE_MS);

const api = async (url, method = 'GET') => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}` } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.success === false) throw new Error(d.error || ('HTTP ' + res.status));
    return d;
};
const announce = () => { try { window.dispatchEvent(new CustomEvent('notifications-changed', { detail: { source: 'ticker' } })); } catch (e) { /* old browser */ } };

export default function NewsTicker() {
    const { socketInstance } = useGlobalContext();
    const [messages, setMessages] = useState([]);

    const fetchNotifs = useCallback(async () => {
        if (!localStorage.getItem('token')) return;
        try {
            const data = await api('/api/notifications?limit=100');
            setMessages((data.data || []).filter(isTickerAlert).slice(0, 8));
        } catch (err) { /* offline: keep what is shown */ }
    }, []);

    useEffect(() => {
        fetchNotifs();
        const t = setInterval(fetchNotifs, 120000);
        const onChanged = (e) => { if (!e.detail || e.detail.source !== 'ticker') fetchNotifs(); };
        window.addEventListener('notifications-changed', onChanged);
        return () => { clearInterval(t); window.removeEventListener('notifications-changed', onChanged); };
    }, [fetchNotifs]);

    useEffect(() => {
        if (!socketInstance) return;
        const handleNew = (notif) => {
            if (isTickerAlert({ ...notif, isRead: false })) setMessages(prev => [notif, ...prev.filter(m => m.id !== notif.id)].slice(0, 8));
        };
        socketInstance.on('new_notification', handleNew);
        return () => socketInstance.off('new_notification', handleNew);
    }, [socketInstance]);

    const markRead = async (ids) => {
        setMessages(prev => prev.filter(m => !ids.includes(m.id)));
        await Promise.all(ids.filter(id => Number.isInteger(Number(id))).map(id => api(`/api/notifications/${id}/read`, 'PUT').catch(() => null)));
        announce();
    };
    const openAlert = (m) => {
        markRead([m.id]);
        if (m.link && /^\/[^/]/.test(m.link)) window.location.assign(m.link); // in-app links only
    };

    if (messages.length === 0) return null;

    const textLen = messages.reduce((n, m) => n + String(m.title || '').length + String(m.message || '').length, 0);
    const duration = Math.min(120, Math.max(15, Math.round(textLen / 6) + 10)); // about 6 characters a second

    return (
        <div role="region" aria-label="Live alerts" style={{
            background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)', color: '#f8fafc', display: 'flex', alignItems: 'center',
            padding: '4px 16px', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid #334155', height: '30px', boxSizing: 'border-box'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#facc15', marginRight: '12px', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '10px 0 10px -5px rgba(30, 41, 59, 0.9)' }}>
                <Megaphone size={14} className="animate-pulse" />
                <span>LIVE ALERTS{messages.length > 1 ? ` (${messages.length})` : ''}:</span>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
                <div className="ticker-scroll" style={{ display: 'inline-block', animationDuration: `${duration}s` }}>
                    {messages.map((m, i) => (
                        <span key={m.id || i} onClick={() => openAlert(m)} title={`${m.sentBy && m.sentBy !== 'SYSTEM' ? 'From ' + m.sentBy + ' - ' : ''}click to mark as read`} style={{ marginRight: '60px', cursor: 'pointer' }}>
                            <span style={{ color: TYPE_COLOR[m.type] || TYPE_COLOR.info, marginRight: '6px' }}>[{String(m.title || 'ALERT').toUpperCase()}]</span>
                            <span style={{ color: '#f1f5f9' }}>{m.message}</span>
                        </span>
                    ))}
                </div>
            </div>

            <button onClick={() => markRead(messages.map(m => m.id))} title="Mark these alerts as read" aria-label="Dismiss alerts"
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#cbd5e1', cursor: 'pointer', marginLeft: '12px', display: 'flex', padding: '4px', borderRadius: '50%' }}>
                <X size={12} />
            </button>

            <style>{`
        @keyframes tickerMove {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .ticker-scroll {
          animation-name: tickerMove;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .ticker-scroll:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .ticker-scroll { animation: none; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        }
      `}</style>
        </div>
    );
}
