import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useScreenMessages from './useScreenMessages';
import useMasterLists from './useMasterLists';
import useAgentDetails from './useAgentDetails';
import useRouting from './useRouting';
import useAwbNumber from './useAwbNumber';
import useParties from './useParties';
import useHandlingInfo from './useHandlingInfo';
import useRateLines from './useRateLines';
import useLinkedHouses from './useLinkedHouses';
import useOciRows from './useOciRows';
import useCharges from './useCharges';
import useExecution from './useExecution';
import useDocumentWindows from './useDocumentWindows';
import useEdiSending from './useEdiSending';
import useDraftRestore from './useDraftRestore';
import useDocumentAutoFill from './useDocumentAutoFill';
import useMasterActions from './useMasterActions';
import useMasterLoad from './useMasterLoad';
import useMasterSave from './useMasterSave';

// the whole MAWB screen state: one ctx object the sections read
export default function useMasterWaybill(freshScreen) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentAwbId, setCurrentAwbId] = useState(null);

  const messages = useScreenMessages();
  const masterLists = useMasterLists();
  const agent = useAgentDetails();
  const routing = useRouting();
  const awbNumber = useAwbNumber({ masterAirlines: masterLists.masterAirlines, setUiModal: messages.setUiModal });
  const partyState = useParties();
  const handling = useHandlingInfo();
  const cargo = useRateLines({ setNatureOfGoods: handling.setNatureOfGoods });
  const houses = useLinkedHouses({
    awbPrefix: awbNumber.awbPrefix,
    awbSuffix: awbNumber.awbSuffix,
    depAirport: routing.depAirport,
    destAirport: routing.destAirport,
    natureOfGoods: handling.natureOfGoods,
    setNatureOfGoods: handling.setNatureOfGoods,
    setRateLines: cargo.setRateLines,
    densityGroup: cargo.densityGroup,
  });
  const oci = useOciRows({
    parties: partyState.parties,
    depAirport: routing.depAirport,
    destAirport: routing.destAirport,
    masterAirports: masterLists.masterAirports,
  });
  const charges = useCharges({
    awbPrefix: awbNumber.awbPrefix,
    rateLines: cargo.rateLines,
    totalChgWt: cargo.totalChgWt,
    totalGrossWt: cargo.totalGrossWt,
  });
  const execution = useExecution({ shipperName: partyState.parties['Shipper']?.name, agentName: agent.agentDetails?.name });
  const documents = useDocumentWindows();
  const sending = useEdiSending();
  const draft = useDraftRestore({
    awbPrefix: awbNumber.awbPrefix,
    awbSuffix: awbNumber.awbSuffix,
    natureOfGoods: handling.natureOfGoods,
    setAwbPrefix: awbNumber.setAwbPrefix,
    setAwbSuffix: awbNumber.setAwbSuffix,
    setNatureOfGoods: handling.setNatureOfGoods,
    setConfirmModal: messages.setConfirmModal,
  });

  const form = {
    ...messages, ...masterLists, ...agent, ...routing, ...awbNumber, ...partyState, ...handling, ...cargo, ...houses,
    ...oci, ...charges, ...execution, ...documents, ...sending, ...draft,
    currentAwbId, setCurrentAwbId, location, navigate, freshScreen,
  };
  const autoFill = useDocumentAutoFill(form);
  const actions = useMasterActions(form);
  const load = useMasterLoad({ ...form, ...actions });
  const save = useMasterSave(form);

  return { ...form, ...autoFill, ...actions, ...load, ...save };
}
