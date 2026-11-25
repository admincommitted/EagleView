import { useEffect, useRef, useState } from 'react';
import { DEFAULT_EXECUTED_PLACE, todayIso } from './houseWaybillData';

const CARRIER_SIGNATURE_PREFIX = 'AS AGENT FOR CARRIER';
const BARE_CARRIER_SIGNATURE = /^AS AGENT FOR CARRIER$/i;

// signature boxes and executed on (date / place). The signatures start with what the AWB prints and the FWB sends
// (shipper name / AS AGENT FOR CARRIER <agent>) and follow the shipper / agent while they still hold that text.
export default function useExecution({ parties, agentDetails }) {
  const [signatureShipper, setSignatureShipper] = useState('');
  const [signatureCarrier, setSignatureCarrier] = useState('');
  const [executedDate, setExecutedDate] = useState(todayIso);
  const [executedPlace, setExecutedPlace] = useState(DEFAULT_EXECUTED_PLACE);
  const autoSignatureRef = useRef({ shipper: '', carrier: '' });

  const shipperName = String(parties['Shipper']?.name || '').trim();
  useEffect(() => {
    const current = String(signatureShipper || '').trim();
    const holdsAutoText = !current || current === autoSignatureRef.current.shipper;
    if (shipperName && holdsAutoText && current !== shipperName) {
      autoSignatureRef.current.shipper = shipperName;
      setSignatureShipper(shipperName);
    }
  }, [shipperName, signatureShipper]);

  const agentName = String(agentDetails?.name || '').trim();
  useEffect(() => {
    const wanted = agentName ? `${CARRIER_SIGNATURE_PREFIX} ${agentName}` : '';
    const current = String(signatureCarrier || '').trim();
    const holdsAutoText = !current || current === autoSignatureRef.current.carrier || BARE_CARRIER_SIGNATURE.test(current);
    if (wanted && holdsAutoText && current !== wanted) {
      autoSignatureRef.current.carrier = wanted;
      setSignatureCarrier(wanted);
    }
  }, [agentName, signatureCarrier]);

  return {
    signatureShipper, setSignatureShipper, signatureCarrier, setSignatureCarrier,
    executedDate, setExecutedDate, executedPlace, setExecutedPlace, getTodayDate: todayIso,
  };
}
