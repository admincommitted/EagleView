import { useEffect, useRef, useState } from 'react';
import { showSuccessToast } from '../../../printLogic';
import { carrierSurcharges, rateLinesAmount, sumOf, withSurcharges } from './masterWaybillData';

const INITIAL_OTHER_CHARGES = [
  { id: 1, code: '', entitlement: 'carrier', amount: '', ppcc: 'PP', description: '' },
  { id: 2, code: '', entitlement: 'agent', amount: '', ppcc: 'PP', description: '' },
];

const isCollect = (charge) => String(charge.ppcc || '').toUpperCase() === 'CC';

// currency, PP / CC codes, declared values, weight / valuation / tax charges and the other charges with their totals
export default function useCharges({ awbPrefix, rateLines, totalChgWt, totalGrossWt }) {
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [chargeCode, setChargeCode] = useState('PP');
  const [wtValPC, setWtValPC] = useState('P');
  const [otherPC, setOtherPC] = useState('P');
  const [carriageValue, setCarriageValue] = useState('NVD');
  const [customsValue, setCustomsValue] = useState('NCV');
  const [insuranceValue, setInsuranceValue] = useState('XXX');
  const [accountingInfo, setAccountingInfo] = useState('FREIGHT PREPAID');
  const [ccChargesDest, setCcChargesDest] = useState('');
  const [weightChargePP, setWeightChargePP] = useState('');
  const [weightChargeCC, setWeightChargeCC] = useState('');
  const [valChargePP, setValChargePP] = useState('');
  const [valChargeCC, setValChargeCC] = useState('');
  const [taxPP, setTaxPP] = useState('');
  const [taxCC, setTaxCC] = useState('');
  const [otherCharges, setOtherCharges] = useState(INITIAL_OTHER_CHARGES);
  const [showDueCarrier, setShowDueCarrier] = useState(false);
  const [showDueAgent, setShowDueAgent] = useState(false);

  const putWeightCharge = (amount) => {
    if (wtValPC === 'P') {
      setWeightChargePP(amount);
      setWeightChargeCC('');
    } else {
      setWeightChargeCC(amount);
      setWeightChargePP('');
    }
  };

  // a rate typed on a charge row is per kg of chargeable (else gross) weight
  const handleOtherChargeChange = (id, field, value) => {
    const chargeableWeight = sumOf(rateLines, 'chargeableWeight') || sumOf(rateLines, 'grossWeight');
    setOtherCharges((previous) => previous.map((charge) => {
      if (charge.id !== id) return charge;
      const updated = { ...charge, [field]: value };
      if (field === 'rate' && chargeableWeight > 0 && value && !isNaN(parseFloat(value))) {
        updated.amount = (parseFloat(value) * chargeableWeight).toFixed(2);
      }
      return updated;
    }));
  };

  const handleAutoCalculateCharges = () => {
    let chargeableWeight = rateLines.reduce((sum, line) => sum + (parseFloat(line.chargeableWeight ?? line.chgWt) || 0), 0);
    if (chargeableWeight === 0 && rateLines[0]) chargeableWeight = parseFloat(rateLines[0].grossWeight) || 0;
    if (chargeableWeight === 0) {
      showSuccessToast('Warning', 'Please enter Chargeable Weight first!', true);
      return;
    }
    const { charges } = withSurcharges(otherCharges, carrierSurcharges(awbPrefix, chargeableWeight));
    const lineAmount = rateLinesAmount(rateLines);
    if (parseFloat(lineAmount) > 0) putWeightCharge(lineAmount);
    setOtherCharges(charges);
    showSuccessToast('Success', 'Auto-calculated charges applied!');
  };

  // carrier surcharges and the weight charge follow the rate lines; emptied lines take the old weight charge away
  const lastLineAmount = useRef(0);
  useEffect(() => {
    const chargeableWeight = parseFloat(totalChgWt) || parseFloat(totalGrossWt) || 0;
    if (chargeableWeight > 0) {
      const surcharges = carrierSurcharges(awbPrefix, chargeableWeight);
      setOtherCharges((previous) => {
        const { charges, changed } = withSurcharges(previous || [], surcharges);
        return changed ? charges : previous;
      });
    }
    const lineAmount = rateLinesAmount(rateLines);
    const hadLineAmount = lastLineAmount.current > 0;
    lastLineAmount.current = parseFloat(lineAmount) || 0;
    if (parseFloat(lineAmount) > 0) {
      putWeightCharge(lineAmount);
    } else if (hadLineAmount) {
      setWeightChargePP('');
      setWeightChargeCC('');
    }
  }, [totalChgWt, totalGrossWt, awbPrefix, wtValPC, rateLines]); // eslint-disable-line react-hooks/exhaustive-deps -- putWeightCharge reads wtValPC

  const totalAgentAmount = otherCharges.filter((charge) => charge.entitlement === 'agent').reduce((sum, charge) => sum + (parseFloat(charge.amount) || 0), 0);
  const totalCarrierAmount = otherCharges.filter((charge) => charge.entitlement === 'carrier').reduce((sum, charge) => sum + (parseFloat(charge.amount) || 0), 0);

  // due agent / due carrier split by each row's own PP / CC (as the XFWB sends them)
  const dueAmount = (collect, entitlement) => otherCharges
    .filter((charge) => charge.entitlement === entitlement && isCollect(charge) === collect)
    .reduce((sum, charge) => sum + (parseFloat(charge.amount) || 0), 0);
  const dueAgentPP = dueAmount(false, 'agent');
  const dueAgentCC = dueAmount(true, 'agent');
  const dueCarrierPP = dueAmount(false, 'carrier');
  const dueCarrierCC = dueAmount(true, 'carrier');

  const totalPP = (parseFloat(weightChargePP) || 0) + (parseFloat(valChargePP) || 0) + (parseFloat(taxPP) || 0) + dueAgentPP + dueCarrierPP;
  const totalCC = (parseFloat(weightChargeCC) || 0) + (parseFloat(valChargeCC) || 0) + (parseFloat(taxCC) || 0) + dueAgentCC + dueCarrierCC;

  return {
    currencyCode, setCurrencyCode, chargeCode, setChargeCode, wtValPC, setWtValPC, otherPC, setOtherPC,
    carriageValue, setCarriageValue, customsValue, setCustomsValue, insuranceValue, setInsuranceValue,
    accountingInfo, setAccountingInfo, ccChargesDest, setCcChargesDest,
    weightChargePP, setWeightChargePP, weightChargeCC, setWeightChargeCC, valChargePP, setValChargePP,
    valChargeCC, setValChargeCC, taxPP, setTaxPP, taxCC, setTaxCC,
    otherCharges, setOtherCharges, handleOtherChargeChange, handleAutoCalculateCharges,
    showDueCarrier, setShowDueCarrier, showDueAgent, setShowDueAgent,
    totalAgentAmount, totalCarrierAmount, dueAgentPP, dueAgentCC, dueCarrierPP, dueCarrierCC, totalPP, totalCC,
  };
}
