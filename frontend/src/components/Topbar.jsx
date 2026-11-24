import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Bell, User, Search, Fingerprint, FileText, Database, Anchor, Box, Users, ChevronDown, X, CheckCheck, RefreshCw } from 'lucide-react';
import { useGlobalContext } from '../GlobalContext';
import toast from 'react-hot-toast';
import MyProfileModal from './common/MyProfileModal';
import SettingsModal from './common/SettingsModal';
import BroadcastModal from './common/BroadcastModal';

export default function Topbar() {
  const { activeBranch, setActiveBranch, activeYear, setActiveYear, branches, setBranches, fys, setFys, onlineUsers, socketInstance } = useGlobalContext();
  const [notifications, setNotifications] = useState([]);
  const [serverUnread, setServerUnread] = useState(null);
  const notifRef = useRef(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showFyDropdown, setShowFyDropdown] = useState(false);
  const branchRef = useRef(null);
  const fyRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (branchRef.current && !branchRef.current.contains(event.target)) setShowBranchDropdown(false);
      if (fyRef.current && !fyRef.current.contains(event.target)) setShowFyDropdown(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bell notifications (28-Oct-2026): own + broadcasts from the server, unread count from the server, mark all read,
  // remove one, clear read ones; refreshed every 2 minutes in case a live push was missed (socket reconnect).
  const notifApi = async (url, method = 'GET') => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}` } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.success === false) throw new Error(d.error || ('HTTP ' + res.status));
    return d;
  };
  const fetchNotifications = async () => {
    if (!localStorage.getItem('token')) return;
    try { const d = await notifApi('/api/notifications'); setNotifications(d.data || []); setServerUnread(typeof d.unreadCount === 'number' ? d.unreadCount : null); } catch (err) { /* offline: keep list */ }
  };
  // the Live Alerts ticker and the bell tell each other when alerts are read / removed (28-Oct-2026)
  const announce = () => { try { window.dispatchEvent(new CustomEvent('notifications-changed', { detail: { source: 'bell' } })); } catch (e) { /* old browser */ } };
  useEffect(() => {
    fetchNotifications();
    const t = setInterval(fetchNotifications, 120000);
    const onChanged = (e) => { if (!e.detail || e.detail.source !== 'bell') fetchNotifications(); };
    window.addEventListener('notifications-changed', onChanged);
    return () => { clearInterval(t); window.removeEventListener('notifications-changed', onChanged); };
  }, []);

  useEffect(() => {
    if (!socketInstance) return;
    
    const handleNewNotif = (notif) => {
      setNotifications(prev => [notif, ...prev.filter(n => n.id !== notif.id)]); // no double row when a push repeats
      setServerUnread(c => (typeof c === 'number' ? c + 1 : c));
      // App Settings > Push Notifications off: still listed under the bell, but no pop-up (28-Oct-2026)
      let popups = true;
      try { popups = JSON.parse(localStorage.getItem('localThemeSettings') || '{}').notificationsEnabled !== false; } catch (e) { /* keep on */ }
      if (!popups) return;
      if (notif.type === 'error') {
        toast.error(notif.title + ' - ' + notif.message, { icon: '❌', duration: 5000 });
      } else if (notif.type === 'success') {
        toast.success(notif.title + ' - ' + notif.message, { icon: '✅', duration: 5000 });
      } else if (notif.type === 'warning') {
        toast(notif.title + ' - ' + notif.message, { icon: '⚠️', duration: 5000 });
      } else {
        toast(notif.title + ' - ' + notif.message, { icon: '🔔', duration: 4000 });
      }
    };
    
    socketInstance.on('new_notification', handleNewNotif);
    return () => socketInstance.off('new_notification', handleNewNotif);
  }, [socketInstance]);

  const markAsRead = async (id) => {
    try {
      await notifApi(`/api/notifications/${id}/read`, 'PUT');
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setServerUnread(c => (typeof c === 'number' ? Math.max(0, c - 1) : c));
      announce();
    } catch (err) { toast.error('Could not mark as read: ' + err.message); }
  };
  const markAllRead = async () => {
    try { await notifApi('/api/notifications/read-all', 'PUT'); setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); setServerUnread(0); announce(); }
    catch (err) { toast.error('Could not mark all read: ' + err.message); }
  };
  const removeNotif = async (n) => {
    try { await notifApi(`/api/notifications/${n.id}`, 'DELETE'); setNotifications(prev => prev.filter(x => x.id !== n.id)); announce(); if (!n.isRead) setServerUnread(c => (typeof c === 'number' ? Math.max(0, c - 1) : c)); }
    catch (err) { toast.error('Could not remove: ' + err.message); }
  };
  const clearRead = async () => {
    try { const d = await notifApi('/api/notifications/clear-read', 'DELETE'); setNotifications(prev => prev.filter(n => !n.isRead)); if (d.removed) toast.success(`${d.removed} removed`); }
    catch (err) { toast.error('Could not clear: ' + err.message); }
  };
  const notifTime = (v) => { const d = new Date(v); if (isNaN(d)) return ''; const mins = Math.round((Date.now() - d) / 60000); if (mins < 1) return 'just now'; if (mins < 60) return mins + ' min ago'; if (mins < 1440) return Math.round(mins / 60) + ' h ago'; return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const NOTIF_COLOR = { error: '#ef4444', success: '#16a34a', warning: '#f59e0b', info: '#3b82f6' };

  const unreadCount = Math.max(notifications.filter(n => !n.isRead).length, serverUnread || 0);

  // branches / years are loaded once in GlobalContext (it also reloads on 'globalContextUpdated'). 28-Oct-2026
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showOnlineTooltip, setShowOnlineTooltip] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const fetchProf = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        if (!token) return;
        // EDI's own profile endpoint (node-backend). /api/auth/me belonged to HRMS.
        const res = await fetch('/api/auth/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) {
          const p = await res.json();
          let stored = {};
          try { stored = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch (e) {}
          setUserProfile(prev => ({ ...prev, firstName: p.firstName || stored.username || "ADMIN", lastName: p.lastName || "", email: p.email || "" }));
        }
      } catch(e) {}
    };
    fetchProf();
    
    // Custom event listener for when profile is updated from modal
    const handleProfileUpdate = () => fetchProf();
    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('profile-updated', handleProfileUpdate);
  }, []);

  const [searchResults, setSearchResults] = useState(null);

  const [userProfile, setUserProfile] = useState({ firstName: '', lastName: '', email: '', companyName: '' });
  const profileRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300); // 300ms Debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Real API search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) { setSearchResults(null); return; }
    fetch(`/api/search/global-search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(data => setSearchResults(data.success ? data.data : null))
      .catch(() => setSearchResults(null));
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchFocus = () => {
    if (searchQuery.length > 0) setIsSearchOpen(true);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length > 0) {
      setIsSearchOpen(true);
    } else {
      setIsSearchOpen(false);
    }
  };

  const getFilteredResults = () => {
    return searchResults;
  };

  const results = getFilteredResults();
  const hasResults = results && (
    (results.shippers && results.shippers.length > 0) || 
    (results.jobs && results.jobs.length > 0) || 
    (results.invoices && results.invoices.length > 0)
  );

  return (
    <div className="topbar">
      
      {/* Main Topbar Content */}
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, position: 'relative' }}>
        <div className="logo-container" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ 
            fontSize: '1.4rem', 
            fontWeight: 900, 
            color: '#ffffff', 
            letterSpacing: '-0.5px', 
            textTransform: 'none',
            textShadow: '0 2px 8px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center'
          }}>
            EagleView 
            <span style={{ 
              color: '#ffffff',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.05))',
              padding: '2px 8px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.4)',
              marginLeft: '6px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              fontSize: '1.1rem',
              textShadow: 'none'
            }}>
              360
            </span>
          </span>
        </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        


        <div className="context-switcher" style={{ background: 'rgba(0, 0, 0, 0.15)', borderColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '20px' }}>
          
          {/* Custom Branch Dropdown */}
          <div ref={branchRef} style={{ position: 'relative' }}>
            <div 
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffffff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', padding: '2px 4px' }}
            >
              {activeBranch ? (activeBranch.isAll ? 'ALL BRANCHES' : `${activeBranch.branchCode || activeBranch.branch_code} - ${activeBranch.branchName || activeBranch.branch_name}`) : 'NO BRANCH'}
              <ChevronDown size={14} color="#ffffff" style={{ opacity: 0.8 }} />
            </div>
            
            {showBranchDropdown && (
              <div style={{ position: 'absolute', top: '120%', left: 0, background: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', width: '200px', zIndex: 100, border: '1px solid var(--border-color)', padding: '4px' }}>
                {branches.length > 0 ? branches.map(b => (
                  <div 
                    key={b.id} 
                    onClick={() => { if (activeBranch?.id !== b.id) { setActiveBranch(b); toast.success(`Branch: ${b.branchCode} - ${b.branchName}`); } setShowBranchDropdown(false); }}
                    style={{ padding: '8px 12px', fontSize: '12px', color: activeBranch?.id === b.id ? 'var(--primary-color-end)' : '#334155', fontWeight: activeBranch?.id === b.id ? 700 : 500, cursor: 'pointer', borderRadius: '6px', background: activeBranch?.id === b.id ? '#f1f5f9' : 'transparent', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.target.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.target.style.background = activeBranch?.id === b.id ? '#f1f5f9' : 'transparent'}
                  >
                    {b.isAll ? 'All branches' : <>{b.branchCode} - {b.branchName}{b.isDefault ? ' ★' : ''}</>}
                  </div>
                )) : (
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94a3b8' }}>NO BRANCH</div>
                )}
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
          
          {/* Custom FY Dropdown */}
          <div ref={fyRef} style={{ position: 'relative' }}>
            <div 
              onClick={() => setShowFyDropdown(!showFyDropdown)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffffff', fontWeight: 600, fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '16px', padding: '2px 8px' }}
            >
              {activeYear ? activeYear.code : 'NO FY'}{activeYear && activeYear.isClosed ? ' 🔒' : ''}
              <ChevronDown size={12} color="#ffffff" style={{ opacity: 0.8 }} />
            </div>

            {showFyDropdown && (
              <div style={{ position: 'absolute', top: '120%', right: 0, background: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', width: '120px', zIndex: 100, border: '1px solid var(--border-color)', padding: '4px' }}>
                {fys.length > 0 ? fys.map(f => (
                  <div 
                    key={f.id} 
                    title={`${f.name || f.code}: ${f.startDate} to ${f.endDate}${f.isClosed ? ' (closed)' : ''}`}
                    onClick={() => {
                      if (activeYear?.id !== f.id) {
                        setActiveYear(f);
                        if (f.isClosed) toast(`Year ${f.code} is closed`, { icon: '🔒' }); else toast.success(`Financial year: ${f.code}`);
                      }
                      setShowFyDropdown(false);
                    }}
                    style={{ padding: '8px 12px', fontSize: '12px', color: activeYear?.id === f.id ? 'var(--primary-color-end)' : '#334155', fontWeight: activeYear?.id === f.id ? 700 : 500, cursor: 'pointer', borderRadius: '6px', background: activeYear?.id === f.id ? '#f1f5f9' : 'transparent', transition: 'background 0.2s', textAlign: 'center' }}
                    onMouseOver={(e) => e.target.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.target.style.background = activeYear?.id === f.id ? '#f1f5f9' : 'transparent'}
                  >
                    {f.code}{f.isDefault ? ' ★' : ''}{f.isClosed ? ' 🔒' : ''}
                  </div>
                )) : (
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>NO FY</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', color: 'var(--text-muted)' }}>
          {/* Online Users */}
          <div 
            onClick={() => setIsBroadcastOpen(true)} 
            onMouseEnter={() => setShowOnlineTooltip(true)}
            onMouseLeave={() => setShowOnlineTooltip(false)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
          >
            <Users size={18} color="#ffffff" />
            <span style={{ letterSpacing: '0.5px' }}>{onlineUsers ? onlineUsers.length : 0} ONLINE</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'pulse 2s infinite' }}></span>
            
            {showOnlineTooltip && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '50%',
                transform: 'translateX(50%)',
                marginTop: '12px',
                backgroundColor: '#ffffff',
                color: '#334155',
                padding: '12px',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--border-color, #e2e8f0)',
                fontSize: '12px',
                fontWeight: 'normal',
                zIndex: 9999,
                minWidth: '220px',
                textShadow: 'none',
                cursor: 'default'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '50%',
                  transform: 'translateX(50%) rotate(45deg)',
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#ffffff',
                  borderTop: '1px solid var(--border-color, #e2e8f0)',
                  borderLeft: '1px solid var(--border-color, #e2e8f0)'
                }}></div>
                <div style={{ fontWeight: 700, color: 'var(--primary-color-end, #0f172a)', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="var(--primary-color-start, #38bdf8)" /> ACTIVE USERS
                </div>
                {onlineUsers && onlineUsers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                    {onlineUsers.map((u, i) => (
                      <div 
                        key={i} 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', transition: 'background 0.2s', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ade80', boxShadow: '0 0 4px #4ade80' }}></span>
                        <span style={{ color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(u.name || u.firstName || u.username || u.email || 'USER').toUpperCase()}{u.username && u.name && u.username.toLowerCase() !== String(u.name).toLowerCase() ? ` (${u.username})` : ''}{u.sessions > 1 ? ` · ${u.sessions} tabs` : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '8px 0', textAlign: 'center' }}>No other users online</div>
                )}
                <div 
                  style={{ 
                    marginTop: '12px', 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: '#ffffff', 
                    textAlign: 'center', 
                    background: 'linear-gradient(135deg, var(--primary-color-start, #38bdf8), var(--primary-color-end, #2563eb))', 
                    padding: '8px', 
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
                  }}
                >
                  Click to broadcast message
                </div>
              </div>
            )}
          </div>

          {/* Notification Button */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <div style={{ cursor: 'pointer', position: 'relative' }} onClick={() => { if (!isNotifOpen) fetchNotifications(); setIsNotifOpen(!isNotifOpen); }} title={unreadCount ? `${unreadCount} unread` : 'Notifications'}>
              <Bell size={18} color="var(--bg-panel, var(--bg-panel, #ffffff))" />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-8px', background: '#ef4444', color: '#fff', minWidth: '15px', height: '15px', borderRadius: '8px', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', boxSizing: 'border-box' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </div>
            
            {/* Notification Dropdown */}
            {isNotifOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '1.25rem', width: '320px', background: 'white', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid var(--border-color, #e2e8f0)', zIndex: 1000, overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '1px solid var(--border-color, #e2e8f0)', fontWeight: 600, fontSize: '13px', color: 'var(--text-main, var(--text-main, #1e293b))', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Notifications {unreadCount ? `(${unreadCount} unread)` : ''}</span>
                  <span style={{ display: 'flex', gap: '10px', fontWeight: 500, fontSize: '11px' }}>
                    <span onClick={fetchNotifications} title="Refresh" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}><RefreshCw size={13} /></span>
                    {unreadCount > 0 && <span onClick={markAllRead} title="Mark all as read" style={{ cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCheck size={13} /> All read</span>}
                    {notifications.some(n => n.isRead) && <span onClick={clearRead} title="Remove the read ones" style={{ cursor: 'pointer', color: '#64748b' }}>Clear read</span>}
                  </span>
                </div>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--bg-input, #f1f5f9)', fontSize: '12px', cursor: 'pointer', background: notif.isRead ? 'white' : '#f8fafc' }} 
                        className="hover-row"
                        onClick={() => {
                          if (!notif.isRead) markAsRead(notif.id);
                          if (notif.link && /^\/[^/]/.test(notif.link)) { setIsNotifOpen(false); window.location.assign(notif.link); }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '4px', flexShrink: 0, background: notif.isRead ? 'transparent' : (NOTIF_COLOR[notif.type] || '#3b82f6'), border: `1px solid ${NOTIF_COLOR[notif.type] || '#3b82f6'}` }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: notif.isRead ? 500 : 700, color: 'var(--text-main, var(--text-main, #0f172a))' }}>{notif.title}</div>
                            <div style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '2px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{notif.message}</div>
                            <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>
                              {notifTime(notif.createdAt)}{notif.sentBy ? ` · ${notif.sentBy}` : ''}{notif.broadcast ? ' · to all' : ''}
                            </div>
                          </div>
                          <span onClick={(e) => { e.stopPropagation(); removeNotif(notif); }} title="Remove" style={{ color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }}><X size={13} /></span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Ultra Premium Profile Badge with Dropdown */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 14px 2px 4px',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              height: '32px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              backdropFilter: 'blur(12px)'
            }}
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}>
              <div style={{ 
                width: '26px', height: '26px', borderRadius: '50%', 
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: 'white', boxShadow: '0 0 10px rgba(79,172,254,0.6)' 
              }}>
                <User size={14} strokeWidth={2.5} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--bg-panel, var(--bg-panel, #ffffff))', letterSpacing: '0.5px', lineHeight: '1', textTransform: 'uppercase' }}>{(userProfile.firstName || 'ADMIN').toUpperCase()}</span>
                <span style={{ 
                  fontSize: '8px', color: '#e0f2fe', fontWeight: 700, letterSpacing: '0.5px', lineHeight: '1', textTransform: 'uppercase', opacity: 0.9,
                  whiteSpace: 'nowrap'
                }}>
                  COMMITTED CARGO CARE LIMITED
                </span>
              </div>
              <div style={{ marginLeft: '4px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>

            {/* Dropdown Menu */}
            {isProfileOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '220px', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--border-color, #e2e8f0)', zIndex: 1000, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-input, #f1f5f9)', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Welcome back,</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main, #0f172a)', textTransform: 'capitalize' }}>{userProfile.firstName} {userProfile.lastName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '2px', textTransform: 'lowercase' }}>{userProfile.email || ''}</div>
                </div>
                <div style={{ padding: '8px 0' }}>
                  <div style={{ padding: '8px 16px', fontSize: '12.5px', color: '#334155', cursor: 'pointer', transition: 'background 0.2s' }} className="hover-row" onClick={() => { setIsProfileOpen(false); setShowProfileModal(true); }}>My Profile</div>
                  <div style={{ padding: '8px 16px', fontSize: '12.5px', color: '#334155', cursor: 'pointer', transition: 'background 0.2s' }} className="hover-row" onClick={() => { setIsProfileOpen(false); setShowSettingsModal(true); }}>Settings</div>
                  <div style={{ borderTop: '1px solid var(--bg-input, #f1f5f9)', margin: '4px 0' }}></div>
                  <div 
                    style={{ padding: '8px 16px', fontSize: '12.5px', color: '#ef4444', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} 
                    className="hover-row"
                    onClick={() => {
                      setIsProfileOpen(false);
                      setShowLogoutModal(true);
                    }}
                  >
                    Log Out
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {showProfileModal && <MyProfileModal onClose={() => setShowProfileModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}

      {/* Premium Logout Modal */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', 
                backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <LogOut size={32} color="#ef4444" style={{ marginLeft: '4px' }} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))' }}>Sign Out</h3>
              <p style={{ margin: 0, color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '14px', lineHeight: 1.5, textTransform: 'none' }}>
                Are you sure you want to sign out?
              </p>
            </div>
            
            <div style={{ display: 'flex', borderTop: '1px solid var(--border-color, #e2e8f0)', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '16px 24px', gap: '12px' }}>
              <button 
                onClick={() => setShowLogoutModal(false)}
                style={{ 
                  flex: 1, padding: '10px 0', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', 
                  backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-input, var(--bg-input, #f1f5f9))'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-panel, var(--bg-panel, #ffffff))'; }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowLogoutModal(false);
                  setIsProfileOpen(false);
                  // 14-Nov-2026: the server cancels this token too (a copied token stops working)
                  try { const t = localStorage.getItem('token'); if (t) fetch('/api/auth/logout', { method: 'POST', keepalive: true, headers: { Authorization: 'Bearer ' + t } }).catch(() => {}); } catch (e) { /* ignore */ }
                  localStorage.removeItem('token');
                  try { document.cookie = 'edi_token=; path=/uploads; max-age=0'; } catch (e) { /* cookies blocked */ }
                  window.location.href = "/login";
                }}
                style={{ 
                  flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', 
                  backgroundColor: '#ef4444', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
          
          <style>
            {`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes slideUp { from { transform: translateY(20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
            `}
          </style>
        </div>
      )}

          <BroadcastModal isOpen={isBroadcastOpen} onClose={() => setIsBroadcastOpen(false)} onlineUsers={onlineUsers} />
    </div>
  );
}






