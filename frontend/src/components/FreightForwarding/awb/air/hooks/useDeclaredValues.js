import { useState } from 'react';

// currency, charge code, declared values and accounting information of the AWB
export default function useDeclaredValues() {
  const [currencyCode, setCurrencyCode] = useState('INR'); // exports from India are rated in INR
  const [chargeCode, setChargeCode] = useState('PP');
  const [carriageValue, setCarriageValue] = useState('NVD');
  const [customsValue, setCustomsValue] = useState('NCV');
  const [insuranceValue, setInsuranceValue] = useState('XXX');
  const [accountingInfo, setAccountingInfo] = useState('FREIGHT PREPAID');
  const [productId, setProductId] = useState('GEN');
  const [hsCodeTargetIndex, setHsCodeTargetIndex] = useState(null);

  return {
    currencyCode, setCurrencyCode, chargeCode, setChargeCode, carriageValue, setCarriageValue,
    customsValue, setCustomsValue, insuranceValue, setInsuranceValue, accountingInfo, setAccountingInfo,
    productId, setProductId, hsCodeTargetIndex, setHsCodeTargetIndex,
  };
}
