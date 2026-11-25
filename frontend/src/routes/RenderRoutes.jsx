import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { GuestOnly, RequireAuth } from './guards';
import { guestRoutes, openRoutes, privateRoutes, redirects } from './routeConfig';

function PageLoading() {
  return (
    <div className="tw:flex tw:h-full tw:min-h-40 tw:items-center tw:justify-center">
      <Loader2 className="tw:size-6 tw:animate-spin tw:text-primary" />
    </div>
  );
}

const toRoute = ({ path, element }) => (
  <Route key={path} path={path} element={<Suspense fallback={<PageLoading />}>{element}</Suspense>} />
);

export default function RenderRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>{guestRoutes.map(toRoute)}</Route>
      {openRoutes.map(toRoute)}
      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          {privateRoutes.map(toRoute)}
          {redirects.map(({ from, to }) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
        </Route>
      </Route>
    </Routes>
  );
}
