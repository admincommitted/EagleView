import { recalcRow, volWtFromDims } from '../../weightCalc';

// the goods text is kept within the size of the nature-of-goods box
const GOODS_TEXT_LIMIT = 380;
const AUTO_FILL_PARTIES = [['Shipper', 'shipper'], ['Consignee', 'consignee'], ['Buyer', 'buyer']];

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

const hasAllSides = (dimension) => (parseFloat(dimension.length) || 0) && (parseFloat(dimension.width) || 0) && (parseFloat(dimension.height) || 0);

function goodsTextFromDocument(data, densityGroup) {
  let goodsText = 'SAID TO CONTAIN\n';
  if (data.commodityDescription) goodsText += `${data.commodityDescription.toUpperCase()}\n`;
  if (data.hsCode) goodsText += `HS CODE: ${data.hsCode}\n`;
  if (data.invoiceNumber) goodsText += `INV NO.: ${data.invoiceNumber}\n`;
  if (data.invoiceDate) goodsText += `INV DT.: ${data.invoiceDate}\n`;

  const dimensions = Array.isArray(data.dimensions) ? data.dimensions.filter(hasAllSides) : [];
  // volumetric weight with the IATA ratio of the screen
  const volumetricWeight = dimensions.reduce((sum, dimension) => sum + volWtFromDims([dimension], densityGroup), 0);
  if (volumetricWeight > 0) goodsText += `VOL WT.: ${volumetricWeight.toFixed(2)} KG\n`;

  const dimensionTexts = dimensions.map((dimension) => `${parseInt(dimension.pieces, 10) || 1} PCS-${parseFloat(dimension.length)}X${parseFloat(dimension.width)}X${parseFloat(dimension.height)} ${dimension.unit || 'CM'}`);
  if (dimensionTexts.length > 0) {
    const dimensionLine = `DIMS: ${dimensionTexts.join(', ')}`;
    if ((goodsText.length + dimensionLine.length) < GOODS_TEXT_LIMIT) goodsText += dimensionLine;
  }
  return goodsText.trim();
}

// OCR / document read: parties, airports, pieces / weights, goods text and the handling information
export default function useDocumentAutoFill(ctx) {
  const handleAutoFill = (data) => {
    AUTO_FILL_PARTIES.forEach(([title, prefix]) => {
      if (data[`${prefix}Name`]) ctx.setParties((previous) => ({ ...previous, [title]: partyFromDocument(data, prefix) }));
    });

    if (data.origin) ctx.setDepAirport(data.origin);
    if (data.destination) ctx.setDestAirport(data.destination);

    if (data.totalPieces || data.grossWeight || data.dimensions) {
      // volumetric weight from the dimensions read (IATA ratio of the screen), chargeable weight by weightCalc
      ctx.setRateLines((previous) => {
        const lines = [...(previous || [])];
        if (!lines.length) lines.push({ id: 1, isRounded: true });
        const dimensions = Array.isArray(data.dimensions) ? data.dimensions : [];
        const volumetricKg = dimensions.length ? +volWtFromDims(dimensions, ctx.densityGroup).toFixed(2) : 0;
        lines[0] = recalcRow({
          ...lines[0],
          noOfPcs: data.totalPieces || lines[0].noOfPcs,
          pieces: data.totalPieces || lines[0].pieces,
          grossWeight: data.grossWeight || lines[0].grossWeight,
          ...(volumetricKg ? { volumetricWeight: volumetricKg } : {}),
        }, 'grossWeight');
        return lines;
      });
    }

    ctx.setNatureOfGoods(goodsTextFromDocument(data, ctx.densityGroup));
    const marks = data.marksAndNumbers ? ` - ${data.marksAndNumbers}` : '';
    ctx.setOsiText(`PLEASE INFORM CONSIGNEE IMMEDIATELY ON ARRIVAL OF CARGO${marks}`);
  };

  return { handleAutoFill };
}
