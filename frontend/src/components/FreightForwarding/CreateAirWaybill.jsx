import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AirExportActionTabs from './AirExportActionTabs';
import { COUNTRY_CURRENCY_MAP, loggedInUser, todayIso } from './awb/air/hooks/airWaybillData';
import useAirMasters from './awb/air/hooks/useAirMasters';
import useAgentDetails from './awb/air/hooks/useAgentDetails';
import useAwbRecord from './awb/air/hooks/useAwbRecord';
import useScreenDialogs from './awb/air/hooks/useScreenDialogs';
import useRouting from './awb/air/hooks/useRouting';
import useAwbNumbers from './awb/air/hooks/useAwbNumbers';
import useStockDropdowns from './awb/air/hooks/useStockDropdowns';
import useParties from './awb/air/hooks/useParties';
import useHandlingInfo from './awb/air/hooks/useHandlingInfo';
import useRateLines from './awb/air/hooks/useRateLines';
import useCharges from './awb/air/hooks/useCharges';
import useOciRows from './awb/air/hooks/useOciRows';
import useDeclaredValues from './awb/air/hooks/useDeclaredValues';
import useSignatures from './awb/air/hooks/useSignatures';
import useAwbDraft from './awb/air/hooks/useAwbDraft';
import useAwbRecordActions from './awb/air/hooks/useAwbRecordActions';
import useAwbSave from './awb/air/hooks/useAwbSave';
import useAwbLoader from './awb/air/hooks/useAwbLoader';
import useDocumentAutoFill from './awb/air/hooks/useDocumentAutoFill';
import HeaderSection from './awb/air/sections/HeaderSection';
import PartiesSection from './awb/air/sections/PartiesSection';
import RoutingSection from './awb/air/sections/RoutingSection';
import HandlingOciSection from './awb/air/sections/HandlingOciSection';
import RateLinesSection from './awb/air/sections/RateLinesSection';
import ChargesSection from './awb/air/sections/ChargesSection';
import ActionBarSection from './awb/air/sections/ActionBarSection';
import DialogsSection from './awb/air/sections/DialogsSection';

// The screen state the sections read (ctx). Action hooks get the same object and read it when they run, so they see
// every value of the screen.
function useAirWaybillScreen(freshScreen) {
  const navigate = useNavigate();
  const location = useLocation();
  const masters = useAirMasters();
  const agent = useAgentDetails();
  const record = useAwbRecord();
  const dialogs = useScreenDialogs();
  const routing = useRouting();
  const numbers = useAwbNumbers({ masterAirlines: masters.masterAirlines });
  const stock = useStockDropdowns({ awbPrefix: numbers.awbPrefix, setAwbSuffix: numbers.setAwbSuffix, setUiModal: dialogs.setUiModal });
  const partyEntry = useParties();
  const handling = useHandlingInfo({ destAirport: routing.destAirport, parties: partyEntry.parties, masterAirports: masters.masterAirports });
  const rates = useRateLines({ setNatureOfGoods: handling.setNatureOfGoods });
  const charges = useCharges({ rateLines: rates.rateLines, awbPrefix: numbers.awbPrefix, totalChgWt: rates.totalChgWt, totalGrossWt: rates.totalGrossWt });
  const oci = useOciRows({ parties: partyEntry.parties, depAirport: routing.depAirport, destAirport: routing.destAirport, masterAirports: masters.masterAirports });
  const declared = useDeclaredValues();
  const signatures = useSignatures({ parties: partyEntry.parties, agentDetails: agent.agentDetails });

  const ctx = {
    navigate, location, freshScreen, COUNTRY_CURRENCY_MAP, getLoggedInUser: loggedInUser, getTodayDate: todayIso,
    ...masters, ...agent, ...record, ...dialogs, ...routing, ...numbers, ...stock, ...partyEntry, ...handling,
    ...rates, ...charges, ...oci, ...declared, ...signatures,
  };
  Object.assign(ctx, useAwbDraft(ctx));
  Object.assign(ctx, useAwbRecordActions(ctx));
  Object.assign(ctx, useAwbSave(ctx));
  Object.assign(ctx, useAwbLoader(ctx));
  Object.assign(ctx, useDocumentAutoFill(ctx));
  return ctx;
}

