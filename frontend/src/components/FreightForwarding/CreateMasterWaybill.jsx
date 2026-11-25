import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMasterWaybill from './awb/master/hooks/useMasterWaybill';
import PageTopSection from './awb/master/sections/PageTopSection';
import HeaderSection from './awb/master/sections/HeaderSection';
import PartiesSection from './awb/master/sections/PartiesSection';
import RoutingSection from './awb/master/sections/RoutingSection';
import HandlingOciSection from './awb/master/sections/HandlingOciSection';
import RateLinesSection from './awb/master/sections/RateLinesSection';
import ChargesSection from './awb/master/sections/ChargesSection';
import ActionBarSection from './awb/master/sections/ActionBarSection';
import DialogsSection from './awb/master/sections/DialogsSection';

function CreateMasterWaybillScreen({ freshScreen }) {
  const ctx = useMasterWaybill(freshScreen);

  return (
    <div className="tw:relative tw:z-[1] tw:flex tw:flex-col tw:bg-transparent">
      <PageTopSection ctx={ctx} />
      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-4 tw:pt-1 tw:pb-10">
        <HeaderSection ctx={ctx} />
        <div className="tw:flex tw:flex-col tw:overflow-hidden tw:rounded tw:border tw:border-slate-400 tw:bg-card tw:shadow-md">
          <PartiesSection ctx={ctx} />
          <RoutingSection ctx={ctx} />
          <HandlingOciSection ctx={ctx} />
          <RateLinesSection ctx={ctx} />
          <ChargesSection ctx={ctx} />
          <ActionBarSection ctx={ctx} />
        </div>
      </div>
      <DialogsSection ctx={ctx} />
    </div>
  );
}

// CLEAR mounts a new screen so every box comes back as on a fresh page. A loaded AWB in the route state is dropped
// first, and the new screen mounted only once the router has applied that (else it would load the same AWB again).
export default function CreateMasterWaybill() {
  const [screenKey, setScreenKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const waitingForRoute = useRef(false);

  const freshScreen = useCallback(() => {
    if (location.state) {
      waitingForRoute.current = true;
      navigate(location.pathname, { replace: true, state: null });
    } else {
      setScreenKey((key) => key + 1);
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (waitingForRoute.current && !location.state) {
      waitingForRoute.current = false;
      setScreenKey((key) => key + 1);
    }
  }, [location]);

  return <CreateMasterWaybillScreen key={screenKey} freshScreen={freshScreen} />;
}
