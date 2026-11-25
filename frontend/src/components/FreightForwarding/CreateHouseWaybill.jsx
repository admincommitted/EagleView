import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAwbMasters from './awb/house/hooks/useAwbMasters';
import useAwbNumbers from './awb/house/hooks/useAwbNumbers';
import useCharges from './awb/house/hooks/useCharges';
import useDraftAutosave from './awb/house/hooks/useDraftAutosave';
import useExecution from './awb/house/hooks/useExecution';
import useFormLoading from './awb/house/hooks/useFormLoading';
import useHandlingInfo from './awb/house/hooks/useHandlingInfo';
import useHouseSaving from './awb/house/hooks/useHouseSaving';
import useIataAgent from './awb/house/hooks/useIataAgent';
import useOciRows from './awb/house/hooks/useOciRows';
import useParties from './awb/house/hooks/useParties';
import useRateLines from './awb/house/hooks/useRateLines';
import useRoutingFields from './awb/house/hooks/useRoutingFields';
import useScreenMessages from './awb/house/hooks/useScreenMessages';
import useScreenWindows from './awb/house/hooks/useScreenWindows';
import PageTopSection from './awb/house/sections/PageTopSection';
import HeaderSection from './awb/house/sections/HeaderSection';
import PartiesSection from './awb/house/sections/PartiesSection';
import RoutingSection from './awb/house/sections/RoutingSection';
import HandlingOciSection from './awb/house/sections/HandlingOciSection';
import RateLinesSection from './awb/house/sections/RateLinesSection';
import ChargesSection from './awb/house/sections/ChargesSection';
import ActionBarSection from './awb/house/sections/ActionBarSection';
import DialogsSection from './awb/house/sections/DialogsSection';

// the screen's state lives in ./awb/house/hooks; every section reads it from one ctx object
function useHouseWaybillForm(freshScreen) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentAwbId, setCurrentAwbId] = useState(null);

  const masters = useAwbMasters();
  const agent = useIataAgent();
  const routing = useRoutingFields();
  const messages = useScreenMessages();
  const windows = useScreenWindows();
  const handling = useHandlingInfo();
  const rateLineState = useRateLines({ setNatureOfGoods: handling.setNatureOfGoods });
  const awbNumbers = useAwbNumbers({ masterAirlines: masters.masterAirlines, setUiModal: messages.setUiModal });
  const charges = useCharges({
    rateLines: rateLineState.rateLines,
    awbPrefix: awbNumbers.awbPrefix,
    totalChgWt: rateLineState.totalChgWt,
    totalGrossWt: rateLineState.totalGrossWt,
  });
  const partyState = useParties();
  const oci = useOciRows({
    parties: partyState.parties,
    depAirport: routing.depAirport,
    destAirport: routing.destAirport,
    masterAirports: masters.masterAirports,
  });
  const execution = useExecution({ parties: partyState.parties, agentDetails: agent.agentDetails });

  const ctx = {
    navigate, location, freshScreen, currentAwbId, setCurrentAwbId,
    ...masters, ...agent, ...routing, ...messages, ...windows, ...handling, ...rateLineState,
    ...awbNumbers, ...charges, ...partyState, ...oci, ...execution,
  };
  Object.assign(ctx, useDraftAutosave(ctx));
  Object.assign(ctx, useFormLoading(ctx));
  Object.assign(ctx, useHouseSaving(ctx));
  return ctx;
}

function CreateHouseWaybillScreen({ freshScreen }) {
  const ctx = useHouseWaybillForm(freshScreen);

  return (
    <div className="tw:relative tw:z-[1] tw:flex tw:flex-col tw:bg-transparent">
      <PageTopSection ctx={ctx} />
      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-4 tw:pt-1 tw:pb-10">
        <HeaderSection ctx={ctx} />
        <div className="tw:flex tw:flex-col tw:overflow-hidden tw:rounded tw:border tw:border-slate-400 tw:bg-white tw:shadow-md">
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

// CLEAR mounts the screen again so every box comes back as on a new page. A loaded AWB in the route state is dropped
// first and the new screen is mounted only once the router has applied that, else it would load the same AWB again.
export default function CreateHouseWaybill() {
  const [screenKey, setScreenKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const waitingForRouteRef = useRef(false);

  const freshScreen = useCallback(() => {
    if (location.state) {
      waitingForRouteRef.current = true;
      navigate(location.pathname, { replace: true, state: null });
    } else {
      setScreenKey((key) => key + 1);
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (waitingForRouteRef.current && !location.state) {
      waitingForRouteRef.current = false;
      setScreenKey((key) => key + 1);
    }
  }, [location]);

  return <CreateHouseWaybillScreen key={screenKey} freshScreen={freshScreen} />;
}
