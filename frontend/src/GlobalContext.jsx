import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './store/workspaceStore';

// The branch / year / online users moved to store/workspaceStore. This keeps the old shape for files that still ask
// useGlobalContext(); new code reads useWorkspaceStore with a selector.

export function GlobalProvider({ children }) {
  return children;
}

export function useGlobalContext() {
  return useWorkspaceStore(useShallow((state) => ({
    activeBranch: state.activeBranch,
    setActiveBranch: state.chooseBranch,
    activeYear: state.activeYear,
    setActiveYear: state.chooseYear,
    reloadContext: state.loadWorkspace,
    branches: state.branches,
    setBranches: state.setBranches,
    fys: state.years,
    setFys: state.setYears,
    onlineUsers: state.onlineUsers,
    socketInstance: state.socket,
  })));
}
