import { useEffect, useRef, useState } from 'react';
import { todayIso } from './airWaybillData';

const CARRIER_SIGNATURE_PREFIX = 'AS AGENT FOR CARRIER';

// The signature boxes start with what the AWB prints and the FWB sends (shipper name / AS AGENT FOR CARRIER <agent>).
// A box still holding the filled-in text follows the shipper / agent as it is typed; a text the user typed is kept.
export default function useSignatures({ parties, agentDetails }) {
  const [signatureShipper, setSignatureShipper] = useState('');
  const [signatureCarrier, setSignatureCarrier] = useState('');
  const [executedDate, setExecutedDate] = useState(todayIso);
  const [executedPlace, setExecutedPlace] = useState('NEW DELHI');
  const autoFilledRef = useRef({ shipper: '', carrier: '' });

  const shipperName = parties?.Shipper?.name;
  useEffect(() => {
    const wanted = String(shipperName || '').trim();
    const current = String(signatureShipper || '').trim();
    const stillAutomatic = !current || current === autoFilledRef.current.shipper;
    if (!wanted || !stillAutomatic || current === wanted) return;
    autoFilledRef.current.shipper = wanted;
    setSignatureShipper(wanted);
  }, [shipperName, signatureShipper]);

  const agentName = agentDetails?.name;
  useEffect(() => {
    const trimmedAgent = String(agentName || '').trim();
    const wanted = trimmedAgent ? `${CARRIER_SIGNATURE_PREFIX} ${trimmedAgent}` : '';
    const current = String(signatureCarrier || '').trim();
    // the bare old default gets the agent's name too
    const stillAutomatic = !current || current === autoFilledRef.current.carrier || current.toUpperCase() === CARRIER_SIGNATURE_PREFIX;
    if (!wanted || !stillAutomatic || current === wanted) return;
    autoFilledRef.current.carrier = wanted;
    setSignatureCarrier(wanted);
  }, [agentName, signatureCarrier]);

  return {
    signatureShipper, setSignatureShipper, signatureCarrier, setSignatureCarrier,
    executedDate, setExecutedDate, executedPlace, setExecutedPlace,
  };
}
