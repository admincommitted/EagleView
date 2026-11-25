import { recalcRow, volWtFromDims } from '../../weightCalc';
import { goodsTextFromDocument } from './masterWaybillData';

const PARTY_PREFIXES = [['Shipper', 'shipper'], ['Consignee', 'consignee'], ['Buyer', 'buyer']];

const partyFromDocument = (data, prefix) => ({
  name: data[`${prefix}Name`],
  street: data[`${prefix}Address`],
  city: data[`${prefix}City`] || '',
  state: data[`${prefix}State`] || '',
  country: data[`${prefix}Country`] || '',
  zip: data[`${prefix}Zip`] || '',
  phone: data[`${prefix}Phone`] || '',
  email: data[`${prefix}Email`] || '',
});

// fill parties, airports, the first rate line, goods and OSI from a document read by OCR
export default function useDocumentAutoFill({ densityGroup, setParties, setDepAirport, setDestAirport, setRateLines, setNatureOfGoods, setOsiText }) {
  const handleAutoFill = (data) => {
    PARTY_PREFIXES.forEach(([title, prefix]) => {
      if (data[`${prefix}Name`]) setParties((previous) => ({ ...previous, [title]: partyFromDocument(data, prefix) }));
    });
    if (data.origin) setDepAirport(data.origin);
    if (data.destination) setDestAirport(data.destination);

    // volumetric weight from the dimensions read (density ratio of the screen), chargeable weight by weightCalc
    if (data.totalPieces || data.grossWeight || data.dimensions) {
      setRateLines((previous) => {
        const lines = [...(previous || [])];
        if (!lines.length) lines.push({ id: 1, isRounded: true });
        const dims = Array.isArray(data.dimensions) ? data.dimensions : [];
        const volumetricWeight = dims.length ? +volWtFromDims(dims, densityGroup).toFixed(2) : 0;
        lines[0] = recalcRow({
          ...lines[0],
          noOfPcs: data.totalPieces || lines[0].noOfPcs,
          pieces: data.totalPieces || lines[0].pieces,
          grossWeight: data.grossWeight || lines[0].grossWeight,
          ...(volumetricWeight ? { volumetricWeight } : {}),
        }, 'grossWeight');
        return lines;
      });
    }

    setNatureOfGoods(goodsTextFromDocument(data, densityGroup));
    const marks = data.marksAndNumbers ? ` - ${data.marksAndNumbers}` : '';
    setOsiText(`PLEASE INFORM CONSIGNEE IMMEDIATELY ON ARRIVAL OF CARGO${marks}`);
  };

  return { handleAutoFill };
}
