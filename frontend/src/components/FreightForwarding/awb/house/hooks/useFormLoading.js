import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { freightApi } from '../../../freightApi';
import { showSuccessToast } from '../../../printLogic';
import { sentNotice } from '../../createAwb';
import { applySavedRows, datePart, emptyParties, timePart } from '../../savedAwb';
import { recalcRow, volWtFromDims } from '../../weightCalc';
import { defaultAccountingInfo } from './housePayload';
import {
  DEFAULT_EXECUTED_PLACE, DRAFT_STORAGE_KEY, SPH_SLOTS, goodsTextFromScan, newDocPouchId, splitMasterNumber,
} from './houseWaybillData';

const MAWB_FILLED_TOAST_MS = 2500;
const AUTO_PRINT_DELAY_MS = 500;

const savedAirport = (code, ...fallbacks) => (code && code !== 'UNK' ? code : fallbacks.find(Boolean) || '');

const flightDateOf = (value) => (value.includes('T') ? value.split('T')[0] : value);
const flightTimeOf = (value) => (value.includes('T') ? value.split('T')[1].substring(0, 5) : '');

// fills the screen: routing from the linked MAWB, a saved HAWB (MODIFY / opened from another screen), a scanned
// document (auto-fill) - and CLEAR
export default function useFormLoading(form) {
  const {
    location, freshScreen, densityGroup,
    setCurrentAwbId, setTempAwbId, setExtraDocs, setShowModifyModal, setShowPrintOptions,
    setHawbNumber, setAwbPrefix, setAwbSuffix, setParties, setAgentDetails, setAccountingInfo, setAgentLocationCode,
    setDepAirport, setDestAirport, setDestinationCurrency, setCcChargesDest, setTo1, setBy1, setTo2, setBy2, setTo3, setBy3,
    setFlightNumber1, setFlightDate1, setFlightTime1, setFlightNumber2, setFlightDate2, setFlightTime2,
    setFlight3, setFlightDate3, setArrivalDate1,
    setRateLines, setOtherCharges, setOciRows, setDimRows, setVolume, setDensityGroup, setMcUnit, setNoDimensions,
    setNatureOfGoods, setSphCodes, setSsrText, setOsiText, setSci, setProductId,
    setWeightChargePP, setWeightChargeCC, setValChargePP, setValChargeCC, setTaxPP, setTaxCC, setWtValPC, setOtherPC,
    setCurrencyCode, setChargeCode, setCarriageValue, setCustomsValue, setInsuranceValue,
    setSignatureShipper, setSignatureCarrier, setExecutedDate, setExecutedPlace, getTodayDate,
  } = form;

  const handleMawbFetch = async (prefix, suffix) => {
    if (!prefix || !suffix) return;
    const masterNumber = `${prefix}-${suffix}`;
    try {
      const master = await freightApi.awbByNumber(masterNumber);
      if (!master || master.error) return;
      if (master.origin) setDepAirport(master.origin);
      if (master.destination) setDestAirport(master.destination);
      const firstFlightDate = master.flightDate1 || '';
      const secondFlightDate = master.flightDate2 || '';
      setFlightNumber1(master.flightNumber1 || master.flight1 || '');
      setFlightDate1(flightDateOf(firstFlightDate));
      setFlightTime1(flightTimeOf(firstFlightDate));
      setFlightNumber2(master.flightNumber2 || '');
      setFlightDate2(flightDateOf(secondFlightDate));
      setFlightTime2(flightTimeOf(secondFlightDate));
      toast.success(`Routing / flights filled from MAWB ${masterNumber}`, { duration: MAWB_FILLED_TOAST_MS });
    } catch (error) {
      // not a MAWB (yet): the user may still be typing
      console.log('MAWB not found for auto-fill', error);
    }
  };

  const handleModifyAWB = async (searchAwb) => {
    setShowModifyModal(false);
    if (!searchAwb) return;
    try {
      const awb = await freightApi.awbByNumber(searchAwb);
      sentNotice(awb);
      setCurrentAwbId(awb.id);
      setTempAwbId(newDocPouchId());

      const saved = awb.formData || {};
      setHawbNumber(awb.awbNumber || '');
      const [masterPrefix, masterSuffix] = splitMasterNumber(awb.masterAwbNumber);
      setAwbPrefix(masterPrefix);
      setAwbSuffix(masterSuffix);

      applySavedRows(awb, { setRateLines, setOtherCharges, setOciRows, setSphCodes, setDimRows, setVolume, setParties });
      setExtraDocs(awb.extraDocs || {});
      if (saved.densityGroup) setDensityGroup(saved.densityGroup);
      if (saved.mcUnit) setMcUnit(saved.mcUnit);
      setNoDimensions(!!saved.noDimensions);

      setSsrText(awb.ssr || '');
      setOsiText(awb.osi || '');
      setSci(awb.sci || '');
      setAgentDetails((previous) => ({
        ...previous,
        name: awb.agentName || '', code: awb.agentCode || '', account: awb.agentAccountNo || '', place: awb.agentPlace || '',
        city: awb.agentCity || saved.agentCity || '', country: awb.agentCountry || saved.agentCountry || previous.country || '',
        docs: awb.agentDocs || saved.agentDocs || previous.docs || '', eori: awb.agentEori || saved.agentEori || '',
      }));

      setWeightChargePP(awb.weightChargePP ?? '');
      setWeightChargeCC(awb.weightChargeCC ?? '');
      setValChargePP(awb.valChargePP ?? '');
      setValChargeCC(awb.valChargeCC ?? '');
      setTaxPP(awb.taxPP ?? '');
      setTaxCC(awb.taxCC ?? '');
      setDestinationCurrency(awb.destinationCurrency || saved.destinationCurrency || '');
      setCcChargesDest(awb.ccChargesDest ?? saved.ccChargesDest ?? '');
      setNatureOfGoods(awb.natureOfGoods || saved.natureOfGoods || '');
      setProductId(saved.productId || 'GEN');
      setFlight3(awb.flightNumber3 || saved.flight3 || saved.flightNumber3 || '');
      setFlightDate3(awb.flightDate3 || saved.flightDate3 || '');
      setArrivalDate1(saved.arrivalDate1 || '');
      setAgentLocationCode(saved.agentLocationCode || '');

      setDepAirport(savedAirport(awb.origin, saved.dep, saved.depAirport));
      setDestAirport(savedAirport(awb.destination, saved.dest, saved.destAirport));
      setTo1(awb.to1 || saved.to1 || '');
      setBy1(awb.by1 || saved.by1 || '');
      setTo2(awb.to2 || saved.to2 || '');
      setBy2(awb.by2 || saved.by2 || '');
      setTo3(awb.to3 || saved.to3 || '');
      setBy3(awb.by3 || saved.by3 || '');
      setFlightNumber1(awb.flightNumber1 || saved.flight1 || '');
      setFlightDate1(datePart(awb.flightDate1));
      setFlightTime1(timePart(awb.flightDate1));
      setFlightNumber2(awb.flightNumber2 || '');
      setFlightDate2(datePart(awb.flightDate2));
      setFlightTime2(timePart(awb.flightDate2));
      setCurrencyCode(awb.currencyCode || 'USD');
      setChargeCode(awb.chargeCode || 'PP');
      setCarriageValue(awb.declaredValueCarriage || saved.carriageValue || 'NVD');
      setCustomsValue(awb.declaredValueCustoms || saved.customsValue || 'NCV');
      setInsuranceValue(awb.amountOfInsurance || saved.insurance || 'XXX');
      setAccountingInfo(awb.accountingInformation || saved.accountingInfo || defaultAccountingInfo(awb.chargeCode));
      setSignatureShipper(awb.signatureShipper || '');
      setSignatureCarrier(awb.signatureCarrier || '');
      setExecutedDate(awb.executedDate || '');
      setExecutedPlace(awb.executedPlace || '');
      if (awb.wtVal) setWtValPC(awb.wtVal);
      if (awb.other) setOtherPC(awb.other);

      showSuccessToast('Success', 'HAWB Loaded for Modification!');
    } catch {
      showSuccessToast('Error', 'MAWB Not Found!', true);
    }
  };

  // opened from another screen with { loadAwbNumber, autoPrint } in the route state
  useEffect(() => {
    const loadAwbNumber = location.state?.loadAwbNumber;
    if (!loadAwbNumber) return;
    const openFromRoute = async () => {
      await handleModifyAWB(loadAwbNumber);
      if (location.state.autoPrint) setTimeout(() => setShowPrintOptions(true), AUTO_PRINT_DELAY_MS);
      window.history.replaceState({}, document.title);
    };
    openFromRoute();
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the route brings an AWB

  const handleAutoFill = (data) => {
    const fillParty = (title, field) => {
      const name = data[`${field}Name`];
      if (!name) return;
      const party = {
        name,
        street: data[`${field}Address`],
        city: data[`${field}City`] || '',
        state: data[`${field}State`] || '',
        country: data[`${field}Country`] || '',
        zip: data[`${field}Zip`] || '',
        phone: data[`${field}Phone`] || '',
        email: data[`${field}Email`] || '',
      };
      setParties((previous) => ({ ...previous, [title]: party }));
    };
    fillParty('Shipper', 'shipper');
    fillParty('Consignee', 'consignee');
    fillParty('Buyer', 'buyer');

    if (data.origin) setDepAirport(data.origin);
    if (data.destination) setDestAirport(data.destination);

    if (data.totalPieces || data.grossWeight || data.dimensions) {
      const dimensions = Array.isArray(data.dimensions) ? data.dimensions : [];
      const volumetricWeight = dimensions.length ? +volWtFromDims(dimensions, densityGroup).toFixed(2) : 0;
      setRateLines((previous) => {
        const lines = previous.length ? [...previous] : [{ id: 1, isRounded: true }];
        const firstLine = lines[0];
        lines[0] = recalcRow({
          ...firstLine,
          noOfPcs: data.totalPieces || firstLine.noOfPcs,
          pieces: data.totalPieces || firstLine.pieces,
          grossWeight: data.grossWeight || firstLine.grossWeight,
          ...(volumetricWeight ? { volumetricWeight } : {}),
        }, 'grossWeight');
        return lines;
      });
    }

    setNatureOfGoods(goodsTextFromScan(data, densityGroup));
    const marks = data.marksAndNumbers ? ` - ${data.marksAndNumbers}` : '';
    setOsiText(`PLEASE INFORM CONSIGNEE IMMEDIATELY ON ARRIVAL OF CARGO${marks}`);
  };

  // CLEAR: every box back to a new page; freshScreen then mounts the screen again
  const handleClearForm = () => {
    setExtraDocs({});
    setTempAwbId(newDocPouchId());
    setCurrentAwbId(null);
    setDepAirport(''); setDestAirport(''); setDestinationCurrency(''); setCcChargesDest('');
    setBy1(''); setBy2(''); setBy3(''); setTo1(''); setTo2(''); setTo3('');
    setAgentDetails({}); setNatureOfGoods(''); setVolume(''); setDensityGroup('1:6'); setMcUnit('MC'); setNoDimensions(false);
    setAwbPrefix(''); setAwbSuffix(''); setHawbNumber('');
    setRateLines([{ id: 1, pieces: '', grossWeight: '', rateClass: '', commodityItemNo: '', chargeableWeight: '', rateCharge: '', total: '', natureOfGoods: '' }]);
    setOtherCharges([]); setOciRows([]); setDimRows([]);
    setSphCodes(Array(SPH_SLOTS).fill(''));
    setSsrText(''); setOsiText(''); setSci('');
    setFlightNumber1(''); setFlightDate1(''); setFlightTime1(''); setFlightTime2('');
    setFlightNumber2(''); setFlightDate2('');
    setCurrencyCode('INR'); setChargeCode('PP');
    setCarriageValue('NVD'); setCustomsValue('NCV'); setInsuranceValue('XXX');
    setAccountingInfo(''); setSignatureShipper(''); setSignatureCarrier('');
    setExecutedDate(getTodayDate()); setExecutedPlace(DEFAULT_EXECUTED_PLACE);
    setParties(emptyParties());
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // no storage: nothing to forget
    }
    freshScreen();
    showSuccessToast('Info', 'Form Cleared.', false);
  };

  return { handleMawbFetch, handleModifyAWB, handleAutoFill, handleClearForm };
}
