import { useState } from 'react';
import toast from 'react-hot-toast';
import { freightApi } from '@/components/FreightForwarding/freightApi';
import { errorMessage } from '@/services/axiosInstance';

// "Auto Rate": the TACT rates loaded in this system decide the rate. When there is none for this sector / weight the
// server says so - no rate is made up.
export default function useTactRate({ watch, setValue, chargeableWeight }) {
  const [rateInfo, setRateInfo] = useState(null);
  const [rating, setRating] = useState(false);

  const autoRate = async () => {
    const origin = watch('origin');
    const destination = watch('destination');
    const carrier = watch('airline') || watch('carrier') || '';
    if (!origin || !destination) {
      toast.error('Fill the origin and destination first');
      return;
    }
    if (!(chargeableWeight > 0)) {
      toast.error('A chargeable weight is needed - fill the weight or the dimensions');
      return;
    }
    setRating(true);
    try {
      const params = { origin, destination, weight: String(chargeableWeight), ...(carrier && { carrier: String(carrier).slice(0, 3) }) };
      const quote = (await freightApi.tactQuote(params)) || {};
      setRateInfo(quote);
      setValue('rateCharge', quote.rate);
      setValue('rateClass', quote.rateClass);
      setValue('total', quote.amount);
      toast.success(`TACT ${quote.rateClass} rate ${quote.currency} ${quote.rate} at the ${quote.weightBreak} kg break = ${quote.amount}`, { duration: 6000 });
    } catch (error) {
      const message = errorMessage(error);
      setRateInfo({ success: false, error: message });
      toast.error(message, { duration: 8000 });
    } finally {
      setRating(false);
    }
  };

  return { rateInfo, rating, autoRate };
}
