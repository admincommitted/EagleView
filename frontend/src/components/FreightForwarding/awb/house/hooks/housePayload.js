import { chargeErrors, rateLineErrors, routeError } from '../../awbChecks';
import { loggedInUser, sumOf } from './houseWaybillData';

const withTime = (date, time) => (date ? `${date}T${time || '00:00:00'}` : '');

export const defaultAccountingInfo = (chargeCode) => (String(chargeCode || '').startsWith('C') ? 'FREIGHT COLLECT' : 'FREIGHT PREPAID');

// the first reason the HAWB cannot be saved, or '' when it can
export function houseSaveProblem(form) {
  const { awbPrefix, awbSuffix, getAwbError, depAirport, destAirport, hawbNumber, parties, rateLines, otherCharges } = form;
  const origin = depAirport || '';
  const destination = destAirport || '';
  if (!awbPrefix || !awbSuffix || awbPrefix.length < 3 || awbSuffix.length < 8) return 'Valid AWB Number is mandatory!';
  const checkDigitError = getAwbError();
  if (checkDigitError) return `AWB Check Digit Error: ${checkDigitError}`;
  if (origin.length !== 3 || destination.length !== 3) return 'Valid 3-letter Origin and Destination Airports are mandatory!';
  if (!hawbNumber) return 'House AWB Number (HAWB NO) is mandatory!';
  if (!parties['Shipper']?.name || !parties['Consignee']?.name) return 'Shipper and Consignee names are mandatory!';
  if (!rateLines.some((line) => line.grossWeight && parseFloat(line.grossWeight) > 0)) return 'At least one Rate Line with Gross Weight is mandatory!';
  return [routeError(origin, destination), ...rateLineErrors(rateLines), ...chargeErrors(otherCharges)].filter(Boolean).join('\n');
}

// rate-line dimensions (Rate Line window) win over the screen's dimension list
const savedDimensions = (rateLines, dimRows) => {
  if (!rateLines.some((line) => line.dimensions && line.dimensions.length > 0)) return dimRows;
  return rateLines.flatMap((line, rateLineIndex) => (line.dimensions || [])
    .filter((dimension) => dimension.length && dimension.width && dimension.height)
    .map((dimension) => ({ ...dimension, rateLineIndex })));
};

export function houseSavePayload(form) {
  const {
    agentDetails, agentLocationCode, accountingInfo, awbPrefix, awbSuffix, hawbNumber, parties, shipperEmail, consigneeEmail,
    depAirport, destAirport, to1, by1, to2, by2, to3, by3, flightNumber1, flightDate1, flightTime1, flightNumber2, flightDate2, flightTime2,
    flight3, flightDate3, arrivalDate1, destinationCurrency, ccChargesDest, currencyCode, chargeCode, carriageValue, customsValue, insuranceValue,
    wtValPC, otherPC, weightChargePP, weightChargeCC, valChargePP, valChargeCC, taxPP, taxCC, totalPP, totalCC, otherCharges,
    rateLines, dimRows, densityGroup, volume, mcUnit, noDimensions, natureOfGoods, productId, sphCodes, ssrText, osiText, sci, ociRows,
    signatureShipper, signatureCarrier, executedDate, executedPlace, tempAwbId, extraDocs,
  } = form;
  const partyOf = (title) => parties[title] || {};

  return {
    awbNumber: hawbNumber || 'DRAFT',
    masterAwbNumber: awbPrefix && awbSuffix ? `${awbPrefix}-${awbSuffix}` : '',
    type: 'HAWB',
    user: loggedInUser(),
    formData: {
      agentName: agentDetails.name || '',
      agentCode: agentDetails.code || '',
      agentAccountNo: agentDetails.account || agentDetails.accountNo || '',
      agentPlace: agentDetails.place || '',
      agentCity: agentDetails.city || '',
      agentCountry: agentDetails.country || 'IN',
      agentZip: agentDetails.zip || '',
      weightChargePP: parseFloat(weightChargePP) || 0,
      weightChargeCC: parseFloat(weightChargeCC) || 0,
      valChargePP: parseFloat(valChargePP) || 0,
      valChargeCC: parseFloat(valChargeCC) || 0,
      taxPP: parseFloat(taxPP) || 0,
      taxCC: parseFloat(taxCC) || 0,
      totalPP: totalPP || 0,
      totalCC: totalCC || 0,
      totalPieces: rateLines.reduce((sum, line) => sum + parseInt(line.pieces || line.noOfPcs || 0, 10), 0) || 1,
      grossWeight: parseFloat(sumOf(rateLines, 'grossWeight').toFixed(2)) || 0.1,
      totalVolume: parseFloat(sumOf(rateLines, 'volume').toFixed(3)) || 0,
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
      flightDate1: withTime(flightDate1, flightTime1),
      flightNumber2: flightNumber2 || '',
      flightDate2: withTime(flightDate2, flightTime2),
      destinationCurrency: destinationCurrency || '',
      currencyCode: currencyCode || 'INR',
      chargeCode: chargeCode || 'PP',
      wtVal: wtValPC || 'P',
      other: otherPC || 'P',
      carriageValue: carriageValue || 'NVD',
      customsValue: customsValue || 'NCV',
      insurance: insuranceValue || 'XXX',
      accountingInfo: accountingInfo || defaultAccountingInfo(chargeCode),
      agentDocs: agentDetails.docs || '',
      agentEori: agentDetails.eori || '',
      signatureShipper: signatureShipper || '',
      signatureCarrier: signatureCarrier || '',
      executedDate: executedDate || '',
      executedPlace: executedPlace || '',
      shipper: partyOf('Shipper'),
      consignee: partyOf('Consignee'),
      buyer: partyOf('Buyer'),
      subAgent: partyOf('Sub Agent'),
      overseasAgent: partyOf('Overseas Agent'),
      notify1: partyOf('Notify 1'),
      notify2: partyOf('Notify 2'),
      shipperEmail: parties['Shipper']?.email || shipperEmail || '',
      consigneeEmail: parties['Consignee']?.email || consigneeEmail || '',
      agentLocationCode: agentLocationCode || '',
      productId: productId || 'GEN',
      arrivalDate1: arrivalDate1 || '',
      flight3: flight3 || '',
      flightNumber3: flight3 || '',
      flightDate3: flightDate3 || '',
      ccChargesDest: parseFloat(ccChargesDest) || 0,
    },
    rateLines,
    otherCharges: Array.isArray(otherCharges) ? otherCharges.map((charge) => ({ ...charge, ppcc: charge.ppcc || (otherPC === 'C' ? 'CC' : 'PP') })) : [],
    sphCodes,
    ociRows,
    dimRows: savedDimensions(rateLines, dimRows),
    ssr: ssrText,
    osi: osiText,
    sci,
    handlingInformation: osiText,
    docTempId: tempAwbId || '',
    extraDocs: extraDocs || {},
  };
}
