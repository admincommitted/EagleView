import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AppHeader from '@/components/AppHeader/AppHeader';
import SharedDataLists from '@/components/SharedDataLists';
import ChatBotWidget from '@/components/ChatBotWidget';
import GlobalSearch from '@/components/GlobalSearch';
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys';
import { refreshPermissions, usePermissions } from '@/utils/permissions';
import { Button } from '@/components/ui';

const DASHBOARD_PATH = '/dashboard';
const HR_MODULE_PATH = '/hr-module';

// the first part of the path: opening another module plays the screen-in animation, a sub-page of the same one does not
const moduleOf = (pathname) => pathname.split('/')[1] || '';

// the HR module sizes itself from the header height
function useHeaderHeightVariable(headerRef) {
  useLayoutEffect(() => {
    const header = headerRef.current;
    const publishHeight = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, [headerRef]);
}

// Goes to the screen opened before this one; from the first screen of the session it goes to the Dashboard.
function BackButton() {
  const navigate = useNavigate();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(DASHBOARD_PATH));
  return (
    <Button size="icon" title="Back to the previous screen (Alt + Left arrow)" aria-label="Back" onClick={goBack}
      className="tw:fixed tw:bottom-[30px] tw:left-1 tw:z-[900] tw:rounded-full tw:bg-background tw:text-foreground tw:opacity-60 tw:hover:opacity-100">
      <ArrowLeft />
    </Button>
  );
}

function NoAccessNotice({ module, canOpenDashboard }) {
  const navigate = useNavigate();
  return (
    <div className="tw:mx-auto tw:my-10 tw:max-w-[520px] tw:rounded-lg tw:border tw:border-[#fdba74] tw:bg-[#fff7ed] tw:px-6 tw:py-5 tw:text-center tw:normal-case">
      <div className="tw:mb-1.5 tw:text-[15px] tw:font-extrabold tw:text-[#9a3412]">No access to "{module}"</div>
      <div className="tw:text-entry tw:text-[#7c2d12]">
        Your user does not have the View right for this module. Ask the admin to grant it in Master &gt; User Management.
      </div>
      {canOpenDashboard && (
        <Button variant="warning" className="tw:mt-3" onClick={() => navigate(DASHBOARD_PATH)}>Go to Dashboard</Button>
      )}
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-[1000] tw:flex tw:h-6 tw:items-center tw:justify-center tw:bg-[linear-gradient(90deg,var(--primary-color-start,#0284c7)_0%,var(--primary-color-end,#075985)_100%)] tw:px-4 tw:text-[11px] tw:text-white">
      <span className="tw:truncate">
        &copy; 2026 All Rights Reserved<span className="tw:hidden tw:sm:inline"> | Design and Developed by eagle view 360.</span>
      </span>
    </footer>
  );
}

export default function MainLayout() {
  const location = useLocation();
  const headerRef = useRef(null);
  const permissions = usePermissions();

  useHeaderHeightVariable(headerRef);
  useEffect(() => { refreshPermissions(); }, []);
  useGlobalHotkeys();

  const routeModule = permissions.restricted ? permissions.moduleForRoute(location.pathname + location.search) : null;
  const blockedModule = routeModule && !permissions.canView(routeModule) ? routeModule : null;
  const isHrModule = location.pathname === HR_MODULE_PATH;

  return (
    <div className="app-container">
      <AppHeader ref={headerRef} />

      <main className={`main-content animate-fade-in ${isHrModule ? 'hr-module-page' : 'tw:pb-[30px]'}`}>
        <SharedDataLists />
        {location.pathname !== DASHBOARD_PATH && <BackButton />}
        <div key={moduleOf(location.pathname)} className="tw:h-full tw:animate-screen-in">
          {blockedModule
            ? <NoAccessNotice module={blockedModule} canOpenDashboard={permissions.canView('Live Overview')} />
            : <Outlet />}
        </div>
      </main>

      <AppFooter />
      <ChatBotWidget />
      <GlobalSearch />
    </div>
  );
}
