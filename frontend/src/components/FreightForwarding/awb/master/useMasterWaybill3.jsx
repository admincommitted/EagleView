// Form state and logic, part 3 of 4
// Split out of CreateMasterWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { applySavedRows, datePart, timePart, dimsCbm } from '../savedAwb';
import { airportCountryOf } from '../awbValidate'; // country from the airport master, not the first 2 letters of the code (DEL is not DE)
import { runEdiValidation } from '../awbValidate';
import { sentNotice } from '../createAwb';
import { recalcRow, withVolWt, volWtFromCbm, volWtFromDims, cbmOf, cbmFromDims, goodsWithDims, chargeableOf } from '../weightCalc';
import React from 'react';
import axios from 'axios';
import { downloadAWBPDF, printAWB, showSuccessToast, showValidationErrorsModal } from '../../printLogic';

export default function useMasterWaybill3(ctx) {
  const { densityGroup, awbNo, awbPrefix, awbSuffix, carriageValue, depAirport, destAirport, destinationCurrency, getCustomsIdForParty, getTodayDate, masterAirlines, natureOfGoods, ociRows, parties, rateLines, savedDraftData, setAccountingInfo, setAgentDetails, setAwbPrefix, setAwbSuffix, setBy1, setBy2, setBy3, setCarriageValue, setCcChargesDest, setChargeCode, setConfirmModal, setCurrencyCode, setCurrentAwbId, setCustomsValue, setDensityGroup, setDepAirport, setDestAirport, setDestinationCurrency, setDimRows, setDraftConfirmOpen, setExecutedDate, setExecutedPlace, setFlightDate1, setFlightDate2, setFlightNumber1, setFlightNumber2, setFlightTime1, setFlightTime2, setInsuranceValue, setLinkedHawbs, setMcUnit, setNatureOfGoods, setNoDimensions, setOciRows, setOsiText, setOtherCharges, setOtherPC, setParties, setRateLines, setSavedDraftData, setSci, setShowAddParty, setSignatureCarrier, setSignatureShipper, setSphCodes, setSsrText, setTaxCC, setTaxPP, setTo1, setTo2, setTo3, setUiModal, setValChargeCC, setValChargePP, setVolume, setWeightChargeCC, setWeightChargePP, setWtValPC, setXfwbSent, valChargeCC, valChargePP, wtValPC } = ctx;
  const handleSmartAutoFillOCI = () => {
    let newOciRows = [];
    const extractTaxId = (party) => {
          if (!party) return '';
            if (party.regNo) return party.regNo.toUpperCase();
            if (party.gstin) return party.gstin.toUpperCase();
            if (party.taxId) return party.taxId.toUpperCase();
            if (party.vat) return party.vat.toUpperCase();
            if (party.iec) return party.iec.toUpperCase();
            if (party.panNumber) return party.panNumber.toUpperCase();
            const str = `${party.name || ''} ${party.address1 || ''} ${party.address2 || ''} ${party.city || ''} ${party.state || ''} ${party.zipCode || ''} ${party.email || ''}`.toUpperCase();
          const gstMatch = str.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/);
          if (gstMatch) return gstMatch[0];
          const iecMatch = str.match(/\b\d{10}\b/);
          if (iecMatch) return iecMatch[0];
          const vatMatch = str.match(/\b[A-Z]{2}[0-9]{2}[0-9A-Z]{6,10}\b/);
          if (vatMatch) return vatMatch[0];
          return '';
      };

    const shpCountry = (parties['Shipper']?.country || airportCountryOf(depAirport, ctx.masterAirports) || 'IN').toUpperCase().substring(0,2);
    const shpTaxId = extractTaxId(parties['Shipper']);
    if (shpTaxId) newOciRows.push({ id: Date.now(), countryCode: shpCountry, infoId: 'SHP', customsId: getCustomsIdForParty(parties['Shipper'], shpCountry), suppInfo: shpTaxId }); // no empty SHP row (29-Oct-2026)

          let cneCountry = (parties['Consignee']?.country || airportCountryOf(destAirport, ctx.masterAirports) || '').toUpperCase().substring(0,2);
      if (cneCountry === 'LF' || cneCountry === 'EG') cneCountry = 'GB';
      if (cneCountry === 'ED') cneCountry = 'DE';
      
      const cneTaxId = extractTaxId(parties['Consignee']);
      if (cneTaxId) {
          const euCountries = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB','CH','NO'];
          const defaultCustomsId = euCountries.includes(cneCountry) ? 'E' : 'T';
          newOciRows.push({ id: Date.now() + 1, countryCode: cneCountry, infoId: 'CNE', customsId: defaultCustomsId, suppInfo: cneTaxId });
      }
    setOciRows(newOciRows);
  };

  React.useEffect(() => {
    const isUntouched = ociRows.length === 0 || (ociRows.length === 1 && !ociRows[0].suppInfo);
    if (isUntouched && (parties['Shipper']?.name || parties['Consignee']?.name || destAirport)) {
        handleSmartAutoFillOCI();
    }
  }, [parties, depAirport, destAirport]);

  
  // VALIDATE EDI: shared rules in awbValidate.jsx (29-Oct-2026; the old copy guessed countries from airport codes)
  const runIataValidation = () => runEdiValidation(ctx, 'MAWB');

  const foundAirline = masterAirlines.find(a => a.prefix === awbPrefix);
  const airlineName = foundAirline ? foundAirline.name : null;
  const airlineCode = foundAirline ? (foundAirline.code2 || '') : '';

  const [addPartyTitle, setAddPartyTitle] = React.useState('');


  // Totals calculations
  const totalPcs = rateLines.reduce((sum, row) => sum + (parseInt(row.noOfPcs) || 0), 0);
  const totalGrossWt = rateLines.reduce((sum, row) => sum + (parseFloat(row.grossWeight) || 0), 0).toFixed(2);
  const totalVolWt = rateLines.reduce((sum, row) => sum + (parseFloat(row.volumetricWeight) || 0), 0).toFixed(2);
  const totalChgWt = rateLines.reduce((sum, row) => sum + (parseFloat(row.chargeableWeight) || 0), 0).toFixed(2);
  const totalAmountSum = rateLines.reduce((sum, row) => sum + (parseFloat(row.totalAmount) || 0), 0).toFixed(2);
  
  // Reactive Auto-Calculation for Charges
  const lastLineTotalRef = React.useRef(0); // last rate-line total seen by the weight-charge effect
  React.useEffect(() => {
    const chgWt = parseFloat(totalChgWt) || parseFloat(totalGrossWt) || 0;
    
    // 1. Other Charges Logic
    if (chgWt > 0 && typeof setOtherCharges === 'function') {
      let mycRate = 10;
      let sccRate = 5;
      let awcFee = 500;

      if (awbPrefix === '098') { mycRate = 15; sccRate = 5; awcFee = 700; }
      else if (awbPrefix === '176') { mycRate = 20; sccRate = 8; awcFee = 650; }
      else if (awbPrefix === '125') { mycRate = 18; sccRate = 7; awcFee = 600; }

      const baseCharges = [
        { code: 'AW', entitlement: 'carrier', amount: awcFee.toFixed(2) },
        { code: 'MY', entitlement: 'carrier', amount: (mycRate * chgWt).toFixed(2) },
        { code: 'SC', entitlement: 'carrier', amount: (sccRate * chgWt).toFixed(2) }
      ];

      setOtherCharges(prev => {
        let currentCharges = [...(prev || [])];
        let changed = false;
        baseCharges.forEach(bc => {
            const existingIndex = currentCharges.findIndex(c => c.code === bc.code);
            if (existingIndex >= 0) {
                if (currentCharges[existingIndex].amount !== bc.amount) {
                    currentCharges[existingIndex].amount = bc.amount;
                    changed = true;
                }
            } else {
                const emptyIdx = currentCharges.findIndex(c => !c.code && !c.amount);
                  if (emptyIdx >= 0) {
                      currentCharges[emptyIdx] = { ...currentCharges[emptyIdx], ...bc, id: Date.now() + Math.random() };
                  } else {
                      currentCharges.push({ ...bc, id: Date.now() + Math.random() });
                  }
                changed = true;
            }
        });
        return changed ? currentCharges : prev;
      });
    }

    // 2. Weight Charge PP/CC Logic
    const totalAmountSumVal = rateLines.reduce((sum, row) => sum + (parseFloat(row.total) || parseFloat(row.totalAmount) || 0), 0).toFixed(2);
    const hadLineTotal = lastLineTotalRef.current > 0; lastLineTotalRef.current = parseFloat(totalAmountSumVal) || 0;
    if (!(parseFloat(totalAmountSumVal) > 0) && hadLineTotal) { // 11-Nov-2026: lines deleted / emptied - the old weight charge goes too
       if (typeof setWeightChargePP === 'function') setWeightChargePP('');
       if (typeof setWeightChargeCC === 'function') setWeightChargeCC('');
    }
    if (parseFloat(totalAmountSumVal) > 0) {
       if (wtValPC === 'P') {
           if (typeof setWeightChargePP === 'function') setWeightChargePP(prev => prev !== totalAmountSumVal ? totalAmountSumVal : prev);
           if (typeof setWeightChargeCC === 'function') setWeightChargeCC('');
       } else {
           if (typeof setWeightChargeCC === 'function') setWeightChargeCC(prev => prev !== totalAmountSumVal ? totalAmountSumVal : prev);
           if (typeof setWeightChargePP === 'function') setWeightChargePP('');
       }
    }
  }, [totalChgWt, totalGrossWt, awbPrefix, wtValPC, rateLines]);

  const fetchStock = async () => {
    if (awbPrefix.length !== 3) {
      setUiModal({ isOpen: true, title: 'VALIDATION ERROR', message: 'PLEASE ENTER A 3-DIGIT AIRLINE PREFIX FIRST.', type: 'error' });
      return;
    }
    try {
      const res = await fetch(`/api/stock/next/${awbPrefix}`);
      const data = await res.json();
      if (data.success) {
        setAwbSuffix(data.serial);
        // Optional success msg
      } else {
        setUiModal({ isOpen: true, title: 'STOCK EXHAUSTED', message: data.error || 'NO STOCK AVAILABLE FOR THIS PREFIX', type: 'error' });
      }
    } catch (err) {
      setUiModal({ isOpen: true, title: 'NETWORK ERROR', message: 'FAILED TO FETCH STOCK', type: 'error' });
    }
  };

    // ---------------- AUTOSAVE LOGIC ----------------
  const STORAGE_KEY = 'CreateMasterWaybill_DRAFT';
  const handleDiscardDraft = () => { localStorage.removeItem(STORAGE_KEY); setSavedDraftData(null); setDraftConfirmOpen(false); };
  const handleRestoreDraft = () => {
    const parsed = savedDraftData || {};
    if (parsed.awbPrefix) setAwbPrefix(parsed.awbPrefix);
    if (parsed.awbSuffix) setAwbSuffix(parsed.awbSuffix);
    if (parsed.natureOfGoods) setNatureOfGoods(parsed.natureOfGoods);
    setDraftConfirmOpen(false);
  };
  
  React.useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      setConfirmModal({
        isOpen: true,
        title: "RESTORE DRAFT?",
        message: "An unsaved draft was found from your previous session. Do you want to restore it?",
        onConfirm: () => {
          try {
            const parsed = JSON.parse(savedDraft);
            if(parsed.awbPrefix) setAwbPrefix(parsed.awbPrefix);
            if(parsed.awbSuffix) setAwbSuffix(parsed.awbSuffix);
            if(parsed.natureOfGoods) setNatureOfGoods(parsed.natureOfGoods);
          } catch(e) { console.error("Draft restore failed", e); }
          setConfirmModal({ isOpen: false });
        },
        onCancel: () => {
          localStorage.removeItem(STORAGE_KEY);
          setConfirmModal({ isOpen: false });
        }
      });
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const draftData = { awbPrefix, awbSuffix, natureOfGoods };
      if (awbPrefix || awbSuffix || natureOfGoods) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [awbPrefix, awbSuffix, natureOfGoods]);
  // ------------------------------------------------

  
  const handleClearForm = () => {
    if (ctx.setExtraDocs) ctx.setExtraDocs({}); // document windows of the previous AWB
    if (ctx.setTempAwbId) ctx.setTempAwbId(Math.random().toString(36).substring(7)); // fresh e-document pouch
    setCurrentAwbId(null); setXfwbSent(false);
    setDepAirport(''); setDestAirport(''); setDestinationCurrency(''); setCcChargesDest('');
    setBy1(''); setBy2(''); setBy3(''); setTo1(''); setTo2(''); setTo3('');
    setAgentDetails({}); setNatureOfGoods(''); setVolume(''); setDensityGroup('1:6'); setMcUnit('MC'); setNoDimensions(false); setLinkedHawbs([]);
    setAwbPrefix(''); setAwbSuffix('');
    setRateLines([{ id: 1, pieces: '', grossWeight: '', rateClass: '', commodityItemNo: '', chargeableWeight: '', rateCharge: '', total: '', natureOfGoods: '' }]);
    setOtherCharges([]); setOciRows([]); setDimRows([]);
    setSphCodes(['','','','','','','','','']);
    setSsrText(''); setOsiText(''); setSci('');
    // Reset controlled state fields
    setFlightNumber1(''); setFlightDate1(''); setFlightTime1(''); setFlightTime2(''); setFlightNumber2(''); setFlightDate2('');
    setCurrencyCode('INR'); setChargeCode('PP');
    setWtValPC('P'); setOtherPC('P');
    setCarriageValue('NVD'); setCustomsValue('NCV'); setInsuranceValue('XXX');
    setAccountingInfo(''); setSignatureShipper(''); setSignatureCarrier('');
    setExecutedDate(getTodayDate()); setExecutedPlace('NEW DELHI');
      setParties({ 'Shipper': {}, 'Consignee': {}, 'Buyer': {}, 'Sub Agent': {}, 'Overseas Agent': {}, 'Notify 1': {}, 'Notify 2': {} });
    
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* no storage */ } // no RESTORE DRAFT? prompt on the fresh screen
    if (typeof ctx.freshScreen === 'function') ctx.freshScreen(); // 11-Nov-2026: a fresh screen - every box as on a new page
    showSuccessToast('Info', 'Form Cleared.', false);
  };

  
  
  const handlePrintOptionsSubmit = ({ selectedCopies, includeTerms, actionType }) => {
    if (actionType === 'print') {
      printAWB(selectedCopies, includeTerms);
    } else if (actionType === 'pdf') {
      downloadAWBPDF(selectedCopies, includeTerms);
    }
  };
  const [showPrintOptions, setShowPrintOptions] = React.useState(false);
  const [showModifyModal, setShowModifyModal] = React.useState(false);
  const handleModifyAWB = async (searchAwb) => {
    setShowModifyModal(false);
    if (!searchAwb) return;
    try {
      const res = await axios.get(`/api/awb/search/${searchAwb}`);
      const awb = res.data;
      sentNotice(awb); // 11-Nov-2026: a sent AWB opens (view / print / amend) - before it was refused
      setCurrentAwbId(awb.id); if (ctx.setTempAwbId) ctx.setTempAwbId(Math.random().toString(36).substring(7));
      try { const _lr = await fetch('/api/awb/logs/' + awb.awbNumber + '?t=' + Date.now()); const _lj = await _lr.json(); if (_lj.success && Array.isArray(_lj.data)) setXfwbSent(_lj.data.some(l => l.action === 'FWB_TRANSMITTED')); } catch(_e) {}
      
      const parts = awb.awbNumber.split('-');
      if (parts.length === 2) { setAwbPrefix(parts[0]); setAwbSuffix(parts[1]); }
      
      // 29-Oct-2026: every saved value back on screen (declared values / accounting info were read under names that
      // do not exist and came back as NVD / blank; nature of goods, product, flight 3, agent docs were not loaded;
      // rows of an AWB opened earlier stayed when this one had none)
      const fd = awb.formData || {};
      applySavedRows(awb, { setRateLines, setOtherCharges, setOciRows, setSphCodes, setDimRows, setVolume, setParties });
      if (ctx.setExtraDocs) ctx.setExtraDocs(awb.extraDocs || {});
      if (fd.densityGroup) setDensityGroup(fd.densityGroup);
      if (fd.mcUnit) setMcUnit(fd.mcUnit);
      setNoDimensions(!!fd.noDimensions);

      setSsrText(awb.ssr || ''); setOsiText(awb.osi || ''); setSci(awb.sci || '');
      setAgentDetails(prev => ({ ...prev, name: awb.agentName || '', code: awb.agentCode || '', account: awb.agentAccountNo || '', place: awb.agentPlace || '',
        city: awb.agentCity || fd.agentCity || '', country: awb.agentCountry || fd.agentCountry || prev.country || '',
        docs: awb.agentDocs || fd.agentDocs || prev.docs || '', eori: awb.agentEori || fd.agentEori || '' }));

      setWeightChargePP(awb.weightChargePP ?? ''); setWeightChargeCC(awb.weightChargeCC ?? '');
      setValChargePP(awb.valChargePP ?? ''); setValChargeCC(awb.valChargeCC ?? '');
      setTaxPP(awb.taxPP ?? ''); setTaxCC(awb.taxCC ?? '');
      setDestinationCurrency(awb.destinationCurrency || fd.destinationCurrency || '');
      setCcChargesDest(awb.ccChargesDest ?? fd.ccChargesDest ?? '');
      setNatureOfGoods(awb.natureOfGoods || fd.natureOfGoods || '');
      if (ctx.setProductId) ctx.setProductId(fd.productId || 'GEN');
      if (ctx.setFlight3) ctx.setFlight3(awb.flightNumber3 || fd.flight3 || fd.flightNumber3 || '');
      if (ctx.setFlightDate3) ctx.setFlightDate3(awb.flightDate3 || fd.flightDate3 || '');
      if (ctx.setArrivalDate1) ctx.setArrivalDate1(fd.arrivalDate1 || '');
      if (ctx.setAgentLocationCode) ctx.setAgentLocationCode(fd.agentLocationCode || '');

      setDepAirport(awb.origin || fd.dep || fd.depAirport || '');
      setDestAirport(awb.destination || fd.dest || fd.destAirport || '');
      setTo1(awb.to1 || fd.to1 || ''); setBy1(awb.by1 || fd.by1 || '');
      setTo2(awb.to2 || fd.to2 || ''); setBy2(awb.by2 || fd.by2 || '');
      setTo3(awb.to3 || fd.to3 || ''); setBy3(awb.by3 || fd.by3 || '');
      setFlightNumber1(awb.flightNumber1 || fd.flight1 || fd.flightNumber1 || '');
      setFlightDate1(datePart(awb.flightDate1 || fd.flightDate1)); setFlightTime1(timePart(awb.flightDate1 || fd.flightDate1));
      setFlightNumber2(awb.flightNumber2 || fd.flightNumber2 || '');
      setFlightDate2(datePart(awb.flightDate2 || fd.flightDate2)); setFlightTime2(timePart(awb.flightDate2 || fd.flightDate2));
      setCurrencyCode(awb.currencyCode || 'USD');
      setChargeCode(awb.chargeCode || 'PP');
      if (awb.wtVal) setWtValPC(awb.wtVal);
      if (awb.other) setOtherPC(awb.other);
      setCarriageValue(awb.declaredValueCarriage || fd.carriageValue || 'NVD');
      setCustomsValue(awb.declaredValueCustoms || fd.customsValue || 'NCV');
      setInsuranceValue(awb.amountOfInsurance || fd.insurance || 'XXX');
      setAccountingInfo(awb.accountingInformation || fd.accountingInfo || (String(awb.chargeCode || '').startsWith('C') ? 'FREIGHT COLLECT' : 'FREIGHT PREPAID')); // what the save would write, now visible
      setSignatureShipper(awb.signatureShipper || '');
      setSignatureCarrier(awb.signatureCarrier || '');
      setExecutedDate(awb.executedDate || '');
      setExecutedPlace(awb.executedPlace || '');

      // Auto-load linked HAWBs for this MAWB
      try {
        const hawbRes = await fetch(`/api/awb/linked-hawbs/${encodeURIComponent(awb.awbNumber)}`);
        if (hawbRes.ok) {
          const hawbs = await hawbRes.json();
          if (Array.isArray(hawbs) && hawbs.length > 0) {
            setLinkedHawbs(hawbs.map(h => ({
              id: h.id,
              type: 'H',
              awb: h.awbNumber || '',
              depDate: h.flightDate1 || '',
              org: h.origin || '',
              dest: h.destination || '',
              awbDate: h.createdAt ? h.createdAt.split('T')[0] : '',
              shc: 'GEN',
              pcs: h.totalPieces || 0,
              wt: parseFloat(h.grossWeight) || 0,
              vol: parseFloat(h.totalVolume) || 0,
              shipperName: h.shipperName || '',
              consigneeName: h.consigneeName || '',
            })));
          }
        }
      } catch (hawbErr) {
        console.warn('Could not load linked HAWBs:', hawbErr.message);
      }

      showSuccessToast('Success', 'MAWB Loaded for Modification!');
    } catch (err) {
      showSuccessToast('Error', 'MAWB Not Found!', true);
    }
  };
  
  

  
  
  // Dimension window: volume (cbm) and volumetric weight from L x W x H x pieces with the screen's ratio (IATA 6000),
  // chargeable weight by weightCalc (rounded up to 0.5 kg); the goods text gets the dimension lines once (they were added
  // again on every save). 29-Oct-2026
  const handleDimensionSave = (dims) => {
    setDimRows(dims);
    const tVol = cbmFromDims(dims);
    setVolume(tVol > 0 ? tVol.toFixed(3) : '');
    if (typeof setMcUnit === 'function') setMcUnit('MC');
    const volKg = +volWtFromDims(dims, typeof densityGroup !== 'undefined' ? densityGroup : '1:6').toFixed(2);
    if (typeof setRateLines === 'function') setRateLines(prev => withVolWt(prev, volKg));
    if (typeof setNatureOfGoods === 'function') setNatureOfGoods(prev => goodsWithDims(prev, dims, volKg));
  };

  const handleRequestAddParty = (type, extractedData) => {
    setAddPartyTitle(`Add ${type} Details`);
    setShowAddParty({ isOpen: true, prefillData: extractedData });
  };
  return { STORAGE_KEY, addPartyTitle, airlineCode, airlineName, fetchStock, foundAirline, handleClearForm, handleDimensionSave, handleDiscardDraft, handleModifyAWB, handlePrintOptionsSubmit, handleRequestAddParty, handleRestoreDraft, handleSmartAutoFillOCI, runIataValidation, setAddPartyTitle, setShowModifyModal, setShowPrintOptions, showModifyModal, showPrintOptions, totalAmountSum, totalChgWt, totalGrossWt, totalPcs, totalVolWt };
}
