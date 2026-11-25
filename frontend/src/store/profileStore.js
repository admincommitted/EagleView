import { create } from 'zustand';
import { profileApi } from '@/services/profileApi';

/** The signed-in user's profile (GET /api/auth/profile): name, e-mail, phone, job title ... */
export const useProfileStore = create((set) => ({
  profile: null,
  loadProfile: async () => {
    try {
      set({ profile: await profileApi.getProfile() });
    } catch {
      // the header keeps the name it has
    }
  },
  clearProfile: () => set({ profile: null }),
}));
