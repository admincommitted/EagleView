import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

const FALLBACK_NAME = 'ADMIN';

// The signed-in user's name and e-mail for the header (the profile store reloads after My Profile saves).
export function useUserProfile() {
  const profile = useProfileStore((state) => state.profile);
  const username = useAuthStore((state) => state.user?.username);
  const firstName = profile?.firstName || username || (profile ? FALLBACK_NAME : '');
  return {
    firstName,
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    displayName: (firstName || FALLBACK_NAME).toUpperCase(),
  };
}
