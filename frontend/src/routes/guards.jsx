import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LOGIN_PATH } from '@/services/session';
import { selectIsLoggedIn, useAuthStore } from '@/store/authStore';

export const HOME_PATH = '/';

export function RequireAuth() {
  const location = useLocation();
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  return isLoggedIn ? <Outlet /> : <Navigate to={LOGIN_PATH} replace state={{ from: location }} />;
}

export function GuestOnly() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  return isLoggedIn ? <Navigate to={HOME_PATH} replace /> : <Outlet />;
}