// what printLogic reads to draw the AWB print / PDF
const printDataOf = (ctx) => ({
  awbKind: 'AWB',
  signatureShipper: ctx.signatureShipper, signatureCarrier: ctx.signatureCarrier,
  depAirport: ctx.depAirport, destAirport: ctx.destAirport, destAirportName: ctx.destAirportName,
  executedDate: ctx.executedDate, executedPlace: ctx.executedPlace,
  awbPrefix: ctx.awbPrefix, awbSuffix: ctx.awbSuffix, hawbNumber: ctx.hawbNumber,
  by1: ctx.by1, to1: ctx.to1, by2: ctx.by2, to2: ctx.to2, by3: ctx.by3, to3: ctx.to3,
  flightNumber1: ctx.flightNumber1, flightDate1: ctx.flightDate1, flightNumber2: ctx.flightNumber2, flightDate2: ctx.flightDate2,
  weightChargePP: ctx.weightChargePP, weightChargeCC: ctx.weightChargeCC, valChargePP: ctx.valChargePP, valChargeCC: ctx.valChargeCC,
  taxPP: ctx.taxPP, taxCC: ctx.taxCC,
  dueAgentPP: ctx.dueAgentPP, dueAgentCC: ctx.dueAgentCC, dueCarrierPP: ctx.dueCarrierPP, dueCarrierCC: ctx.dueCarrierCC,
  totalPP: ctx.totalPP, totalCC: ctx.totalCC,
  rateLines: ctx.rateLines, otherCharges: ctx.otherCharges, ssrText: ctx.ssrText, osiText: ctx.osiText, sci: ctx.sci,
  accountingInfo: ctx.accountingInfo,
  carriageValue: ctx.carriageValue, customsValue: ctx.customsValue, insuranceValue: ctx.insuranceValue,
  currencyCode: ctx.currencyCode, chargeCode: ctx.chargeCode, wtValPC: ctx.wtValPC, otherPC: ctx.otherPC,
  natureOfGoods: ctx.natureOfGoods, dimRows: ctx.dimRows, volume: ctx.volume, parties: ctx.parties,
  agentDetails: ctx.printAgentDetails, airlineName: ctx.airlineName, sphCodes: ctx.sphCodes, ociRows: ctx.ociRows,
});

function CreateAirWaybillScreen({ freshScreen }) {
  const ctx = useAirWaybillScreen(freshScreen);
  return (
    <div className="tw:relative tw:z-[1] tw:flex tw:min-w-0 tw:flex-col tw:bg-transparent">
      <div id="awb-print-data" className="tw:hidden" data-json={JSON.stringify(printDataOf(ctx))} />
      <AirExportActionTabs activeTab="create" />
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-4 tw:pt-1 tw:pb-10">
        <HeaderSection ctx={ctx} />
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:overflow-hidden tw:rounded tw:border tw:border-input tw:bg-card">
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

// CLEAR mounts the screen again, so every box comes back exactly as on a fresh page. An AWB opened through the route
// state is dropped first (and the new screen mounted only after the router has applied that), otherwise it would load
// the same AWB again.
export default function CreateAirWaybill() {
  const [screenKey, setScreenKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const waitingForRouteRef = useRef(false);

  const freshScreen = useCallback(() => {
    if (!location.state) { setScreenKey((key) => key + 1); return; }
    waitingForRouteRef.current = true;
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!waitingForRouteRef.current || location.state) return;
    waitingForRouteRef.current = false;
    setScreenKey((key) => key + 1);
  }, [location]);

  return <CreateAirWaybillScreen key={screenKey} freshScreen={freshScreen} />;
}
