import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { freightApi } from '../../../freightApi';
import { showSuccessToast } from '../../../printLogic';
import { sentNotice } from '../../createAwb';
import { applySavedRows, datePart, timePart } from '../../savedAwb';
import { accountingTextOf } from './airWaybillPayload';
import { newTempAwbId } from './airWaybillData';

const AUTO_PRINT_DELAY_MS = 500;
const asText = (value) => value?.toString() || '';

// the saved AWB (GET /awb/search/:no) back on the screen
function fillScreenFromAwb(awb, ctx) {
  const numberParts = awb.awbNumber.split('-');
  if (numberParts.length === 2) {
    ctx.setAwbPrefix(numberParts[0]);
    ctx.setAwbSuffix(numberParts[1]);
  }

  ctx.setDepAirport(awb.origin || awb.depAirport || '');
  ctx.setDestAirport(awb.destination || awb.destAirport || '');
  ctx.setFlightNumber1(awb.flightNumber1 || '');
  ctx.setFlightDate1(datePart(awb.flightDate1 || ''));
  ctx.setFlightTime1(timePart(awb.flightDate1 || ''));
  ctx.setFlightNumber2(awb.flightNumber2 || '');
  ctx.setFlightDate2(datePart(awb.flightDate2 || ''));
  ctx.setFlightTime2(timePart(awb.flightDate2 || ''));
  ctx.setTo1(awb.to1 || '');
  ctx.setBy1(awb.by1 || '');
  ctx.setTo2(awb.to2 || '');
  ctx.setBy2(awb.by2 || '');
  ctx.setTo3(awb.to3 || '');
  ctx.setBy3(awb.by3 || '');

  ctx.setCurrencyCode(awb.currencyCode || 'USD');
  ctx.setChargeCode(awb.chargeCode || 'PP');
  if (awb.wtVal) ctx.setWtValPC(awb.wtVal);
  if (awb.other) ctx.setOtherPC(awb.other);

  // the database keeps them as declaredValueCarriage / declaredValueCustoms / amountOfInsurance / accountingInformation
  ctx.setCarriageValue(awb.declaredValueCarriage || awb.carriageValue || 'NVD');
  ctx.setCustomsValue(awb.declaredValueCustoms || awb.customsValue || 'NCV');
  ctx.setInsuranceValue(awb.amountOfInsurance || awb.insuranceValue || 'XXX');
  ctx.setAccountingInfo(accountingTextOf(awb.accountingInformation || awb.accountingInfo, awb.chargeCode));
  ctx.setSignatureShipper(awb.signatureShipper || '');
  ctx.setSignatureCarrier(awb.signatureCarrier || '');
  ctx.setExecutedDate(awb.executedDate || '');
  ctx.setExecutedPlace(awb.executedPlace || '');

  ctx.setWeightChargePP(asText(awb.weightChargePP));
  ctx.setWeightChargeCC(asText(awb.weightChargeCC));
  ctx.setValChargePP(asText(awb.valChargePP));
  ctx.setValChargeCC(asText(awb.valChargeCC));
  ctx.setTaxPP(asText(awb.taxPP));
  ctx.setTaxCC(asText(awb.taxCC));
  ctx.setCcChargesDest(asText(awb.ccChargesDest));
  ctx.setDestinationCurrency(awb.destinationCurrency || '');

  if (awb.natureOfGoods) ctx.setNatureOfGoods(awb.natureOfGoods);
  ctx.setSsrText(awb.ssr || '');
  ctx.setOsiText(awb.osi || '');
  ctx.setSci(awb.sci || '');

  const formData = awb.formData || {};
  ctx.setAgentDetails({
    name: awb.agentName || '',
    code: awb.agentCode || '',
    account: awb.agentAccountNo || '',
    place: awb.agentPlace || '',
    docs: awb.agentDocs || formData.agentDocs || '',
    eori: awb.agentEori || formData.agentEori || '',
  });
  ctx.setAgentCity(awb.agentCity || formData.agentCity || '');
  ctx.setAgentCountry(awb.agentCountry || formData.agentCountry || '');
  ctx.setAgentLocationCode(formData.agentLocationCode || '');

  ctx.setFlight3(formData.flight3 || formData.flightNumber3 || '');
  ctx.setFlightDate3(formData.flightDate3 || '');
  ctx.setArrivalDate1(formData.arrivalDate1 || '');
  ctx.setShipperEmail(formData.shipperEmail || '');
  ctx.setConsigneeEmail(formData.consigneeEmail || '');
  ctx.setProductId(formData.productId || 'GEN');
  if (formData.densityGroup) ctx.setDensityGroup(formData.densityGroup);
  if (formData.mcUnit) ctx.setMcUnit(formData.mcUnit);
  if (formData.noDimensions) ctx.setNoDimensions(formData.noDimensions);

  applySavedRows(awb, ctx);
  ctx.setExtraDocs(awb.extraDocs || {});
  ctx.setHawbNumber(formData.hawbNumber || '');
}

// MODIFY (open a saved AWB), routing from the MAWB, and an AWB opened from another screen (route state)
export default function useAwbLoader(ctx) {
  const { location } = ctx;

  const handleMawbFetch = async (prefix, suffix) => {
    if (!prefix || !suffix) return;
    const masterNumber = `${prefix}-${suffix}`;
    try {
      const awb = await freightApi.awbByNumber(masterNumber);
      if (!awb || awb.error) return;
      if (awb.origin) ctx.setDepAirport(awb.origin);
      if (awb.destination) ctx.setDestAirport(awb.destination);
      ctx.setFlightNumber1(awb.flightNumber1 || awb.flight1 || '');
      ctx.setFlightDate1(awb.flightDate1 || '');
      ctx.setFlightNumber2(awb.flightNumber2 || '');
      ctx.setFlightDate2(awb.flightDate2 || '');
      toast.success(`Routing / flights filled from MAWB ${masterNumber}`, { duration: 2500 });
    } catch (error) {
      console.log('MAWB not found for auto-fill', error);
    }
  };

  const handleModifyAWB = async (awbNumber) => {
    ctx.setShowModifyModal(false);
    if (!awbNumber) return;
    try {
      const awb = await freightApi.awbByNumber(awbNumber);
      sentNotice(awb); // a sent AWB opens for view / print / amend
      ctx.setCurrentAwbId(awb.id);
      ctx.setTempAwbId(newTempAwbId());
      fillScreenFromAwb(awb, ctx);
      showSuccessToast('Success', 'AWB Loaded for Modification!');
    } catch (error) {
      console.error('handleModifyAWB error:', error);
      showSuccessToast('Error', 'AWB Not Found or Failed to Load!', true);
    }
  };

  useEffect(() => {
    const awbNumber = location.state?.loadAwbNumber;
    if (!awbNumber) return;
    const openFromRoute = async () => {
      await handleModifyAWB(awbNumber);
      if (location.state.autoPrint) setTimeout(() => ctx.setShowPrintOptions(true), AUTO_PRINT_DELAY_MS);
      window.history.replaceState({}, document.title);
    };
    openFromRoute();
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps -- loads once per route state

  return { handleMawbFetch, handleModifyAWB };
}
