import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// The session is kept under the keys the rest of the app and the server already use: 'token' (the raw JWT) and
// 'user' (JSON), plus a cookie for /uploads links, which cannot send a header.
const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const UPLOADS_COOKIE = 'edi_token';
const COOKIE_MAX_AGE_S = 86400;

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || {};
  } catch {
    return {};
  }
};

export const writeUploadsCookie = (token) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = token
    ? `${UPLOADS_COOKIE}=${encodeURIComponent(token)}; path=/uploads; SameSite=Lax; max-age=${COOKIE_MAX_AGE_S}${secure}`
    : `${UPLOADS_COOKIE}=; path=/uploads; max-age=0`;
};

const sessionKeysStorage = {
  getItem: () => JSON.stringify({ state: { token: localStorage.getItem(TOKEN_KEY), user: readUser() }, version: 0 }),
  setItem: (_name, value) => {
    const { token, user } = JSON.parse(value).state;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    writeUploadsCookie(token);
  },
  removeItem: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    writeUploadsCookie(null);
  },
};

/** The signed-in user: token, the user the login answered with, and the rights /users/my-permissions adds to it. */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: {},
      login: (token, user) => set({ token, user: user || {} }),
      logout: () => set({ token: null, user: {} }),
      updateUser: (changes) => set({ user: { ...get().user, ...changes } }),
    }),
    {
      name: 'session',
      storage: createJSONStorage(() => sessionKeysStorage),
      partialize: ({ token, user }) => ({ token, user }),
    }
  )
);

export const selectIsLoggedIn = (state) => Boolean(state.token);

/** The claims inside the token ({ id, role, email, ... }); an empty object when it cannot be read. */
export const tokenClaims = (token = useAuthStore.getState().token) => {
  try {
    return JSON.parse(atob(String(token || '').split('.')[1])) || {};
  } catch {
    return {};
  }
};
