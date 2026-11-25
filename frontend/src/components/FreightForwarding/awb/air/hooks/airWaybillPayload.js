// The AWB as the server saves it (POST /awb/create, PUT /awb/update/:id) from the screen state.
const flightStamp = (date, time) => {
  if (!date) return '';
  return time ? `${date}T${time}` : `${date}T00:00:00`;
};

// with the chosen charge code: FREIGHT COLLECT for CC.., else FREIGHT PREPAID (the text typed comes first)
export const accountingTextOf = (accountingInfo, chargeCode) => accountingInfo || (String(chargeCode || '').startsWith('C') ? 'FREIGHT COLLECT' : 'FREIGHT PREPAID');

const partyOf = (parties, title) => parties[title] || {};

function lineTotals(rateLines) {
  const pieces = rateLines.reduce((sum, line) => sum + parseInt(line.pieces || line.noOfPcs || 0, 10), 0);
  const gross = rateLines.reduce((sum, line) => sum + (parseFloat(line.grossWeight) || 0), 0);
  const volume = rateLines.reduce((sum, line) => sum + (parseFloat(line.volume) || 0), 0);
  return {
    totalPieces: pieces || 1,
    grossWeight: parseFloat(gross.toFixed(2)) || 0.1,
    totalVolume: parseFloat(volume.toFixed(3)) || 0,
  };
}

export function buildAwbPayload(ctx) {
  const { awbPrefix, awbSuffix, agentDetails, parties, rateLines, otherCharges, otherPC, chargeCode } = ctx;
  return {
    awbNumber: awbPrefix && awbSuffix ? awbPrefix + '-' + awbSuffix : 'DRAFT',
    type: 'AWB',
    formData: {
      agentName: agentDetails?.name || '',
      agentCode: agentDetails?.code || '',
      agentAccountNo: agentDetails?.account || agentDetails?.accountNo || '',
      agentPlace: agentDetails?.place || '',
      agentCity: ctx.agentCity || '',
      agentCountry: ctx.agentCountry || '',
      agentLocationCode: ctx.agentLocationCode || '',
      agentDocs: agentDetails?.docs || '',
      agentEori: agentDetails?.eori || '',
      weightChargePP: parseFloat(ctx.weightChargePP) || 0,
      weightChargeCC: parseFloat(ctx.weightChargeCC) || 0,
      valChargePP: parseFloat(ctx.valChargePP) || 0,
      valChargeCC: parseFloat(ctx.valChargeCC) || 0,
      taxPP: parseFloat(ctx.taxPP) || 0,
      taxCC: parseFloat(ctx.taxCC) || 0,
      totalPP: ctx.totalPP || 0,
      totalCC: ctx.totalCC || 0,
      ccChargesDest: parseFloat(ctx.ccChargesDest) || 0,
      ...lineTotals(rateLines),
      natureOfGoods: ctx.natureOfGoods,
      densityGroup: ctx.densityGroup,
      volume: ctx.volume,
      mcUnit: ctx.mcUnit,
      noDimensions: ctx.noDimensions,
      dep: ctx.depAirport || '',
      dest: ctx.destAirport || '',
      depAirport: ctx.depAirport || '',
      destAirport: ctx.destAirport || '',
      to1: ctx.to1 || '',
      by1: ctx.by1 || '',
      to2: ctx.to2 || '',
      by2: ctx.by2 || '',
      to3: ctx.to3 || '',
      by3: ctx.by3 || '',
      flight1: ctx.flightNumber1 || '',
      flightNumber1: ctx.flightNumber1 || '',
      flightDate1: flightStamp(ctx.flightDate1, ctx.flightTime1),
      flightNumber2: ctx.flightNumber2 || '',
      flightDate2: flightStamp(ctx.flightDate2, ctx.flightTime2),
      flight3: ctx.flight3 || '',
      flightNumber3: ctx.flight3 || '',
      flightDate3: ctx.flightDate3 || '',
      arrivalDate1: ctx.arrivalDate1 || '',
      destinationCurrency: ctx.destinationCurrency || '',
      currencyCode: ctx.currencyCode || 'INR',
      chargeCode: chargeCode || 'PP',
      wtVal: ctx.wtValPC || 'P',
      other: otherPC || 'P',
      carriageValue: ctx.carriageValue || 'NVD',
      customsValue: ctx.customsValue || 'NCV',
      insurance: ctx.insuranceValue || 'XXX',
      accountingInfo: accountingTextOf(ctx.accountingInfo, chargeCode),
      hawbNumber: ctx.hawbNumber || '',
      signatureShipper: ctx.signatureShipper || '',
      signatureCarrier: ctx.signatureCarrier || '',
      executedDate: ctx.executedDate || '',
      executedPlace: ctx.executedPlace || '',
      productId: ctx.productId || 'GEN',
      shipperEmail: parties.Shipper?.email || ctx.shipperEmail || '',
      consigneeEmail: parties.Consignee?.email || ctx.consigneeEmail || '',
      shipper: partyOf(parties, 'Shipper'),
      consignee: partyOf(parties, 'Consignee'),
      buyer: partyOf(parties, 'Buyer'),
      subAgent: partyOf(parties, 'Sub Agent'),
      overseasAgent: partyOf(parties, 'Overseas Agent'),
      notify1: partyOf(parties, 'Notify 1'),
      notify2: partyOf(parties, 'Notify 2'),
    },
    rateLines,
    otherCharges: Array.isArray(otherCharges) ? otherCharges.map((charge) => ({ ...charge, ppcc: charge.ppcc || (otherPC === 'C' ? 'CC' : 'PP') })) : [],
    sphCodes: ctx.sphCodes,
    ociRows: ctx.ociRows,
    dimRows: ctx.dimRows,
    ssr: ctx.ssrText,
    osi: ctx.osiText,
    sci: ctx.sci,
    handlingInformation: ctx.osiText,
    docTempId: ctx.tempAwbId || '', // e-documents uploaded before the first save are linked to this AWB
    extraDocs: ctx.extraDocs || {},
  };
}
