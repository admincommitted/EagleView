import { useEffect, useState } from 'react';
import { cbmFromDims, cbmOf, goodsWithDims, recalcRow, volWtFromCbm, volWtFromDims, withVolWt } from '../../weightCalc';
import { sumOf } from './houseWaybillData';

const VOLUME_WEIGHT_TOLERANCE_KG = 0.01;

const lineHasOwnVolume = (line) =>
  (parseFloat(line.volume) || 0) > 0 || (Array.isArray(line.dimensions) && line.dimensions.some((dimension) => parseFloat(dimension.length) > 0));

// rate lines, the dimension / volume boxes and the weight totals. Chargeable weight (IATA: higher of gross and
// volumetric, up to the next 0.5 kg) and line totals come from weightCalc.
export default function useRateLines({ setNatureOfGoods }) {
  const [rateLines, setRateLines] = useState([]);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [showRateLine, setShowRateLine] = useState(false);
  const [showDimension, setShowDimension] = useState(false);
  const [dimRows, setDimRows] = useState([]);
  const [densityGroup, setDensityGroup] = useState('1:6');
  const [volume, setVolume] = useState('');
  const [mcUnit, setMcUnit] = useState('MC');
  const [noDimensions, setNoDimensions] = useState(false);

  const handleGridChange = (index, field, value) => {
    setRateLines((previous) => {
      const lines = [...previous];
      lines[index] = recalcRow({ ...lines[index], [field]: value }, field);
      return lines;
    });
  };

  useEffect(() => {
    setNoDimensions(dimRows.length === 0 && (parseFloat(volume) || 0) === 0);
  }, [dimRows, volume]);

  // volumetric weight of line 1 from the Volume box (cbm x 1,000,000 / divisor of the density ratio, 1:6 = 6000 cm3
  // per kg). Lines with their own volume / dimensions from the Rate Line window keep their own weight.
  useEffect(() => {
    const cbm = cbmOf(volume, mcUnit);
    if (!(cbm > 0) || !rateLines.length || rateLines.some(lineHasOwnVolume)) return;
    const useDimensions = dimRows.length && !noDimensions;
    const volumetricWeight = +(useDimensions ? volWtFromDims(dimRows, densityGroup) : volWtFromCbm(cbm, densityGroup)).toFixed(2);
    const currentWeight = parseFloat(rateLines[0].volumetricWeight) || 0;
    if (Math.abs(currentWeight - volumetricWeight) > VOLUME_WEIGHT_TOLERANCE_KG) setRateLines((previous) => withVolWt(previous, volumetricWeight));
  }, [volume, densityGroup, mcUnit, dimRows, noDimensions]); // eslint-disable-line react-hooks/exhaustive-deps -- not on rate-line edits

  // the Volume box shows the rate lines' own volume (in cbm) when they have one
  useEffect(() => {
    const totalCbm = sumOf(rateLines, 'volume');
    if (!(totalCbm > 0)) return;
    setVolume(totalCbm.toFixed(3));
    setMcUnit('MC');
  }, [rateLines, densityGroup]);

  const handleDimensionSave = (dimensions) => {
    setDimRows(dimensions);
    const totalCbm = cbmFromDims(dimensions);
    setVolume(totalCbm > 0 ? totalCbm.toFixed(3) : '');
    setMcUnit('MC');
    const volumetricWeight = +volWtFromDims(dimensions, densityGroup).toFixed(2);
    setRateLines((previous) => withVolWt(previous, volumetricWeight));
    setNatureOfGoods((previous) => goodsWithDims(previous, dimensions, volumetricWeight));
  };

  const totalPcs = rateLines.reduce((sum, line) => sum + (parseInt(line.noOfPcs, 10) || 0), 0);
  const totalGrossWt = sumOf(rateLines, 'grossWeight').toFixed(2);
  const totalVolWt = sumOf(rateLines, 'volumetricWeight').toFixed(2);
  const totalChgWt = sumOf(rateLines, 'chargeableWeight').toFixed(2);
  const totalAmountSum = sumOf(rateLines, 'totalAmount').toFixed(2);

  return {
    rateLines, setRateLines, handleGridChange, activeRowIndex, setActiveRowIndex, showRateLine, setShowRateLine,
    showDimension, setShowDimension, dimRows, setDimRows, densityGroup, setDensityGroup, volume, setVolume,
    mcUnit, setMcUnit, noDimensions, setNoDimensions, handleDimensionSave,
    totalPcs, totalGrossWt, totalVolWt, totalChgWt, totalAmountSum,
  };
}
