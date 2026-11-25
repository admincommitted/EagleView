import { tokenClaims } from '@/store/authStore';

/** The claims inside the signed-in user's token ({ id, role, ... }); an empty object when it cannot be read. */
export const readTokenUser = () => tokenClaims();
