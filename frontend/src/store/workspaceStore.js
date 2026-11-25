import { create } from 'zustand';
import { io } from 'socket.io-client';
import { globalContextApi } from '@/services/globalContextApi';
import { tokenClaims, useAuthStore } from './authStore';

const ALL_BRANCHES = { id: 'ALL', branchCode: 'ALL', branchName: 'All branches', isAll: true, status: 'Active' };

// the picked branch / year are remembered per user, in this browser
const choiceKey = (name) => `ctx_${name}_${tokenClaims().id || 'u'}`;

const rememberChoice = (name, record) => {
  try {
    if (record?.id) localStorage.setItem(choiceKey(name), String(record.id));
  } catch {
    // storage turned off
  }
};

const savedChoice = (name) => {
  try {
    return localStorage.getItem(choiceKey(name));
  } catch {
    return null;
  }
};

const branchCodeOf = (branch) => String(branch.branchCode || branch.branch_code || '');

// every /api call sends the picked branch / year (axiosInstance reads window.__acctx); the server limits data to them
const publishBranch = (branch) => {
  window.__acctx = { ...(window.__acctx || {}), branch: branch ? (branch.isAll ? 'ALL' : branchCodeOf(branch)) : '' };
};

const publishYear = (year) => {
  window.__acctx = { ...(window.__acctx || {}), fyId: year ? year.id : '', fyStart: year ? year.startDate : '', fyEnd: year ? year.endDate : '' };
};

// only the branches this user may see, and "All branches" when there is more than one
const limitToUserScope = async (branches) => {
  try {
    const scope = await globalContextApi.myBranchScope();
    if (!scope || !Array.isArray(scope.branches)) return branches;
    const allowed = scope.all ? branches : branches.filter((branch) => scope.branches.includes(branchCodeOf(branch).toUpperCase()));
    return scope.canPickAll && allowed.length > 1 ? [ALL_BRANCHES, ...allowed] : allowed;
  } catch {
    return branches;
  }
};

const pickBranch = (branches, current) => {
  const wanted = String(current?.id || savedChoice('branch') || '');
  return branches.find((branch) => String(branch.id) === wanted) || branches.find((branch) => branch.isDefault) || branches[0] || null;
};

const pickYear = (years, current) => {
  const wanted = String(current?.id || savedChoice('year') || '');
  const today = new Date().toISOString().slice(0, 10);
  return years.find((year) => String(year.id) === wanted)
    || years.find((year) => year.isDefault)
    || years.find((year) => String(year.startDate) <= today && String(year.endDate) >= today)
    || years.find((year) => year.isActive)
    || years[0]
    || null;
};

/**
 * What the whole app works in: the branch and financial year picked in the top bar (with their lists), and who is
 * online (Socket.IO). loadWorkspace runs after login and again when Branch Master / Financial Year change.
 */
export const useWorkspaceStore = create((set, get) => ({
  branches: [],
  years: [],
  activeBranch: null,
  activeYear: null,
  onlineUsers: [],
  socket: null,

  chooseBranch: (branch) => {
    publishBranch(branch);
    rememberChoice('branch', branch);
    set({ activeBranch: branch });
  },

  chooseYear: (year) => {
    publishYear(year);
    rememberChoice('year', year);
    set({ activeYear: year });
  },

  setBranches: (branches) => set({ branches }),
  setYears: (years) => set({ years }),

  loadWorkspace: async () => {
    if (!useAuthStore.getState().token) return;
    const loadBranches = async () => {
      const response = await globalContextApi.companyBranches();
      if (!response.success) return;
      const activeBranches = (response.data || []).filter((branch) => (branch.status || 'Active') !== 'Inactive');
      const branches = await limitToUserScope(activeBranches);
      const activeBranch = pickBranch(branches, get().activeBranch);
      publishBranch(activeBranch);
      set({ branches, activeBranch });
    };
    const loadYears = async () => {
      const response = await globalContextApi.financialYears();
      if (!response.success) return;
      const years = response.data || [];
      const activeYear = pickYear(years, get().activeYear);
      publishYear(activeYear);
      set({ years, activeYear });
    };
    for (const load of [loadBranches, loadYears]) {
      try {
        await load();
      } catch (error) {
        console.error('Failed to load the branch / financial year', error);
      }
    }
  },

  // same origin: the Vite proxy (dev) or the app server (prod) carries /socket.io; the server needs the login token
  connectSocket: (token) => {
    const claims = tokenClaims(token);
    if (!token || Object.keys(claims).length === 0) return () => {};
    const socket = io(window.location.origin, { auth: { token } });
    socket.on('connect', () => {
      socket.emit('user_connected', { token, userId: claims.id || claims.userId || 'User', email: claims.email, username: claims.username });
    });
    socket.on('online_users', (onlineUsers) => set({ onlineUsers }));
    set({ socket });
    return () => {
      socket.disconnect();
      if (get().socket === socket) set({ socket: null, onlineUsers: [] });
    };
  },
}));
