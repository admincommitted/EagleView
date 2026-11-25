import { useEffect, useState } from 'react';
import { cbmFromDims, cbmOf, goodsWithDims, recalcRow, volWtFromCbm, volWtFromDims, withVolWt } from '../../weightCalc';
import { sumOf } from './airWaybillData';

// a rate line with its own dimensions / volume (Rate Line window) is the source of its volumetric weight
const hasOwnVolume = (line) => line && ((parseFloat(line.volume) || 0) > 0
  || (Array.isArray(line.dimensions) && line.dimensions.some((dimension) => parseFloat(dimension.length) > 0)));

export default function useRateLines({ setNatureOfGoods }) {
  const [rateLines, setRateLines] = useState([]);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [dimRows, setDimRows] = useState([]);
  const [densityGroup, setDensityGroup] = useState('1:6');
  const [volume, setVolume] = useState('');
  const [mcUnit, setMcUnit] = useState('MC');
  const [noDimensions, setNoDimensions] = useState(false);

  // chargeable weight (higher of gross / volumetric, up to the next 0.5 kg) and total follow weightCalc
  const handleGridChange = (index, field, value) => {
    setRateLines((previous) => {
      const lines = [...(previous || [])];
      lines[index] = recalcRow({ ...lines[index], [field]: value }, field);
      return lines;
    });
  };

  // Volume box -> volumetric weight of line 1: cbm x 1,000,000 / divisor of the ratio (1:6 = 6000 cm3 per kg, IATA)
  useEffect(() => {
    const cbm = cbmOf(volume, mcUnit);
    if (!(cbm > 0) || !(rateLines || []).length) return;
    if ((rateLines || []).some(hasOwnVolume)) return;
    // with dimension lines they are the source (the 3-decimal volume would give a slightly different weight)
    const useDimensions = (dimRows || []).length && !noDimensions;
    const volumetricWeight = +(useDimensions ? volWtFromDims(dimRows, densityGroup) : volWtFromCbm(cbm, densityGroup)).toFixed(2);
    const currentWeight = parseFloat(rateLines[0].volumetricWeight) || 0;
    if (Math.abs(currentWeight - volumetricWeight) > 0.01) setRateLines((previous) => withVolWt(previous, volumetricWeight));
  }, [volume, densityGroup, mcUnit, dimRows, noDimensions]); // eslint-disable-line react-hooks/exhaustive-deps -- rate line edits must not re-apply the box

  // Volume box <- sum of the rate lines' CBM (set when L x W x H is typed in the Rate Line window)
  useEffect(() => {
    const totalCbm = sumOf(rateLines, (line) => parseFloat(line.volume));
    if (!(totalCbm > 0)) return;
    const rounded = totalCbm.toFixed(3);
    setVolume((previous) => (previous !== rounded ? rounded : previous));
    setMcUnit('MC'); // the rate lines' volume is in cbm
  }, [rateLines, densityGroup]);

  // Dimension window: volume (cbm) and volumetric weight from L x W x H x pieces with the screen's ratio; the goods
  // text gets the dimension lines once
  const handleDimensionSave = (dimensions) => {
    setDimRows(dimensions);
    const totalCbm = cbmFromDims(dimensions);
    setVolume(totalCbm > 0 ? totalCbm.toFixed(3) : '');
    setMcUnit('MC');
    const volumetricKg = +volWtFromDims(dimensions, densityGroup).toFixed(2);
    setRateLines((previous) => withVolWt(previous, volumetricKg));
    setNatureOfGoods((previous) => goodsWithDims(previous, dimensions, volumetricKg));
  };

  const totalPcs = rateLines.reduce((sum, line) => sum + (parseInt(line.noOfPcs, 10) || 0), 0);
  const totalGrossWt = sumOf(rateLines, (line) => parseFloat(line.grossWeight)).toFixed(2);
  const totalVolWt = sumOf(rateLines, (line) => parseFloat(line.volumetricWeight)).toFixed(2);
  const totalChgWt = sumOf(rateLines, (line) => parseFloat(line.chargeableWeight)).toFixed(2);
  const totalAmountSum = sumOf(rateLines, (line) => parseFloat(line.totalAmount)).toFixed(2);

  return {
    rateLines, setRateLines, activeRowIndex, setActiveRowIndex, handleGridChange,
    dimRows, setDimRows, densityGroup, setDensityGroup, volume, setVolume, mcUnit, setMcUnit, noDimensions, setNoDimensions,
    handleDimensionSave, totalPcs, totalGrossWt, totalVolWt, totalChgWt, totalAmountSum,
  };
}
