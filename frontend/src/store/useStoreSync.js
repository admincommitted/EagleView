import { useEffect } from 'react';
import { applyTheme } from '@/theme/applyTheme';
import { useAuthStore } from './authStore';
import { usePermissionsStore } from './permissionsStore';
import { useProfileStore } from './profileStore';
import { useThemeStore } from './themeStore';
import { useWorkspaceStore } from './workspaceStore';

// Settings > Branch Master / Financial Year fire this after a change (SettingsParts/contextEvents.js)
const WORKSPACE_CHANGED_EVENT = 'globalContextUpdated';

const REHYDRATE_ON_KEYS = {
  token: () => useAuthStore.persist.rehydrate(),
  user: () => useAuthStore.persist.rehydrate(),
  'eagleview-app-settings': () => useThemeStore.persist.rehydrate(),
  'eagleview-permissions': () => usePermissionsStore.persist.rehydrate(),
};

/**
 * Keeps the global stores in step with the session, once, at the top of the app:
 * after login the theme, profile, branch / year and the online-users socket are loaded from the server;
 * on logout they are cleared; a login / logout / settings change in another tab of this browser shows here too.
 */
export function useStoreSync() {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    applyTheme(useThemeStore.getState().settings);
    const onStorage = (event) => REHYDRATE_ON_KEYS[event.key]?.();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!token) {
      useProfileStore.getState().clearProfile();
      return undefined;
    }
    useThemeStore.getState().loadFromServer();
    useProfileStore.getState().loadProfile();
    const workspace = useWorkspaceStore.getState();
    workspace.loadWorkspace();
    const disconnectSocket = workspace.connectSocket(token);
    const reloadWorkspace = () => useWorkspaceStore.getState().loadWorkspace();
    window.addEventListener(WORKSPACE_CHANGED_EVENT, reloadWorkspace);
    return () => {
      disconnectSocket();
      window.removeEventListener(WORKSPACE_CHANGED_EVENT, reloadWorkspace);
    };
  }, [token]);
}
