import { useState } from 'react';

const emptyCharge = () => ({ code: '', description: '', amount: '', dueTo: 'Due Carrier', remarks: '' });

export const hasChargeContent = (charge) => String(charge.code || '').trim() || parseFloat(charge.amount);

export default function useOtherCharges() {
  const [otherCharges, setOtherCharges] = useState(() => [emptyCharge()]);

  const addCharge = () => setOtherCharges([...otherCharges, emptyCharge()]);

  const removeCharge = (index) => {
    if (otherCharges.length > 1) setOtherCharges(otherCharges.filter((_, position) => position !== index));
  };

  const updateCharge = (index, field, value) =>
    setOtherCharges(otherCharges.map((charge, position) => (position === index ? { ...charge, [field]: value } : charge)));

  return { otherCharges, addCharge, removeCharge, updateCharge };
}
