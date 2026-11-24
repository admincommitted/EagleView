import React, { createContext, useState, useContext, useEffect } from 'react';
import { io } from 'socket.io-client';

export const GlobalContext = createContext();

export function GlobalProvider({ children }) {
  const [activeBranch, setActiveBranch] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [branches, setBranches] = useState([]);
  const [fys, setFys] = useState([]);

  // Branch / financial year at the top of the screen. 28-Oct-2026:
  // - one loader (Topbar loaded them a second time with other rules: this file took the first "active" year,
  //   Topbar the "default" one, so the year shown could change after the page loaded);
  // - the user's choice is kept for the next login / refresh (per user, in this browser);
  // - after Branch Master / Financial Year changes the same branch / year stays picked, with its new name;
  //   an inactive branch or a deleted year is not offered;
  // - the year picked when nothing is saved: the default one, else the one that contains today.
  const uidOf = () => { try { return JSON.parse(atob((localStorage.getItem('token') || '').split('.')[1])).id || 'u'; } catch (e) { return 'u'; } };
  const keyOf = (k) => `ctx_${k}_${uidOf()}`;
  const remember = (k, v) => { try { if (v && v.id) localStorage.setItem(keyOf(k), String(v.id)); } catch (e) { /* storage off */ } };
  const saved = (k) => { try { return localStorage.getItem(keyOf(k)); } catch (e) { return null; } };
  // 06-Nov-2026: the picked branch / year go with every /api call (main.jsx adds X-Branch / X-FY from window.__acctx);
  // the server limits the accounts data to them and to the branches the user may see
  const publish = (b, y) => { window.__acctx = { ...(window.__acctx || {}),
    ...(b !== undefined ? { branch: b ? (b.isAll ? 'ALL' : (b.branchCode || b.branch_code || '')) : '' } : {}),
    ...(y !== undefined ? { fyId: y ? y.id : '', fyStart: y ? y.startDate : '', fyEnd: y ? y.endDate : '' } : {}) }; };
  const chooseBranch = (b) => { publish(b, undefined); setActiveBranch(b); remember('branch', b); };
  const chooseYear = (y) => { publish(undefined, y); setActiveYear(y); remember('year', y); };
  publish(activeBranch, activeYear); // during render, so the screens' first requests already carry them

  const reloadContext = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const dataBranch = await (await fetch('/api/masters/company-branches')).json();
      if (dataBranch.success) {
        let list = (dataBranch.data || []).filter(b => (b.status || 'Active') !== 'Inactive');
        // 06-Nov-2026: only the branches this user may see (User Management), and "All branches" when there is more than one
        try {
          const me = await (await fetch('/api/branch-scope/me')).json();
          if (me && Array.isArray(me.branches)) {
            if (!me.all) list = list.filter(b => me.branches.includes(String(b.branchCode || b.branch_code || '').toUpperCase()));
            if (me.canPickAll && list.length > 1) list = [{ id: 'ALL', branchCode: 'ALL', branchName: 'All branches', isAll: true, status: 'Active' }, ...list];
          }
        } catch (e) { /* older server: plain list */ }
        setBranches(list);
        setActiveBranch(cur => {
          const want = String((cur && cur.id) || saved('branch') || '');
          return list.find(b => String(b.id) === want) || list.find(b => b.isDefault) || list[0] || null;
        });
      }
      const dataFy = await (await fetch('/api/masters/financial-years')).json();
      if (dataFy.success) {
        const list = dataFy.data || [];
        setFys(list);
        const today = new Date().toISOString().slice(0, 10);
        setActiveYear(cur => {
          const want = String((cur && cur.id) || saved('year') || '');
          return list.find(f => String(f.id) === want) || list.find(f => f.isDefault)
            || list.find(f => String(f.startDate) <= today && String(f.endDate) >= today) || list.find(f => f.isActive) || list[0] || null;
        });
      }
    } catch (err) {
      console.error("Failed to load global context", err);
    }
  };
  useEffect(() => {
    reloadContext();
    window.addEventListener('globalContextUpdated', reloadContext);
    return () => window.removeEventListener('globalContextUpdated', reloadContext);
  }, []);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socketInstance, setSocketInstance] = useState(null);

  useEffect(() => {
    let socket;
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        // â”€â”€ FIX: Use window.location.origin so Socket.IO works in any environment
        // In dev: Vite proxy routes /socket.io/ to localhost:5000
        // In prod: connects to same server that serves the app
        socket = io(window.location.origin, { auth: { token } }); // 14-Nov-2026: the server lets a socket in only with a login
        setSocketInstance(socket);
        
        socket.on('connect', () => {
          socket.emit('user_connected', { token, userId: payload.id || payload.userId || 'User', email: payload.email, username: payload.username }); // server verifies the token
        });

        socket.on('online_users', (users) => {
          setOnlineUsers(users);
        });
      } catch (err) {
        console.error("Socket error", err);
      }
    }
    
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  return (
    <GlobalContext.Provider value={{
      activeBranch, setActiveBranch: chooseBranch,
      activeYear, setActiveYear: chooseYear,
      reloadContext,
      branches, setBranches,
      fys, setFys,
      onlineUsers,
      socketInstance
    }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalContext() {
  return useContext(GlobalContext);
}

