import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMasterWaybill1 from './awb/master/useMasterWaybill1';
import useMasterWaybill2 from './awb/master/useMasterWaybill2';
import useMasterWaybill3 from './awb/master/useMasterWaybill3';
import useMasterWaybill4 from './awb/master/useMasterWaybill4';
import PageTopSection from './awb/master/sections/PageTopSection';
import HeaderSection from './awb/master/sections/HeaderSection';
import PartiesSection from './awb/master/sections/PartiesSection';
import RoutingSection from './awb/master/sections/RoutingSection';
import HandlingOciSection from './awb/master/sections/HandlingOciSection';
import RateLinesSection from './awb/master/sections/RateLinesSection';
import ChargesSection from './awb/master/sections/ChargesSection';
import ActionBarSection from './awb/master/sections/ActionBarSection';
import DialogsSection from './awb/master/sections/DialogsSection';

// CreateMasterWaybill: the form logic lives in ./awb/master/use*.jsx and the screen sections in ./awb/master/sections/.
function CreateMasterWaybillScreen({ freshScreen }) {
  const ctx = { ...useMasterWaybill1(), freshScreen };
  Object.assign(ctx, useMasterWaybill2(ctx));
  Object.assign(ctx, useMasterWaybill3(ctx));
  Object.assign(ctx, useMasterWaybill4(ctx));
  
  return <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'transparent', position: 'relative', zIndex: 1 }}>
      <PageTopSection ctx={ctx} />

      

      <div style={{ padding: '4px 0px', paddingBottom: '40px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>

      <HeaderSection ctx={ctx} />

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>

          

          <PartiesSection ctx={ctx} />

          <RoutingSection ctx={ctx} />

        <HandlingOciSection ctx={ctx} />
            
            <RateLinesSection ctx={ctx} />
        <ChargesSection ctx={ctx} />

                <ActionBarSection ctx={ctx} />
        </div>
      </div>

          <DialogsSection ctx={ctx} />
    
      
    
      

</div>;
}

// CLEAR (11-Nov-2026): the screen is mounted again, so every box - weight charge, totals, other-charge rows, agent,
// executed date - comes back exactly as on a fresh page. Before, CLEAR reset a hand-kept list of fields and missed
// the weight charge / valuation / tax / totals and the default rows. The loaded-AWB route state is dropped first
// (and the new screen mounted only after the router has applied that), otherwise it would load the same AWB again.
export default function CreateMasterWaybill() {
  const [screenKey, setScreenKey] = React.useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const waitingRef = React.useRef(false);
  const freshScreen = React.useCallback(() => {
    if (location.state) { waitingRef.current = true; navigate(location.pathname, { replace: true, state: null }); } // the router applies this a moment later
    else setScreenKey(k => k + 1);
  }, [location.pathname, location.state, navigate]);
  React.useEffect(() => { // mount the new screen only once the old AWB is gone from the route state
    if (waitingRef.current && !location.state) { waitingRef.current = false; setScreenKey(k => k + 1); }
  }, [location]);
  return <CreateMasterWaybillScreen key={screenKey} freshScreen={freshScreen} />;
}
