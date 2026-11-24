import AirExportActionTabs from './AirExportActionTabs';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAirWaybill1 from './awb/air/useAirWaybill1';
import useAirWaybill2 from './awb/air/useAirWaybill2';
import useAirWaybill3 from './awb/air/useAirWaybill3';
import HeaderSection from './awb/air/sections/HeaderSection';
import PartiesSection from './awb/air/sections/PartiesSection';
import RoutingSection from './awb/air/sections/RoutingSection';
import HandlingOciSection from './awb/air/sections/HandlingOciSection';
import RateLinesSection from './awb/air/sections/RateLinesSection';
import ChargesSection from './awb/air/sections/ChargesSection';
import ActionBarSection from './awb/air/sections/ActionBarSection';
import DialogsSection from './awb/air/sections/DialogsSection';

// CreateAirWaybill: the form logic lives in ./awb/air/use*.jsx and the screen sections in ./awb/air/sections/.
function CreateAirWaybillScreen({ freshScreen }) {
  const ctx = { ...useAirWaybill1(), freshScreen };
  Object.assign(ctx, useAirWaybill2(ctx));
  Object.assign(ctx, useAirWaybill3(ctx));
  const { accountingInfo, airlineName, awbPrefix, awbSuffix, by1, by2, by3, carriageValue, chargeCode, currencyCode, customsValue, depAirport, destAirport, destAirportName, dimRows, dueAgentCC, dueAgentPP, dueCarrierCC, dueCarrierPP, executedDate, executedPlace, flightDate1, flightDate2, flightNumber1, flightNumber2, hawbNumber, insuranceValue, natureOfGoods, ociRows, osiText, otherCharges, otherPC, parties, printAgentDetails, rateLines, sci, sphCodes, ssrText, taxCC, taxPP, to1, to2, to3, totalCC, totalPP, valChargeCC, valChargePP, volume, weightChargeCC, weightChargePP, wtValPC } = ctx;
  return <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'transparent', position: 'relative', zIndex: 1 }}>
      <div id="awb-print-data" style={{ display: 'none' }} data-json={JSON.stringify({ awbKind: 'AWB', signatureShipper: ctx.signatureShipper, signatureCarrier: ctx.signatureCarrier, // printed in the signature boxes (11-Nov-2026)
                    depAirport, destAirport, destAirportName, executedDate, executedPlace, awbPrefix, awbSuffix, hawbNumber, by1, to1, by2, to2, by3, to3, flightNumber1, flightDate1, flightNumber2, flightDate2,
          weightChargePP, weightChargeCC, valChargePP, valChargeCC, taxPP, taxCC,
          dueAgentPP, dueAgentCC, dueCarrierPP, dueCarrierCC, totalPP, totalCC,
          rateLines, otherCharges, ssrText, osiText, sci, accountingInfo,
          carriageValue, customsValue, insuranceValue, currencyCode, chargeCode, wtValPC, otherPC, natureOfGoods, dimRows, volume, parties, agentDetails: printAgentDetails, airlineName, sphCodes, ociRows
        })}></div>
      

      <style>{`

        .premium-input:focus {

          border-color: #0ea5e9 !important;

          box-shadow: inset 0 1px 2px rgba(0,0,0,0.1), 0 0 0 2px rgba(14, 165, 233, 0.2) !important;

          background-color: #ffffff !important;
}

        .premium-input {

          transition: all 0.2s ease;

          background-color: #ffffff;
}

      `}</style>

      <div style={{ marginBottom: '0px' }}>

        <AirExportActionTabs activeTab="create" />

      </div>

      

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
export default function CreateAirWaybill() {
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
  return <CreateAirWaybillScreen key={screenKey} freshScreen={freshScreen} />;
}
