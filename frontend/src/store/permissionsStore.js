import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axiosInstance from '@/services/axiosInstance';
import { useAuthStore } from './authStore';

const LEGACY_CATALOG_KEY = 'moduleCatalog';

const legacyCatalog = () => {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_CATALOG_KEY) || '') || null;
  } catch {
    return null;
  }
};

// an error status is kept as catalogError; a 401 is left to axiosInstance (log out)
const answerOf = (path) => axiosInstance.get(path, { validateStatus: (status) => status !== 401 });
const isOk = (response) => response.status >= 200 && response.status < 300;

let refreshInFlight = null;

/**
 * The module catalog (/users/modules: modules, forms and their routes) - the user's own rights live on the auth
 * store's user (/users/my-permissions). Calls made while one refresh runs share it.
 */
export const usePermissionsStore = create(
  persist(
    (set) => ({
      catalog: legacyCatalog(),
      catalogError: '',
      refresh: () => {
        if (!refreshInFlight) {
          refreshInFlight = (async () => {
            try {
              if (!useAuthStore.getState().token) return;
              const [catalogAnswer, rightsAnswer] = await Promise.all([answerOf('/users/modules'), answerOf('/users/my-permissions')]);
              if (isOk(catalogAnswer)) {
                if (catalogAnswer.data?.groups) set({ catalog: catalogAnswer.data, catalogError: '' });
              } else {
                set({ catalogError: `HTTP ${catalogAnswer.status}` });
              }
              if (isOk(rightsAnswer)) {
                const rights = rightsAnswer.data || {};
                useAuthStore.getState().updateUser({ permissions: rights.permissions || null, ...(rights.role ? { role: rights.role } : {}) });
              }
            } catch {
              // offline: keep what we have
            } finally {
              refreshInFlight = null;
            }
          })();
        }
        return refreshInFlight;
      },
    }),
    { name: 'eagleview-permissions', partialize: ({ catalog }) => ({ catalog }) }
  )
);
