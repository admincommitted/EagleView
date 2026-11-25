import { useEffect, useRef, useState } from 'react';
import { showSuccessToast } from '../../../printLogic';
import { carrierBaseCharges, initialOtherCharges, placeBaseCharge, sumOf } from './airWaybillData';

// carrier surcharges are filled in by themselves only up to this chargeable weight
const AUTO_SURCHARGE_MAX_KG = 10000;

const rateLineTotal = (rateLines) => sumOf(rateLines, (line) => parseFloat(line.total) || parseFloat(line.totalAmount)).toFixed(2);
const amountOf = (charge) => parseFloat(charge.amount);
const isCollect = (charge) => String(charge.ppcc || '').toUpperCase() === 'CC';

export default function useCharges({ rateLines, awbPrefix, totalChgWt, totalGrossWt }) {
  const [wtValPC, setWtValPC] = useState('P');
  const [otherPC, setOtherPC] = useState('P');
  const [weightChargePP, setWeightChargePP] = useState('');
  const [weightChargeCC, setWeightChargeCC] = useState('');
  const [valChargePP, setValChargePP] = useState('');
  const [valChargeCC, setValChargeCC] = useState('');
  const [taxPP, setTaxPP] = useState('');
  const [taxCC, setTaxCC] = useState('');
  const [otherCharges, setOtherCharges] = useState(initialOtherCharges);

  const putWeightCharge = (lineTotal) => {
    if (wtValPC === 'P') { setWeightChargePP(lineTotal); setWeightChargeCC(''); }
    else { setWeightChargeCC(lineTotal); setWeightChargePP(''); }
  };

  // a rate typed on an other-charge row: amount = rate x chargeable weight (gross weight when there is none)
  const handleOtherChargeChange = (id, field, value) => {
    setOtherCharges((previous) => previous.map((charge) => {
      if (charge.id !== id) return charge;
      const updated = { ...charge, [field]: value };
      if (field === 'rate' && value && !isNaN(parseFloat(value))) {
        const weight = sumOf(rateLines, (line) => parseFloat(line.chargeableWeight)) || sumOf(rateLines, (line) => parseFloat(line.grossWeight)) || 0;
        if (weight > 0) updated.amount = (parseFloat(value) * weight).toFixed(2);
      }
      return updated;
    }));
  };

  const handleAutoCalculateCharges = () => {
    let chargeableWeight = sumOf(rateLines, (line) => parseFloat(line.chargeableWeight ?? line.chgWt));
    if (chargeableWeight === 0 && rateLines[0]) chargeableWeight = parseFloat(rateLines[0].grossWeight) || 0;
    if (chargeableWeight === 0) {
      showSuccessToast('Warning', 'Please enter Chargeable Weight first!', true);
      return;
    }
    const charges = [...otherCharges];
    carrierBaseCharges(awbPrefix, chargeableWeight).forEach((baseCharge) => placeBaseCharge(charges, baseCharge, () => true));
    const lineTotal = rateLineTotal(rateLines);
    if (lineTotal > 0) putWeightCharge(lineTotal);
    setOtherCharges(charges);
    showSuccessToast('Success', 'Auto-calculated charges applied!');
  };

  // the surcharges and the weight charge follow the rate lines; an amount typed by hand is not overwritten
  const lastLineTotalRef = useRef(0);
  useEffect(() => {
    const chargeableWeight = parseFloat(totalChgWt) || parseFloat(totalGrossWt) || 0;
    if (chargeableWeight > 0 && chargeableWeight <= AUTO_SURCHARGE_MAX_KG) {
      const baseCharges = carrierBaseCharges(awbPrefix, chargeableWeight);
      setOtherCharges((previous) => {
        const charges = [...(previous || [])];
        const placed = baseCharges.map((baseCharge) => placeBaseCharge(charges, baseCharge, (existing) => (parseFloat(existing.amount) || 0) === 0));
        return placed.some(Boolean) ? charges : previous;
      });
    }

    const lineTotal = rateLineTotal(rateLines);
    const hadLineTotal = lastLineTotalRef.current > 0;
    lastLineTotalRef.current = parseFloat(lineTotal) || 0;
    if (!(parseFloat(lineTotal) > 0)) {
      if (hadLineTotal) { setWeightChargePP(''); setWeightChargeCC(''); } // lines deleted / emptied - the old weight charge goes too
      return;
    }
    const keepOrNew = (previous) => (previous !== lineTotal ? lineTotal : previous);
    if (wtValPC === 'P') { setWeightChargePP(keepOrNew); setWeightChargeCC(''); }
    else { setWeightChargeCC(keepOrNew); setWeightChargePP(''); }
  }, [totalChgWt, totalGrossWt, awbPrefix, wtValPC, rateLines]);

  const dueAmount = (entitlement, collect) => sumOf(
    otherCharges.filter((charge) => charge.entitlement === entitlement && isCollect(charge) === collect),
    amountOf,
  );
  const totalAgentAmount = sumOf(otherCharges.filter((charge) => charge.entitlement === 'agent'), amountOf);
  const totalCarrierAmount = sumOf(otherCharges.filter((charge) => charge.entitlement === 'carrier'), amountOf);
  // due agent / due carrier by each row's own PP / CC, as the XFWB sends them
  const dueAgentPP = dueAmount('agent', false);
  const dueAgentCC = dueAmount('agent', true);
  const dueCarrierPP = dueAmount('carrier', false);
  const dueCarrierCC = dueAmount('carrier', true);
  const totalPP = (parseFloat(weightChargePP) || 0) + (parseFloat(valChargePP) || 0) + (parseFloat(taxPP) || 0) + dueAgentPP + dueCarrierPP;
  const totalCC = (parseFloat(weightChargeCC) || 0) + (parseFloat(valChargeCC) || 0) + (parseFloat(taxCC) || 0) + dueAgentCC + dueCarrierCC;

  return {
    wtValPC, setWtValPC, otherPC, setOtherPC, weightChargePP, setWeightChargePP, weightChargeCC, setWeightChargeCC,
    valChargePP, setValChargePP, valChargeCC, setValChargeCC, taxPP, setTaxPP, taxCC, setTaxCC,
    otherCharges, setOtherCharges, handleOtherChargeChange, handleAutoCalculateCharges,
    totalAgentAmount, totalCarrierAmount, dueAgentPP, dueAgentCC, dueCarrierPP, dueCarrierCC, totalPP, totalCC,
  };
}
