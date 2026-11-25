import { loggedInUser } from './masterWaybillData';

const flightDateTime = (date, time) => (date ? `${date}T${time || '00:00:00'}` : '');

// dimension lines of the rate lines (Rate Line window) win over the screen's dimension list
const dimensionRowsOf = (rateLines, dimRows) => {
  if (!rateLines.some((line) => line.dimensions && line.dimensions.length > 0)) return dimRows;
  return rateLines.flatMap((line, rateLineIndex) => (line.dimensions || [])
    .filter((dimension) => dimension.length && dimension.width && dimension.height)
    .map((dimension) => ({ ...dimension, rateLineIndex })));
};

// the body of POST /awb/create and PUT /awb/update for a MAWB
export function buildMasterPayload(form) {
  const {
    awbPrefix, awbSuffix, agentDetails, parties, rateLines, otherCharges, otherPC, dimRows,
    weightChargePP, weightChargeCC, valChargePP, valChargeCC, taxPP, taxCC, totalPP, totalCC,
    destinationCurrency, natureOfGoods, densityGroup, volume, mcUnit, noDimensions, depAirport, destAirport,
    to1, by1, to2, by2, to3, by3, flightNumber1, flightDate1, flightTime1, flightNumber2, flightDate2, flightTime2,
    flight3, flightDate3, arrivalDate1, shipperEmail, consigneeEmail, agentLocationCode, productId,
    ccChargesDest, currencyCode, chargeCode, wtValPC, carriageValue, customsValue, insuranceValue, accountingInfo,
    signatureShipper, signatureCarrier, executedDate, executedPlace, osiText, ssrText, sphCodes, ociRows, sci,
    tempAwbId, extraDocs,
  } = form;
  const party = (title) => parties[title] || {};

  return {
    awbNumber: `${awbPrefix}-${awbSuffix}`,
    type: 'MAWB',
    user: loggedInUser(),
    formData: {
      agentName: agentDetails?.name || '',
      agentCode: agentDetails?.code || '',
      agentAccountNo: agentDetails?.account || agentDetails?.accountNo || '',
      agentPlace: agentDetails?.place || '',
      agentCity: agentDetails?.city || '',
      agentCountry: agentDetails?.country || 'IN',
      agentZip: agentDetails?.zip || '',
      weightChargePP: parseFloat(weightChargePP) || 0,
      weightChargeCC: parseFloat(weightChargeCC) || 0,
      valChargePP: parseFloat(valChargePP) || 0,
      valChargeCC: parseFloat(valChargeCC) || 0,
      taxPP: parseFloat(taxPP) || 0,
      taxCC: parseFloat(taxCC) || 0,
      totalPP: totalPP || 0,
      totalCC: totalCC || 0,
      totalPieces: rateLines.reduce((sum, line) => sum + parseInt(line.pieces || line.noOfPcs || 0), 0) || 1,
      grossWeight: parseFloat(rateLines.reduce((sum, line) => sum + (parseFloat(line.grossWeight) || 0), 0).toFixed(2)) || 0.1,
      totalVolume: parseFloat(rateLines.reduce((sum, line) => sum + (parseFloat(line.volume) || 0), 0).toFixed(3)) || 0,
      destinationCurrency: destinationCurrency || '',
      natureOfGoods,
      densityGroup,
      volume,
      mcUnit,
      noDimensions,
      dep: depAirport || '',
      dest: destAirport || '',
      depAirport: depAirport || '',
      destAirport: destAirport || '',
      to1: to1 || '',
      by1: by1 || '',
      to2: to2 || '',
      by2: by2 || '',
      to3: to3 || '',
      by3: by3 || '',
      flight1: flightNumber1 || '',
      flightNumber1: flightNumber1 || '',
      flightDate1: flightDateTime(flightDate1, flightTime1),
      flightNumber2: flightNumber2 || '',
      flightDate2: flightDateTime(flightDate2, flightTime2),
      flight3: flight3 || '',
      flightNumber3: flight3 || '',
      flightDate3: flightDate3 || '',
      arrivalDate1: arrivalDate1 || '',
      shipperEmail: parties['Shipper']?.email || shipperEmail || '',
      consigneeEmail: parties['Consignee']?.email || consigneeEmail || '',
      agentLocationCode: agentLocationCode || '',
      productId: productId || 'GEN',
      agentDocs: agentDetails?.docs || '',
      agentEori: agentDetails?.eori || '',
      ccChargesDest: parseFloat(ccChargesDest) || 0,
      currencyCode: currencyCode || 'INR',
      chargeCode: chargeCode || 'PP',
      wtVal: wtValPC || 'P',
      other: otherPC || 'P',
      carriageValue: carriageValue || 'NVD',
      customsValue: customsValue || 'NCV',
      insurance: insuranceValue || 'XXX',
      accountingInfo: accountingInfo || (String(chargeCode || '').startsWith('C') ? 'FREIGHT COLLECT' : 'FREIGHT PREPAID'),
      signatureShipper: signatureShipper || '',
      signatureCarrier: signatureCarrier || '',
      executedDate: executedDate || '',
      executedPlace: executedPlace || '',
      shipper: party('Shipper'),
      consignee: party('Consignee'),
      buyer: party('Buyer'),
      subAgent: party('Sub Agent'),
      overseasAgent: party('Overseas Agent'),
      notify1: party('Notify 1'),
      notify2: party('Notify 2'),
    },
    rateLines,
    otherCharges: Array.isArray(otherCharges) ? otherCharges.map((charge) => ({ ...charge, ppcc: charge.ppcc || (otherPC === 'C' ? 'CC' : 'PP') })) : [],
    handlingInformation: osiText,
    sphCodes,
    ociRows,
    dimRows: dimensionRowsOf(rateLines, dimRows),
    ssr: ssrText,
    osi: osiText,
    sci,
    docTempId: tempAwbId || '',
    extraDocs: extraDocs || {},
  };
}
