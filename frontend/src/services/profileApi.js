import axiosInstance from '@/services/axiosInstance';

/** The signed-in user's own profile, app settings and the admin system backup (all under /auth). */
export const profileApi = {
  getProfile: async () => (await axiosInstance.get('/auth/profile')).data,
  saveProfile: async (profile) => (await axiosInstance.put('/auth/profile', profile)).data,
  getSettings: async () => (await axiosInstance.get('/auth/settings')).data,
  saveSettings: async (settings) => (await axiosInstance.put('/auth/settings', settings)).data,
  startSystemBackup: async () => (await axiosInstance.post('/auth/system-backup')).data,
};
