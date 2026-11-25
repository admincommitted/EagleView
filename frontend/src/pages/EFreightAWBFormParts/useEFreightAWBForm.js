import { useState } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { chargeableOf, volWtFromCbm } from '@/components/FreightForwarding/awb/weightCalc';
import { freightApi } from '@/components/FreightForwarding/freightApi';
import useAwbMasters from './hooks/useAwbMasters';
import useDimensionLines, { hasDimensionContent } from './hooks/useDimensionLines';
import useOtherCharges, { hasChargeContent } from './hooks/useOtherCharges';
import useTactRate from './hooks/useTactRate';

const BLANK_AWB_NUMBER = '000-00000000';

// IATA: volumetric weight = cbm x 1,000,000 / 6000; chargeable weight = the higher of the gross and the volumetric
// weight, rounded up to the next 0.5 kg (whole lb when the weight is in pounds).
function chargeableWeightOf(grossWeight, volumetricWeight, weightUnit) {
  if (weightUnit === 'ton') return Math.max(grossWeight, (parseFloat(volumetricWeight) || 0) / 1000);
  return chargeableOf(grossWeight, volumetricWeight, /^lb/i.test(weightUnit) ? 'L' : 'K');
}

const savedDimension = (dimension) => ({
  pieces: parseFloat(dimension.pieces) || 0,
  weight: parseFloat(dimension.weight) || 0,
  length: parseFloat(dimension.length) || 0,
  width: parseFloat(dimension.width) || 0,
  height: parseFloat(dimension.height) || 0,
  volume: parseFloat(dimension.volume) || 0,
  stackable: !!dimension.stackable,
  tiltable: !!dimension.tiltable,
});

const savedCharge = (charge) => ({
  code: charge.code || '',
  description: charge.description || '',
  amount: parseFloat(charge.amount) || 0,
  dueTo: charge.dueTo || 'Due Carrier',
  remarks: charge.remarks || '',
});

export default function useEFreightAWBForm() {
  const { register, handleSubmit, watch, setValue } = useForm();
  const masters = useAwbMasters(setValue);
  const dimensions = useDimensionLines(setValue);
  const charges = useOtherCharges();

  const [weightUnit, setWeightUnit] = useState('kg');
  const [volumeUnit, setVolumeUnit] = useState('cbm');
  const [shipmentType, setShipmentType] = useState('Loose');
  const [drawer, setDrawer] = useState(null);
  const [showDimsModal, setShowDimsModal] = useState(false);
  const [routingStops, setRoutingStops] = useState([]);
  const [selectedShipper, setSelectedShipper] = useState(null);
  const [selectedConsignee, setSelectedConsignee] = useState(null);
  const [selectedNotify, setSelectedNotify] = useState(null);

  const { totalPieces, totalWeight, totalVolume } = dimensions;
  const volWeight = totalVolume > 0 ? volWtFromCbm(totalVolume).toFixed(2) : '';
  const grossWeight = parseFloat(watch('weight')) || totalWeight || 0;
  const chargeableWeight = chargeableWeightOf(grossWeight, volWeight, weightUnit);
  const rate = useTactRate({ watch, setValue, chargeableWeight });

  const watchedAwb = watch('awbNumber');
  const selectedIataAgentName = watch('iataAgent');

  const onSubmit = async (data) => {
    try {
      toast.loading('Saving AWB to Database...');
      await freightApi.createAwb({
        awbNumber: data.awbNumber || BLANK_AWB_NUMBER,
        type: 'MAWB',
        formData: {
          dep: data.origin,
          dest: data.destination,
          totalPieces: data.pieces,
          grossWeight: data.weight,
          shipperName: selectedShipper?.name || '',
          shipperAddress: selectedShipper?.addressLineOne || '',
          consigneeName: selectedConsignee?.name || '',
          ...data,
        },
        dims: dimensions.dims.filter(hasDimensionContent).map(savedDimension),
        totals: { pieces: totalPieces, weight: totalWeight, volume: totalVolume, volumetricWeight: parseFloat(volWeight) || 0, chargeableWeight },
        rateLines: charges.otherCharges.filter(hasChargeContent).map(savedCharge),
      });
      toast.dismiss();
      toast.success('AWB Successfully Saved to Database!');
    } catch (error) {
      toast.dismiss();
      toast.error('Error saving AWB: ' + error.message);
      console.error(error);
    }
  };

  return {
    register, handleSubmit, watch, setValue, onSubmit,
    ...masters, ...dimensions, ...charges, ...rate,
    volWeight, chargeableWeight, watchedAwb, selectedIataAgentName,
    weightUnit, setWeightUnit, volumeUnit, setVolumeUnit, shipmentType, setShipmentType,
    drawer, openDrawer: setDrawer, closeDrawer: () => setDrawer(null),
    showDimsModal, setShowDimsModal, routingStops, setRoutingStops,
    selectedShipper, setSelectedShipper, selectedConsignee, setSelectedConsignee, selectedNotify, setSelectedNotify,
    printAwb: () => window.print(),
  };
}
