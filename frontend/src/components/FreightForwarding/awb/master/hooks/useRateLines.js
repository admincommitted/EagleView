import { useEffect, useState } from 'react';
import { cbmFromDims, cbmOf, goodsWithDims, recalcRow, volWtFromCbm, volWtFromDims, withVolWt } from '../../weightCalc';

const hasOwnVolume = (row) => row && ((parseFloat(row.volume) || 0) > 0 || (Array.isArray(row.dimensions) && row.dimensions.some((dimension) => parseFloat(dimension.length) > 0)));

// rate lines, dimensions / volume / density ratio, the volumetric weight between them and the line totals
export default function useRateLines({ setNatureOfGoods }) {
  const [rateLines, setRateLines] = useState([]);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [showRateLine, setShowRateLine] = useState(false);
  const [showDimension, setShowDimension] = useState(false);
  const [showHSCode, setShowHSCode] = useState(false);
  const [hsCodeTargetIndex, setHsCodeTargetIndex] = useState(null);
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

  useEffect(() => {
    setNoDimensions(dimRows.length === 0 && (parseFloat(volume) || 0) === 0);
  }, [dimRows, volume]);

  // Volume box (MC / CC / CF) -> volumetric weight of line 1 with the density ratio (1:6 = 6000 cm3 per kg, IATA).
  // Lines with their own volume / dimensions (Rate Line window) are the source and are not overwritten.
  useEffect(() => {
    const cbm = cbmOf(volume, mcUnit);
    if (!(cbm > 0) || !rateLines.length || rateLines.some(hasOwnVolume)) return;
    const volumetricWeight = +(dimRows.length && !noDimensions ? volWtFromDims(dimRows, densityGroup) : volWtFromCbm(cbm, densityGroup)).toFixed(2);
    const current = parseFloat(rateLines[0].volumetricWeight) || 0;
    if (Math.abs(current - volumetricWeight) > 0.01) setRateLines((previous) => withVolWt(previous, volumetricWeight));
  }, [volume, densityGroup, mcUnit, dimRows, noDimensions]); // eslint-disable-line react-hooks/exhaustive-deps -- a rate line change must not write back into line 1

  // the rate lines' volume (cbm, from L x W x H in the Rate Line window) fills the Volume box
  useEffect(() => {
    const totalCbm = rateLines.reduce((sum, row) => sum + (parseFloat(row.volume) || 0), 0);
    if (!(totalCbm > 0)) return;
    const rounded = totalCbm.toFixed(3);
    setVolume((previous) => (previous !== rounded ? rounded : previous));
    setMcUnit('MC');
  }, [rateLines, densityGroup]);

  // Dimension window: volume and volumetric weight from the dimension lines; the goods text gets the lines once
  const handleDimensionSave = (dims) => {
    setDimRows(dims);
    const totalCbm = cbmFromDims(dims);
    setVolume(totalCbm > 0 ? totalCbm.toFixed(3) : '');
    setMcUnit('MC');
    const volumetricWeight = +volWtFromDims(dims, densityGroup).toFixed(2);
    setRateLines((previous) => withVolWt(previous, volumetricWeight));
    setNatureOfGoods((previous) => goodsWithDims(previous, dims, volumetricWeight));
  };

  const totalPcs = rateLines.reduce((sum, row) => sum + (parseInt(row.noOfPcs) || 0), 0);
  const totalGrossWt = rateLines.reduce((sum, row) => sum + (parseFloat(row.grossWeight) || 0), 0).toFixed(2);
  const totalVolWt = rateLines.reduce((sum, row) => sum + (parseFloat(row.volumetricWeight) || 0), 0).toFixed(2);
  const totalChgWt = rateLines.reduce((sum, row) => sum + (parseFloat(row.chargeableWeight) || 0), 0).toFixed(2);
  const totalAmountSum = rateLines.reduce((sum, row) => sum + (parseFloat(row.totalAmount) || 0), 0).toFixed(2);

  return {
    rateLines, setRateLines, handleGridChange, activeRowIndex, setActiveRowIndex, showRateLine, setShowRateLine,
    showDimension, setShowDimension, showHSCode, setShowHSCode, hsCodeTargetIndex, setHsCodeTargetIndex,
    dimRows, setDimRows, densityGroup, setDensityGroup, volume, setVolume, mcUnit, setMcUnit, noDimensions, setNoDimensions,
    handleDimensionSave, totalPcs, totalGrossWt, totalVolWt, totalChgWt, totalAmountSum,
  };
}
