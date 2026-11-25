import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { errorMessage } from '@/services/axiosInstance';
import { profileApi } from '@/services/profileApi';
import { applyTheme } from '@/theme/applyTheme';

export const DEFAULT_APP_SETTINGS = { theme: 'light', appBackground: 'sky', primaryColor: 'blue', notificationsEnabled: true, language: 'en' };

const SAVE_DELAY_MS = 400;
const SAVED_FIELDS = ['theme', 'appBackground', 'primaryColor', 'notificationsEnabled', 'language', 'timezone'];
const LEGACY_CACHE_KEY = 'localThemeSettings';

const savedFieldsOf = (settings) => Object.fromEntries(SAVED_FIELDS.filter((field) => settings[field] !== undefined).map((field) => [field, settings[field]]));

const legacySettings = () => {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_CACHE_KEY) || '') || null;
  } catch {
    return null;
  }
};

let saveTimer = null;

/**
 * App settings of the signed-in user (UserSettings row, GET / PUT /api/auth/settings): background, theme colour,
 * pop-up notifications, language. A change shows at once and is saved shortly after; the last look is kept in this
 * browser so the next visit starts with it before the server answers.
 * status: 'idle' | 'loading' | 'ready' | 'saving' | 'saved' | 'error'
 */
export const useThemeStore = create(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_APP_SETTINGS, ...legacySettings() },
      lastSaved: null,
      hasUnsavedChange: false,
      status: 'idle',
      errorText: '',

      loadFromServer: async () => {
        if (get().hasUnsavedChange) return;
        set({ status: 'loading', errorText: '' });
        try {
          const settings = await profileApi.getSettings();
          // a change made while the server answered wins (it is being saved)
          set((state) => (state.hasUnsavedChange ? { lastSaved: settings } : { settings, lastSaved: settings, status: 'ready' }));
        } catch (error) {
          set({ status: 'error', errorText: 'Could not load your settings: ' + errorMessage(error) });
        }
      },

      changeSettings: (changes) => {
        set({ settings: { ...get().settings, ...changes }, hasUnsavedChange: true, errorText: '' });
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => get().saveNow(), SAVE_DELAY_MS);
      },

      resetSettings: () => get().changeSettings(DEFAULT_APP_SETTINGS),

      saveNow: async () => {
        clearTimeout(saveTimer);
        if (!get().hasUnsavedChange) return;
        const sent = get().settings;
        set({ hasUnsavedChange: false, status: 'saving' });
        try {
          const response = await profileApi.saveSettings(savedFieldsOf(sent));
          set((state) => ({ lastSaved: response?.settings || sent, status: state.hasUnsavedChange ? 'saving' : 'saved' }));
        } catch (error) {
          // back to what is saved, so the screen never shows a look that was not kept
          const { lastSaved } = get();
          set({ status: 'error', errorText: 'Not saved: ' + errorMessage(error), ...(lastSaved ? { settings: lastSaved } : {}) });
        }
      },
    }),
    { name: 'eagleview-app-settings', partialize: ({ settings }) => ({ settings }) }
  )
);

export const selectPopupsWanted = (state) => state.settings.notificationsEnabled !== false;

useThemeStore.subscribe((state, previous) => {
  if (state.settings !== previous.settings) applyTheme(state.settings);
});
