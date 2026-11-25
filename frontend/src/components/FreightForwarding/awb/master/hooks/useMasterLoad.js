import { useEffect, useState } from 'react';
import { applySavedRows, datePart, timePart } from '../../savedAwb';
import { sentNotice } from '../../createAwb';
import { freightApi } from '../../../freightApi';
import { showSuccessToast } from '../../../printLogic';
import { houseRow, newTempAwbId } from './masterWaybillData';
import { fetchSavedHouses } from './useLinkedHouses';

const AUTO_PRINT_DELAY_MS = 500;

const accountingDefault = (chargeCode) => (String(chargeCode || '').startsWith('C') ? 'FREIGHT COLLECT' : 'FREIGHT PREPAID');

// MODIFY: a saved MAWB back on the screen (also opened from another screen with route state loadAwbNumber / autoPrint)
export default function useMasterLoad(form) {
  const { location, setShowPrintOptions } = form;
  const [showModifyModal, setShowModifyModal] = useState(false);

  const markIfSent = async (awbNumber) => {
    try {
      const logs = await freightApi.awbLogs(awbNumber);
      if (logs.success && Array.isArray(logs.data)) form.setXfwbSent(logs.data.some((log) => log.action === 'FWB_TRANSMITTED'));
    } catch {
      // the sent flag stays as it is
    }
  };

  const loadSavedHousesOf = async (awbNumber) => {
    try {
      const houses = await fetchSavedHouses(awbNumber);
      if (Array.isArray(houses) && houses.length > 0) form.setLinkedHawbs(houses.map(houseRow));
    } catch (error) {
      console.warn('Could not load linked HAWBs:', error.message);
    }
  };

  const showSavedMaster = (awb) => {
    const saved = awb.formData || {};
    const numberParts = awb.awbNumber.split('-');
    if (numberParts.length === 2) {
      form.setAwbPrefix(numberParts[0]);
      form.setAwbSuffix(numberParts[1]);
    }
    applySavedRows(awb, form);
    form.setExtraDocs(awb.extraDocs || {});
    if (saved.densityGroup) form.setDensityGroup(saved.densityGroup);
    if (saved.mcUnit) form.setMcUnit(saved.mcUnit);
    form.setNoDimensions(!!saved.noDimensions);

    form.setSsrText(awb.ssr || '');
    form.setOsiText(awb.osi || '');
    form.setSci(awb.sci || '');
    form.setAgentDetails((previous) => ({
      ...previous,
      name: awb.agentName || '',
      code: awb.agentCode || '',
      account: awb.agentAccountNo || '',
      place: awb.agentPlace || '',
      city: awb.agentCity || saved.agentCity || '',
      country: awb.agentCountry || saved.agentCountry || previous.country || '',
      docs: awb.agentDocs || saved.agentDocs || previous.docs || '',
      eori: awb.agentEori || saved.agentEori || '',
    }));

    form.setWeightChargePP(awb.weightChargePP ?? '');
    form.setWeightChargeCC(awb.weightChargeCC ?? '');
    form.setValChargePP(awb.valChargePP ?? '');
    form.setValChargeCC(awb.valChargeCC ?? '');
    form.setTaxPP(awb.taxPP ?? '');
    form.setTaxCC(awb.taxCC ?? '');
    form.setDestinationCurrency(awb.destinationCurrency || saved.destinationCurrency || '');
    form.setCcChargesDest(awb.ccChargesDest ?? saved.ccChargesDest ?? '');
    form.setNatureOfGoods(awb.natureOfGoods || saved.natureOfGoods || '');
    form.setProductId(saved.productId || 'GEN');
    form.setFlight3(awb.flightNumber3 || saved.flight3 || saved.flightNumber3 || '');
    form.setFlightDate3(awb.flightDate3 || saved.flightDate3 || '');
    form.setArrivalDate1(saved.arrivalDate1 || '');
    form.setAgentLocationCode(saved.agentLocationCode || '');

    form.setDepAirport(awb.origin || saved.dep || saved.depAirport || '');
    form.setDestAirport(awb.destination || saved.dest || saved.destAirport || '');
    form.setTo1(awb.to1 || saved.to1 || '');
    form.setBy1(awb.by1 || saved.by1 || '');
    form.setTo2(awb.to2 || saved.to2 || '');
    form.setBy2(awb.by2 || saved.by2 || '');
    form.setTo3(awb.to3 || saved.to3 || '');
    form.setBy3(awb.by3 || saved.by3 || '');
    form.setFlightNumber1(awb.flightNumber1 || saved.flight1 || saved.flightNumber1 || '');
    form.setFlightDate1(datePart(awb.flightDate1 || saved.flightDate1));
    form.setFlightTime1(timePart(awb.flightDate1 || saved.flightDate1));
    form.setFlightNumber2(awb.flightNumber2 || saved.flightNumber2 || '');
    form.setFlightDate2(datePart(awb.flightDate2 || saved.flightDate2));
    form.setFlightTime2(timePart(awb.flightDate2 || saved.flightDate2));
    form.setCurrencyCode(awb.currencyCode || 'USD');
    form.setChargeCode(awb.chargeCode || 'PP');
    if (awb.wtVal) form.setWtValPC(awb.wtVal);
    if (awb.other) form.setOtherPC(awb.other);
    form.setCarriageValue(awb.declaredValueCarriage || saved.carriageValue || 'NVD');
    form.setCustomsValue(awb.declaredValueCustoms || saved.customsValue || 'NCV');
    form.setInsuranceValue(awb.amountOfInsurance || saved.insurance || 'XXX');
    form.setAccountingInfo(awb.accountingInformation || saved.accountingInfo || accountingDefault(awb.chargeCode));
    form.setSignatureShipper(awb.signatureShipper || '');
    form.setSignatureCarrier(awb.signatureCarrier || '');
    form.setExecutedDate(awb.executedDate || '');
    form.setExecutedPlace(awb.executedPlace || '');
  };

  const handleModifyAWB = async (searchAwb) => {
    setShowModifyModal(false);
    if (!searchAwb) return;
    try {
      const awb = await freightApi.awbByNumber(searchAwb);
      sentNotice(awb);
      form.setCurrentAwbId(awb.id);
      form.setTempAwbId(newTempAwbId());
      await markIfSent(awb.awbNumber);
      showSavedMaster(awb);
      await loadSavedHousesOf(awb.awbNumber);
      showSuccessToast('Success', 'MAWB Loaded for Modification!');
    } catch {
      showSuccessToast('Error', 'MAWB Not Found!', true);
    }
  };

  useEffect(() => {
    const loadAwbNumber = location.state?.loadAwbNumber;
    if (!loadAwbNumber) return;
    const autoPrint = location.state.autoPrint;
    const openFromRoute = async () => {
      await handleModifyAWB(loadAwbNumber);
      if (autoPrint) setTimeout(() => setShowPrintOptions(true), AUTO_PRINT_DELAY_MS);
      window.history.replaceState({}, document.title);
    };
    openFromRoute();
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps -- opened once per route state

  return { handleModifyAWB, showModifyModal, setShowModifyModal };
}
