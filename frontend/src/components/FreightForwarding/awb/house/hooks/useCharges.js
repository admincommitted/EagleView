import { useEffect, useRef, useState } from 'react';
import { showSuccessToast } from '../../../printLogic';
import { carrierSurcharges, chargeSum, rateLineTotal, sumOf, withSurcharges } from './houseWaybillData';

const INITIAL_OTHER_CHARGES = [
  { id: 1, code: '', entitlement: 'carrier', amount: '', ppcc: 'PP', description: '' },
  { id: 2, code: '', entitlement: 'agent', amount: '', ppcc: 'PP', description: '' },
];

// the rate lines' total is the weight charge, prepaid or collect by the Wt/Val P/C box
const splitWeightCharge = (lineTotal, wtValPC) => (wtValPC === 'P' ? [lineTotal, ''] : ['', lineTotal]);

const isCollect = (charge) => String(charge.ppcc || '').toUpperCase() === 'CC';

// currency / declared values, weight + valuation + tax charges (prepaid / collect), other charges and the totals
export default function useCharges({ rateLines, awbPrefix, totalChgWt, totalGrossWt }) {
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [chargeCode, setChargeCode] = useState('PP');
  const [carriageValue, setCarriageValue] = useState('NVD');
  const [customsValue, setCustomsValue] = useState('NCV');
  const [insuranceValue, setInsuranceValue] = useState('XXX');

  const [wtValPC, setWtValPC] = useState('P');
  const [otherPC, setOtherPC] = useState('P');
  const [weightChargePP, setWeightChargePP] = useState('');
  const [weightChargeCC, setWeightChargeCC] = useState('');
  const [valChargePP, setValChargePP] = useState('');
  const [valChargeCC, setValChargeCC] = useState('');
  const [taxPP, setTaxPP] = useState('');
  const [taxCC, setTaxCC] = useState('');
  const [otherCharges, setOtherCharges] = useState(INITIAL_OTHER_CHARGES);

  // a rate typed on an other-charge row is per kg of the chargeable (else gross) weight
  const handleOtherChargeChange = (id, field, value) => {
    setOtherCharges((previous) => previous.map((charge) => {
      if (charge.id !== id) return charge;
      const row = { ...charge, [field]: value };
      if (field === 'rate') {
        const weight = sumOf(rateLines, 'chargeableWeight') || sumOf(rateLines, 'grossWeight');
        if (weight > 0 && value && !Number.isNaN(parseFloat(value))) row.amount = (parseFloat(value) * weight).toFixed(2);
      }
      return row;
    }));
  };

  const handleAutoCalculateCharges = () => {
    let chargeableWeight = rateLines.reduce((sum, line) => sum + (parseFloat(line.chargeableWeight ?? line.chgWt) || 0), 0);
    if (chargeableWeight === 0 && rateLines[0]) chargeableWeight = parseFloat(rateLines[0].grossWeight) || 0;
    if (chargeableWeight === 0) {
      showSuccessToast('Warning', 'Please enter Chargeable Weight first!', true);
      return;
    }
    const lineTotal = rateLineTotal(rateLines);
    if (parseFloat(lineTotal) > 0) {
      const [prepaid, collect] = splitWeightCharge(lineTotal, wtValPC);
      setWeightChargePP(prepaid);
      setWeightChargeCC(collect);
    }
    setOtherCharges(withSurcharges(otherCharges, carrierSurcharges(awbPrefix, chargeableWeight)).charges);
    showSuccessToast('Success', 'Auto-calculated charges applied!');
  };

  // surcharges and the weight charge follow the rate lines; when the lines are emptied their weight charge goes too
  const lastLineTotalRef = useRef(0);
  useEffect(() => {
    const chargeableWeight = parseFloat(totalChgWt) || parseFloat(totalGrossWt) || 0;
    if (chargeableWeight > 0) {
      const surcharges = carrierSurcharges(awbPrefix, chargeableWeight);
      setOtherCharges((previous) => {
        const { charges, changed } = withSurcharges(previous, surcharges);
        return changed ? charges : previous;
      });
    }

    const lineTotal = rateLineTotal(rateLines);
    const hadLineTotal = lastLineTotalRef.current > 0;
    lastLineTotalRef.current = parseFloat(lineTotal) || 0;
    if (parseFloat(lineTotal) > 0) {
      const [prepaid, collect] = splitWeightCharge(lineTotal, wtValPC);
      setWeightChargePP(prepaid);
      setWeightChargeCC(collect);
    } else if (hadLineTotal) {
      setWeightChargePP('');
      setWeightChargeCC('');
    }
  }, [totalChgWt, totalGrossWt, awbPrefix, wtValPC, rateLines]);

  const totalAgentAmount = chargeSum(otherCharges.filter((charge) => charge.entitlement === 'agent'));
  const totalCarrierAmount = chargeSum(otherCharges.filter((charge) => charge.entitlement === 'carrier'));

  // due agent / due carrier by each row's own PP / CC, as the XFWB sends them
  const dueAmount = (entitlement, collect) =>
    chargeSum(otherCharges.filter((charge) => charge.entitlement === entitlement && isCollect(charge) === collect));
  const dueAgentPP = dueAmount('agent', false);
  const dueAgentCC = dueAmount('agent', true);
  const dueCarrierPP = dueAmount('carrier', false);
  const dueCarrierCC = dueAmount('carrier', true);

  const totalPP = (parseFloat(weightChargePP) || 0) + (parseFloat(valChargePP) || 0) + (parseFloat(taxPP) || 0) + dueAgentPP + dueCarrierPP;
  const totalCC = (parseFloat(weightChargeCC) || 0) + (parseFloat(valChargeCC) || 0) + (parseFloat(taxCC) || 0) + dueAgentCC + dueCarrierCC;

  return {
    currencyCode, setCurrencyCode, chargeCode, setChargeCode, carriageValue, setCarriageValue,
    customsValue, setCustomsValue, insuranceValue, setInsuranceValue,
    wtValPC, setWtValPC, otherPC, setOtherPC,
    weightChargePP, setWeightChargePP, weightChargeCC, setWeightChargeCC,
    valChargePP, setValChargePP, valChargeCC, setValChargeCC, taxPP, setTaxPP, taxCC, setTaxCC,
    otherCharges, setOtherCharges, handleOtherChargeChange, handleAutoCalculateCharges,
    totalAgentAmount, totalCarrierAmount, dueAgentPP, dueAgentCC, dueCarrierPP, dueCarrierCC, totalPP, totalCC,
  };
}
