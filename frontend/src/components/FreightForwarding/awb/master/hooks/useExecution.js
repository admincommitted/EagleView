import { useEffect, useRef, useState } from 'react';
import { todayIsoDate } from './masterWaybillData';

const CARRIER_SIGNATURE_PREFIX = 'AS AGENT FOR CARRIER';

// signature boxes and executed on / at. A signature box still holding the text filled here follows the shipper /
// agent as they are typed; a text the user typed is kept.
export default function useExecution({ shipperName, agentName }) {
  const [signatureShipper, setSignatureShipper] = useState('');
  const [signatureCarrier, setSignatureCarrier] = useState('');
  const [executedDate, setExecutedDate] = useState(todayIsoDate);
  const [executedPlace, setExecutedPlace] = useState('NEW DELHI');
  const filledSignatures = useRef({ shipper: '', carrier: '' });

  useEffect(() => {
    const wanted = String(shipperName || '').trim();
    const current = String(signatureShipper || '').trim();
    if (wanted && (!current || current === filledSignatures.current.shipper) && current !== wanted) {
      filledSignatures.current.shipper = wanted;
      setSignatureShipper(wanted);
    }
  }, [shipperName, signatureShipper]);

  useEffect(() => {
    const agent = String(agentName || '').trim();
    const wanted = agent ? `${CARRIER_SIGNATURE_PREFIX} ${agent}` : '';
    const current = String(signatureCarrier || '').trim();
    const isBareDefault = new RegExp(`^${CARRIER_SIGNATURE_PREFIX}$`, 'i').test(current);
    if (wanted && (!current || current === filledSignatures.current.carrier || isBareDefault) && current !== wanted) {
      filledSignatures.current.carrier = wanted;
      setSignatureCarrier(wanted);
    }
  }, [agentName, signatureCarrier]);

  return {
    signatureShipper, setSignatureShipper, signatureCarrier, setSignatureCarrier,
    executedDate, setExecutedDate, executedPlace, setExecutedPlace, getTodayDate: todayIsoDate,
  };
}
