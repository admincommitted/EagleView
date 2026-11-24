// Form state and logic, part 3 of 3
// Split out of CreateAirWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { applySavedRows, datePart, timePart, dimsCbm } from '../savedAwb';
import { recalcRow, withVolWt, volWtFromCbm, volWtFromDims, cbmOf, cbmFromDims, goodsWithDims, chargeableOf } from '../weightCalc';
import React from 'react';
import toast from 'react-hot-toast';
import { routeError, rateLineErrors, chargeErrors } from '../awbChecks';
import axios from 'axios';
import { createAwb, updateAwb, voidAwb, sentNotice } from '../createAwb';
import { downloadAWBPDF, printAWB, showSuccessToast } from '../../printLogic';

export default function useAirWaybill3(ctx) {
  const { accountingInfo, agentCity, agentCountry, agentDetails, agentLocationCode, arrivalDate1, awbPrefix, awbSuffix, by1, by2, by3, carriageValue, ccChargesDest, chargeCode, consigneeEmail, currencyCode, currentAwbId, customsValue, densityGroup, depAirport, destAirport, destinationCurrency, dimRows, executedDate, executedPlace, flight3, flightDate1, flightDate2, flightDate3, flightNumber1, flightNumber2, flightTime1, flightTime2, getAwbError, handleClearForm, iataAgents, insuranceValue, isSaving, location, mcUnit, natureOfGoods, noDimensions, ociRows, osiText, otherCharges, otherPC, parties, productId, rateLines, sci, setAccountingInfo, setAddPartyTitle, setAgentCity, setAgentCountry, setAgentDetails, setAgentLocationCode, setArrivalDate1, setAwbPrefix, setAwbSuffix, setBy1, setBy2, setBy3, setCarriageValue, setCcChargesDest, setChargeCode, setConsigneeEmail, setCurrencyCode, setCurrentAwbId, setCustomsValue, setDensityGroup, setDepAirport, setDestAirport, setDestinationCurrency, setDimRows, setExecutedDate, setExecutedPlace, setFlight3, setFlightDate1, setFlightDate2, setFlightDate3, setFlightNumber1, setFlightNumber2, setInsuranceValue, setIsSaving, setLogsData, setMcUnit, setNatureOfGoods, setNoDimensions, setOciRows, setOsiText, setOtherCharges, setOtherPC, setParties, setProductId, setRateLines, setSci, setShipperEmail, setShowAddParty, setShowLogsModal, setSignatureCarrier, setSignatureShipper, setSphCodes, setSsrText, setTaxCC, setTaxPP, setTo1, setTo2, setTo3, setValChargeCC, setValChargePP, setVolume, setWeightChargeCC, setWeightChargePP, setWtValPC, shipperEmail, signatureCarrier, signatureShipper, sphCodes, ssrText, taxCC, taxPP, to1, to2, to3, totalCC, totalPP, valChargeCC, valChargePP, volume, weightChargeCC, weightChargePP, wtValPC } = ctx;
  const handlePrintOptionsSubmit = ({ selectedCopies, includeTerms, actionType }) => {
    if (actionType === 'print') {
      printAWB(selectedCopies, includeTerms);
    } else if (actionType === 'pdf') {
      downloadAWBPDF(selectedCopies, includeTerms);
    }
  };
  // 11-Nov-2026: the signature boxes start with what the AWB prints and the FWB sends (shipper name / AS AGENT FOR
  // CARRIER <agent>) - they were blank, VALIDATE warned, and the print ignored them anyway
  // A box still holding the text filled here follows the shipper / agent as it is typed; a text the user typed is kept.
  const sigAutoRef = React.useRef({ sh: '', ca: '' });
  React.useEffect(() => {
    const sh = String((ctx.parties && ctx.parties['Shipper'] && ctx.parties['Shipper'].name) || '').trim();
    const cur = String(ctx.signatureShipper || '').trim();
    if (sh && (!cur || cur === sigAutoRef.current.sh) && cur !== sh && typeof ctx.setSignatureShipper === 'function') { sigAutoRef.current.sh = sh; ctx.setSignatureShipper(sh); }
  }, [ctx.parties && ctx.parties['Shipper'] && ctx.parties['Shipper'].name, ctx.signatureShipper]);
  React.useEffect(() => {
    const ag = String((ctx.agentDetails && ctx.agentDetails.name) || '').trim();
    const want = ag ? 'AS AGENT FOR CARRIER ' + ag : '';
    const cur = String(ctx.signatureCarrier || '').trim();
    if (want && (!cur || cur === sigAutoRef.current.ca || /^AS AGENT FOR CARRIER$/i.test(cur)) && cur !== want && typeof ctx.setSignatureCarrier === 'function') { sigAutoRef.current.ca = want; ctx.setSignatureCarrier(want); } // the bare old default gets the agent's name
  }, [ctx.agentDetails && ctx.agentDetails.name, ctx.signatureCarrier]);
  const [showPrintOptions, setShowPrintOptions] = React.useState(false);
  const [showModifyModal, setShowModifyModal] = React.useState(false);
  
    const handleMawbFetch = async (prefix, suffix) => {
      if (!prefix || !suffix) return;
      try {
        const searchAwb = `${prefix}-${suffix}`;
        const res = await axios.get(`/api/awb/search/${searchAwb}`);
        const awb = res.data;
        if (!awb || awb.error) return;
        
        // Populate routing data from MAWB
        if (awb.origin) setDepAirport(awb.origin);
        if (awb.destination) setDestAirport(awb.destination);
        setFlightNumber1(awb.flightNumber1 || awb.flight1 || '');
        setFlightDate1(awb.flightDate1 || '');
        setFlightNumber2(awb.flightNumber2 || '');
        setFlightDate2(awb.flightDate2 || '');
        
        // Safely set DOM values for origin/destination if they are uncontrolled
        const setDomVal = (selector, val) => { /* Disabled DOM scraping */ };
        
        toast.success(`Routing / flights filled from MAWB ${searchAwb}`, { duration: 2500 }); // 11-Nov-2026: was a box that had to be closed before typing on
      } catch (err) {
        console.log("MAWB not found for auto-fill", err);
      }
    };
    const handleModifyAWB = async (searchAwb) => {
      setShowModifyModal(false);
      if (!searchAwb) return;
      try {
        const res = await axios.get(`/api/awb/search/${searchAwb}`);
        const awb = res.data;
        sentNotice(awb); // 11-Nov-2026: a sent AWB opens (view / print / amend) - before it was refused
        setCurrentAwbId(awb.id); if (ctx.setTempAwbId) ctx.setTempAwbId(Math.random().toString(36).substring(7));

        // ── AWB Number ──────────────────────────────────────────────
        const parts = awb.awbNumber.split('-');
        if (parts.length === 2) { setAwbPrefix(parts[0]); setAwbSuffix(parts[1]); }

        // ── Routing & Flight ────────────────────────────────────────
        setDepAirport(awb.origin || awb.depAirport || '');
        setDestAirport(awb.destination || awb.destAirport || '');
        setFlightNumber1(awb.flightNumber1 || '');
        const fd1Raw = awb.flightDate1 || '';
        setFlightDate1(datePart(fd1Raw));
        if (ctx.setFlightTime1) ctx.setFlightTime1(timePart(fd1Raw)); // the time was lost: next save wrote T00:00:00
        setFlightNumber2(awb.flightNumber2 || '');
        const fd2Raw = awb.flightDate2 || '';
        setFlightDate2(datePart(fd2Raw));
        if (ctx.setFlightTime2) ctx.setFlightTime2(timePart(fd2Raw));
        setTo1(awb.to1 || '');
        setBy1(awb.by1 || '');
        setTo2(awb.to2 || '');
        setBy2(awb.by2 || '');
        setTo3(awb.to3 || '');
        setBy3(awb.by3 || '');

        // ── Currency / Charges ──────────────────────────────────────
        setCurrencyCode(awb.currencyCode || 'USD');
        setChargeCode(awb.chargeCode || 'PP');
        if (awb.wtVal) setWtValPC(awb.wtVal);
        if (awb.other) setOtherPC(awb.other);

        // ── Declared Values ─────────────────────────────────────────
        // DB stores as declaredValueCarriage / declaredValueCustoms / amountOfInsurance
        setCarriageValue(awb.declaredValueCarriage || awb.carriageValue || 'NVD');
        setCustomsValue(awb.declaredValueCustoms   || awb.customsValue  || 'NCV');
        setInsuranceValue(awb.amountOfInsurance    || awb.insuranceValue || 'XXX');

        // ── Accounting & Signing ────────────────────────────────────
        // DB stores as accountingInformation; form state is accountingInfo
        setAccountingInfo(awb.accountingInformation || awb.accountingInfo || (String(awb.chargeCode || '').startsWith('C') ? 'FREIGHT COLLECT' : 'FREIGHT PREPAID')); // what the save would write, now visible
        setSignatureShipper(awb.signatureShipper || '');
        setSignatureCarrier(awb.signatureCarrier || '');
        setExecutedDate(awb.executedDate || '');
        setExecutedPlace(awb.executedPlace || '');

        // ── Totals Block ────────────────────────────────────────────
        setWeightChargePP(awb.weightChargePP?.toString() || '');
        setWeightChargeCC(awb.weightChargeCC?.toString() || '');
        setValChargePP(awb.valChargePP?.toString() || '');
        setValChargeCC(awb.valChargeCC?.toString() || '');
        setTaxPP(awb.taxPP?.toString() || '');
        setTaxCC(awb.taxCC?.toString() || '');
        setCcChargesDest(awb.ccChargesDest?.toString() || '');
        setDestinationCurrency(awb.destinationCurrency || '');

        // ── Nature of Goods ─────────────────────────────────────────
        if (awb.natureOfGoods) setNatureOfGoods(awb.natureOfGoods);

        // ── SSR / OSI / SCI ─────────────────────────────────────────
        setSsrText(awb.ssr || '');
        setOsiText(awb.osi || '');
        setSci(awb.sci || '');

        // ── Agent Details ───────────────────────────────────────────
        const fd0 = awb.formData || {};
        setAgentDetails({
          name:    awb.agentName      || '',
          code:    awb.agentCode      || '',
          account: awb.agentAccountNo || '',
          place:   awb.agentPlace     || '',
          docs:    awb.agentDocs      || fd0.agentDocs || '',
          eori:    awb.agentEori      || fd0.agentEori || '',
        });
        setAgentCity(awb.agentCity       || fd0.agentCity    || '');
        setAgentCountry(awb.agentCountry || fd0.agentCountry || '');
        setAgentLocationCode(fd0.agentLocationCode || '');

        // ── formData extras ─────────────────────────────────────────
        setFlight3(fd0.flight3 || fd0.flightNumber3 || '');
        setFlightDate3(fd0.flightDate3 || '');
        setArrivalDate1(fd0.arrivalDate1 || '');
        setShipperEmail(fd0.shipperEmail || '');
        setConsigneeEmail(fd0.consigneeEmail || '');
        setProductId(fd0.productId || 'GEN');
        if (fd0.densityGroup) setDensityGroup(fd0.densityGroup);
        if (fd0.mcUnit) setMcUnit(fd0.mcUnit);
        if (fd0.noDimensions) setNoDimensions(fd0.noDimensions);

        // ── child rows + parties (shared with MAWB / HAWB, 29-Oct-2026: full party copy, rows cleared when none) ──
        applySavedRows(awb, { setRateLines, setOtherCharges, setOciRows, setSphCodes, setDimRows, setVolume, setParties });
      if (ctx.setExtraDocs) ctx.setExtraDocs(awb.extraDocs || {});
        if (ctx.setHawbNumber) ctx.setHawbNumber(fd0.hawbNumber || '');

        showSuccessToast('Success', 'AWB Loaded for Modification!');
      } catch (err) {
        console.error('handleModifyAWB error:', err);
        showSuccessToast('Error', 'AWB Not Found or Failed to Load!', true);
        alert('AWB Not Found or Failed to Load!');
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

  const handleAutoFill = (data) => {
    const populate = (title, name, street, city, state, country, zip, phone, email) => {
        setParties(p => ({
            ...p,
            [title]: { name, street, city, state, country, zip, phone, email: email || '' }
        }));
    };

    if (data.shipperName) populate('Shipper', data.shipperName, data.shipperAddress, data.shipperCity || '', data.shipperState || '', data.shipperCountry || '', data.shipperZip || '', data.shipperPhone || '', data.shipperEmail || '');
    if (data.consigneeName) populate('Consignee', data.consigneeName, data.consigneeAddress, data.consigneeCity || '', data.consigneeState || '', data.consigneeCountry || '', data.consigneeZip || '', data.consigneePhone || '', data.consigneeEmail || '');
    if (data.buyerName) populate('Buyer', data.buyerName, data.buyerAddress, data.buyerCity || '', data.buyerState || '', data.buyerCountry || '', data.buyerZip || '', data.buyerPhone || '', data.buyerEmail || '');

if (data.origin) setDepAirport(data.origin); if (data.destination) setDestAirport(data.destination);

    if (data.totalPieces || data.grossWeight || data.dimensions) {
      if (typeof setRateLines === 'function') {
        // OCR / auto-fill: volumetric weight from the dimensions read (IATA ratio of the screen), chargeable weight by
        // weightCalc (rounded up to 0.5 kg). 29-Oct-2026
        setRateLines(prev => {
           const list = [...(prev || [])];
           if (!list.length) list.push({ id: 1, isRounded: true });
           const dims = Array.isArray(data.dimensions) ? data.dimensions : [];
           const volKg = dims.length ? +volWtFromDims(dims, densityGroup).toFixed(2) : 0;
           list[0] = recalcRow({ ...list[0], noOfPcs: data.totalPieces || list[0].noOfPcs, pieces: data.totalPieces || list[0].pieces,
             grossWeight: data.grossWeight || list[0].grossWeight, ...(volKg ? { volumetricWeight: volKg } : {}) }, 'grossWeight');
           return list;
        });
      }
    }
    

    if (typeof setNatureOfGoods === 'function') {
        let goodsText = 'SAID TO CONTAIN\n';
        if (data.commodityDescription) goodsText += `${data.commodityDescription.toUpperCase()}\n`;
        if (data.hsCode) goodsText += `HS CODE: ${data.hsCode}\n`;
        if (data.invoiceNumber) goodsText += `INV NO.: ${data.invoiceNumber}\n`;
        if (data.invoiceDate) goodsText += `INV DT.: ${data.invoiceDate}\n`;
        
        let volWt = 0;
        let dimStrings = [];
        if (data.dimensions && Array.isArray(data.dimensions) && data.dimensions.length > 0) {
            data.dimensions.forEach(d => {
                const pcs = parseInt(d.pieces) || 1;
                const l = parseFloat(d.length) || 0;
                const w = parseFloat(d.width) || 0;
                const h = parseFloat(d.height) || 0;
                if (l && w && h) {
                    let v = 0;
                    v = volWtFromDims([d], densityGroup); // IATA ratio of the screen (was /6000 or /366 fixed)
                    volWt += v;
                    dimStrings.push(`${pcs} PCS-${l}X${w}X${h} ${d.unit || 'CM'}`);
                }
            });
        }
        
        if (volWt > 0) goodsText += `VOL WT.: ${volWt.toFixed(2)} KG\n`;
        
        if (dimStrings.length > 0) {
            const dimLines = `DIMS: ${dimStrings.join(', ')}`;
            if ((goodsText.length + dimLines.length) < 380) {
                goodsText += dimLines;
            }
        }
        

        setNatureOfGoods(goodsText.trim());
    }
    
    if (typeof setOsiText === 'function') {
        const marks = data.marksAndNumbers ? ` - ${data.marksAndNumbers}` : '';
        setOsiText(`PLEASE INFORM CONSIGNEE IMMEDIATELY ON ARRIVAL OF CARGO${marks}`);
    }

  };
const handleVoidAWB = async () => {
    // 29-Oct-2026: the alert after "return ...;" ran on every VOID / VIEW LOGS click (it was outside the if)
    if (!currentAwbId) { showSuccessToast('Error', 'No AWB loaded to void. Please save or modify first.', true); return; }
    if (!window.confirm("Are you sure you want to VOID this AWB?")) return;
    try {
      await voidAwb(currentAwbId, { type: 'AWB', user: ctx.getLoggedInUser ? ctx.getLoggedInUser() : undefined }); // 11-Nov-2026: asks the reason for a sent AWB
      showSuccessToast('Success', 'AWB successfully VOIDED.');
      handleClearForm();
    } catch (err) {
      const m = err?.response?.data?.error || 'Failed to void AWB.';
      showSuccessToast('Error', m, true); alert(m);
    }
  };

  
    const handleViewLogs = async () => {
        if (!awbPrefix || !awbSuffix) { showSuccessToast('Error', 'No AWB selected', true); return; }
        try {
            const res = await fetch('/api/awb/logs/' + awbPrefix + '-' + awbSuffix + '?t=' + Date.now());
            const json = await res.json();
            if(json.success) {
                setLogsData(json.data);
                setShowLogsModal(true);
            } else {
                showSuccessToast('Error', json.message || 'Failed to fetch logs', true); alert(json.message || 'Failed to fetch logs');
            }
        } catch(e) {
            showSuccessToast('Error', 'Failed to fetch logs', true); alert('Failed to fetch logs');
        }
    };
    
    const handleSaveToSQL = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const extractParty = (title) => parties[title] || {};
        // Use React state directly — depAirport / destAirport are controlled
      const origin = depAirport || '';
      const destination = destAirport || '';
      const shipperName = extractParty('Shipper').name;

      const consigneeName = extractParty('Consignee').name;

      if (!awbPrefix || !awbSuffix || awbPrefix.length < 3 || awbSuffix.length < 8) {
        showSuccessToast('Error', 'Valid AWB Number is mandatory!', true); alert('Valid AWB Number is mandatory!');
        return;
      }
      const mod7Err = getAwbError();
      if (mod7Err) {
        showSuccessToast('Error', `AWB Check Digit Error: ${mod7Err}`, true); alert(`AWB Check Digit Error: ${mod7Err}`);
        return;
      }
      if (!origin || origin.length !== 3 || !destination || destination.length !== 3) {
        showSuccessToast('Error', 'Valid 3-letter Origin and Destination Airports are mandatory!', true); alert('Valid 3-letter Origin and Destination Airports are mandatory!');
        return;
      }
      if (!shipperName || !consigneeName) {
        showSuccessToast('Error', 'Shipper and Consignee names are mandatory!', true); alert('Shipper and Consignee names are mandatory!');
        return;
      }
      const validRateLines = rateLines.filter(r => r.grossWeight && parseFloat(r.grossWeight) > 0);
      if (validRateLines.length === 0) {
        showSuccessToast('Error', 'At least one Rate Line with Gross Weight is mandatory!', true); alert('At least one Rate Line with Gross Weight is mandatory!');
        return;
      }
      { const more = [routeError(origin, destination), ...rateLineErrors(rateLines), ...chargeErrors(otherCharges)].filter(Boolean);
        if (more.length) { showSuccessToast('Error', more.join('\n'), true); alert(more.join('\n')); return; } }
      
      const payload = {
        awbNumber: awbPrefix && awbSuffix ? awbPrefix + '-' + awbSuffix : 'DRAFT',
        type: 'AWB',
        formData: {
          agentName: agentDetails?.name || '',
          agentCode: agentDetails?.code || '',
          agentAccountNo: agentDetails?.account || agentDetails?.accountNo || '',
          agentPlace: agentDetails?.place || '',
          agentCity: agentCity || '',
          agentCountry: agentCountry || '',
          agentLocationCode: agentLocationCode || '',
          agentDocs: agentDetails?.docs || '',
          agentEori: agentDetails?.eori || '',
          weightChargePP: parseFloat(weightChargePP) || 0,
          weightChargeCC: parseFloat(weightChargeCC) || 0,
          valChargePP: parseFloat(valChargePP) || 0,
          valChargeCC: parseFloat(valChargeCC) || 0,
          taxPP: parseFloat(taxPP) || 0,
          taxCC: parseFloat(taxCC) || 0,
          totalPP: totalPP || 0,
          totalCC: totalCC || 0,
          ccChargesDest: parseFloat(ccChargesDest) || 0,
          totalPieces: rateLines ? rateLines.reduce((s, r) => s + (parseInt(r.pieces || r.noOfPcs || 0)), 0) || 1 : 1,
          grossWeight: rateLines ? parseFloat(rateLines.reduce((s, r) => s + (parseFloat(r.grossWeight) || 0), 0).toFixed(2)) || 0.1 : 0.1,
          totalVolume: rateLines ? parseFloat(rateLines.reduce((s, r) => s + (parseFloat(r.volume) || 0), 0).toFixed(3)) || 0 : 0,
          natureOfGoods: typeof natureOfGoods !== 'undefined' ? natureOfGoods : '',
            densityGroup: typeof densityGroup !== 'undefined' ? densityGroup : '1:6',
            volume: typeof volume !== 'undefined' ? volume : '',
            mcUnit: typeof mcUnit !== 'undefined' ? mcUnit : 'MC',
            noDimensions: typeof noDimensions !== 'undefined' ? noDimensions : false,
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
          flightDate1: flightDate1 ? (flightTime1 ? flightDate1 + 'T' + flightTime1 : flightDate1 + 'T00:00:00') : '',
          flightNumber2: flightNumber2 || '',
          flightDate2: flightDate2 ? (flightTime2 ? flightDate2 + 'T' + flightTime2 : flightDate2 + 'T00:00:00') : '',
          flight3: flight3 || '',
          flightNumber3: flight3 || '',
          flightDate3: flightDate3 || '',
          arrivalDate1: arrivalDate1 || '',
          destinationCurrency: destinationCurrency || '',
          currencyCode: currencyCode || 'INR',
          chargeCode: chargeCode || 'PP',
          wtVal: wtValPC || 'P',
          other: otherPC || 'P',
          carriageValue: carriageValue || 'NVD',
          customsValue: customsValue || 'NCV',
          insurance: insuranceValue || 'XXX',
          // the text typed in Accounting Information first (the agent's default "FREIGHT PREPAID" hid it before)
          accountingInfo: accountingInfo || (String(chargeCode || '').startsWith('C') ? 'FREIGHT COLLECT' : 'FREIGHT PREPAID'),
          hawbNumber: ctx.hawbNumber || '',
          signatureShipper: signatureShipper || '',
          signatureCarrier: signatureCarrier || '',
          executedDate: executedDate || '',
          executedPlace: executedPlace || '',
          productId: productId || 'GEN',
          shipperEmail: parties['Shipper']?.email || shipperEmail || '',
          consigneeEmail: parties['Consignee']?.email || consigneeEmail || '',
          shipper: extractParty('Shipper'),
          consignee: extractParty('Consignee'),
          buyer: extractParty('Buyer'),
          subAgent: extractParty('Sub Agent'),
          overseasAgent: extractParty('Overseas Agent'),
          notify1: extractParty('Notify 1'),
          notify2: extractParty('Notify 2')
        },

        rateLines: typeof rateLines !== 'undefined' ? rateLines : [],
        otherCharges: (typeof otherCharges !== 'undefined' && Array.isArray(otherCharges)) ? otherCharges.map(c => ({...c, ppcc: c.ppcc || (otherPC === 'C' ? 'CC' : 'PP')})) : [],
        sphCodes: typeof sphCodes !== 'undefined' ? sphCodes : [],
        ociRows: typeof ociRows !== 'undefined' ? ociRows : [],
        dimRows: typeof dimRows !== 'undefined' ? dimRows : [],
        ssr: typeof ssrText !== 'undefined' ? ssrText : (typeof ssr !== 'undefined' ? ssr : ''),
        osi: typeof osiText !== 'undefined' ? osiText : (typeof osi !== 'undefined' ? osi : ''),
        sci: typeof sci !== 'undefined' ? sci : '',
        handlingInformation: typeof osiText !== 'undefined' ? osiText : '',
        docTempId: ctx.tempAwbId || '', // e-documents uploaded before the first save are linked to this AWB
        extraDocs: ctx.extraDocs || {}
      };
      
      
      let response;
      if (currentAwbId) {
        response = await updateAwb(currentAwbId, payload); // 11-Nov-2026: asks on a carrier / prefix mismatch
        showSuccessToast('Success', 'AWB Updated in SQL Database Successfully!');
      } else {
        response = await createAwb(payload); // 10-Nov-2026: asks when the number is not in the AWB stock
        setCurrentAwbId(response.data.awbId);
        showSuccessToast('Success', 'AWB Created in SQL Database Successfully!');
      }
      return currentAwbId || response.data.awbId; // the saved record's id (SEND XFWB saves first, then sends this one)
    } catch (err) {
      console.error(err);
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save to database!';
      showSuccessToast('Error', errMsg, true); alert(errMsg); } finally { setIsSaving(false); }
  };


  React.useEffect(() => {
    if (location.state && location.state.loadAwbNumber) {
      handleModifyAWB(location.state.loadAwbNumber).then(() => {
        if (location.state.autoPrint) {
          setTimeout(() => setShowPrintOptions(true), 500); // Give it a moment to fully render
        }
        window.history.replaceState({}, document.title);
      });
    }
  }, [location.state]);
    let agentPlaceForPrint = agentDetails?.place || '';
  if (iataAgents && iataAgents.length > 0) {
      const ag = iataAgents.find(a => a.name === agentDetails?.name);
      if (ag) {
          try {
              const br = JSON.parse(ag.branches);
              if (br && br.length > 0) {
                  agentPlaceForPrint = [br[0].address1, br[0].address2, br[0].city, br[0].state, br[0].country, br[0].pinCode].filter(Boolean).join(', ');
              }
          } catch(e) {}
      }
  }
  const printAgentDetails = { ...agentDetails, place: agentPlaceForPrint };
  return { agentPlaceForPrint, handleAutoFill, handleDimensionSave, handleMawbFetch, handleModifyAWB, handlePrintOptionsSubmit, handleRequestAddParty, handleSaveToSQL, handleViewLogs, handleVoidAWB, printAgentDetails, setShowModifyModal, setShowPrintOptions, showModifyModal, showPrintOptions };
}
