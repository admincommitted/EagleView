// Form state and logic, part 2 of 3
// Split out of CreateAirWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { recalcRow, withVolWt, volWtFromCbm, volWtFromDims, cbmOf, cbmFromDims, goodsWithDims } from '../weightCalc';
import { airportCountryOf } from '../awbValidate'; // country from the airport master, not the first 2 letters of the code (DEL is not DE)
import { runEdiValidation } from '../awbValidate';
import React from 'react';
import { showSuccessToast, showValidationErrorsModal } from '../../printLogic';

export default function useAirWaybill2(ctx) {
  const { awbNo, awbPrefix, awbSuffix, carriageValue, depAirport, destAirport, destinationCurrency, getTodayDate, hawbNumber, masterAirlines, natureOfGoods, osiText, parties, rateLines, savedDraftData, setAccountingInfo, setAgentDetails, setAwbPrefix, setAwbSuffix, setBy1, setBy2, setBy3, setCarriageValue, setCcChargesDest, setChargeCode, setConfirmModal, setCurrencyCode, setCurrentAwbId, setCustomsValue, setDepAirport, setDestAirport, setDestinationCurrency, setDraftConfirmOpen, setExecutedDate, setExecutedPlace, setFlightDate1, setFlightDate2, setFlightNumber1, setFlightNumber2, setHawbNumber, setInsuranceValue, setNatureOfGoods, setOsiText, setOtherCharges, setParties, setRateLines, setSavedDraftData, setSci, setSignatureCarrier, setSignatureShipper, setSphCodes, setSsrText, setTo1, setTo2, setTo3, setUiModal, setWeightChargeCC, setWeightChargePP, sphCodes, ssrText, valChargeCC, valChargePP, wtValPC } = ctx;
  React.useEffect(() => {
    const rules = [
      { code: 'ACT', ssr: 'ACT - ACTIVE TEMPERATURE CONTROLLED SYSTEM', osi: 'MAINTAIN ACTIVE TEMPERATURE CONTROL' },
      { code: 'AOG', ssr: 'AOG - AIRCRAFT ON GROUND URGENT', osi: 'URGENT AIRCRAFT SPARES' },
      { code: 'ATT', ssr: 'ATT - GOODS ATTACHED TO AIR WAYBILL', osi: '' },
      { code: 'AVI', ssr: 'AVI - LIVE ANIMAL /SPECIES/ /QUANTITY/', osi: 'SHIPPERS CERTIFICATION FOR LIVE ANIMALS ATTACHED' },
      { code: 'BIG', ssr: 'BIG - OUTSIZED CARGO', osi: 'OUTSIZED CARGO - SPECIAL HANDLING REQUIRED' },
      { code: 'BUP', ssr: 'BUP - BULK UNITIZATION PROGRAMME', osi: 'SHIPPER LOADED UNIT' },
      { code: 'CAO', ssr: 'CAO - CARGO AIRCRAFT ONLY', osi: '' },
      { code: 'CAT', ssr: 'CAT - CARGO ATTENDANT ACCOMPANYING', osi: '' },
      { code: 'COL', ssr: 'COL - COOL GOODS', osi: 'MAINTAIN COOL TEMPERATURE' },
      { code: 'COM', ssr: 'COM - COMPANY MAIL', osi: '' },
      { code: 'CRT', ssr: 'CRT - CONTROL ROOM TEMPERATURE', osi: 'MAINTAIN +15C TO +25C' },
      { code: 'DGD', ssr: 'DGD - DANGEROUS GOODS AS PER ATTACHED DGD', osi: '' },
      { code: 'DIP', ssr: 'DIP - DIPLOMATIC MAIL', osi: 'DIPLOMATIC CARGO - DO NOT OPEN' },
      { code: 'EAP', ssr: 'EAP - E-FREIGHT WITH PAPER DOCUMENTS', osi: '' },
      { code: 'EAT', ssr: 'EAT - FOODSTUFFS', osi: 'FOODSTUFFS - DO NOT STOW WITH POISONS' },
      { code: 'EAW', ssr: 'EAW - E-FREIGHT NO PAPER DOCUMENTS', osi: '' },
      { code: 'ELI', ssr: 'LITHIUM ION BATTERIES AS PER SECTION II OF PI', osi: '' },
      { code: 'ELM', ssr: 'LITHIUM METAL BATTERIES AS PER SECTION II OF PI', osi: '' },
      { code: 'FIL', ssr: 'FIL - UNDEVELOPED FILM / DO NOT X-RAY', osi: '' },
      { code: 'FRI', ssr: 'FRI - FROZEN GOODS', osi: 'MAINTAIN FREEZING TEMPERATURE' },
      { code: 'HEG', ssr: 'HEG - HATCHING EGGS', osi: 'HANDLE WITH EXTREME CARE' },
      { code: 'HUM', ssr: 'HUM - HUMAN REMAINS', osi: 'DEATH CERTIFICATE AND EMBALMING CERTIFICATE ATTACHED' },
      { code: 'ICE', ssr: 'ICE - DRY ICE / UN1845 / CLASS 9', osi: '' },
      { code: 'LHO', ssr: 'LHO - LIVING HUMAN ORGANS', osi: 'URGENT MEDICAL TRANSPORT' },
      { code: 'MAG', ssr: 'MAG - MAGNETIZED MATERIAL', osi: '' },
      { code: 'MUW', ssr: 'MUW - MUNITIONS OF WAR', osi: 'MILITARY CARGO' },
      { code: 'OBX', ssr: 'OBX - OBNOXIOUS CARGO', osi: 'STOW AWAY FROM FOODSTUFFS' },
      { code: 'PAC', ssr: 'PAC - PASSENGER AND CARGO', osi: '' },
      { code: 'PEA', ssr: 'PEA - HUNTING TROPHIES', osi: '' },
      { code: 'PER', ssr: 'PER - PERISHABLE CARGO', osi: 'NOTIFY CONSIGNEE IMMEDIATELY UPON ARRIVAL' },
      { code: 'PIL', ssr: 'PIL - PHARMACEUTICALS', osi: 'MAINTAIN STRICT TEMPERATURE CONTROLS' },
      { code: 'QTA', ssr: 'QTA - QUICK TRANSIT', osi: 'QUICK TRANSIT REQUIRED' },
      { code: 'RAC', ssr: 'RAC - RESERVED AIR CARGO', osi: '' },
      { code: 'RDS', ssr: 'RDS - RADIOACTIVE MATERIAL', osi: '' },
      { code: 'SAL', ssr: 'SAL - SURFACE MAIL', osi: '' },
      { code: 'SHL', ssr: 'SHL - SAVE HUMAN LIFE', osi: 'ABSOLUTE PRIORITY HANDLING REQUIRED' },
      { code: 'SOC', ssr: 'SOC - SHIPPER OWNED CONTAINER', osi: '' },
      { code: 'SPX', ssr: 'SPX - SECURE FOR PASSENGER AND CARGO AIRCRAFT', osi: '' },
      { code: 'VAL', ssr: 'VAL - VALUABLE CARGO', osi: 'VALUABLE CARGO UNDER ESCORT' },
      { code: 'VOL', ssr: 'VOL - VOLUME CARGO', osi: '' },
      { code: 'VUN', ssr: 'VUN - VULNERABLE CARGO', osi: 'VULNERABLE CARGO - SPECIAL SECURITY REQUIRED' },
      { code: 'WET', ssr: 'WET - WET CARGO', osi: 'STOW IN WATERTIGHT CONTAINERS' },
    ];

    let newSsr = ssrText || '';
    let newOsi = osiText || '';

    rules.forEach(r => {
      if (!sphCodes.includes(r.code)) {
         if (r.ssr) newSsr = newSsr.split('\n').filter(line => line !== r.ssr).join('\n');
         if (r.osi) newOsi = newOsi.split('\n').filter(line => line !== r.osi).join('\n');
      }
    });

    rules.forEach(r => {
      if (sphCodes.includes(r.code)) {
         if (r.ssr && !newSsr.includes(r.ssr)) newSsr = (newSsr ? newSsr + '\n' : '') + r.ssr;
         if (r.osi && !newOsi.includes(r.osi)) newOsi = (newOsi ? newOsi + '\n' : '') + r.osi;
      }
    });

    newSsr = newSsr.replace(/^\n+|\n+$/g, '');
    newOsi = newOsi.replace(/^\n+|\n+$/g, '');

    if (newSsr !== ssrText) setSsrText(newSsr);
    if (newOsi !== osiText) setOsiText(newOsi);
  }, [sphCodes]);

  // Smart Commodity Effect
  React.useEffect(() => {
    if (natureOfGoods.includes('PHARMA') || natureOfGoods.includes('MEDICINE')) {
      if (!sphCodes.includes('PIL')) {
         const emptyIndex = sphCodes.findIndex(c => c === '');
         if (emptyIndex !== -1) {
            const newCodes = [...sphCodes];
            newCodes[emptyIndex] = 'PIL';
            setSphCodes(newCodes);
         }
      }
    }
  }, [natureOfGoods]);

  // AWB Validation logic for red border
  const getAwbError = () => {
     if (!awbSuffix || awbSuffix.length < 8) return null;
     const serial = parseInt(awbSuffix.substring(0, 7), 10);
     const check = parseInt(awbSuffix.substring(7, 8), 10);
     if (serial % 7 !== check) return 'Invalid check digit (expected ' + (serial % 7) + ', got ' + check + '). MOD-7 validation failed.';
     return null;
  };


  const [ociRows, setOciRows] = React.useState([{ id: 1, countryCode: '', infoId: '', customsId: '', suppInfo: '' }]);
  const [dimRows, setDimRows] = React.useState([]);
  const [densityGroup, setDensityGroup] = React.useState('1:6');
  const [volume, setVolume] = React.useState('');
  const [mcUnit, setMcUnit] = React.useState('MC');
  const [noDimensions, setNoDimensions] = React.useState(false);

  // Volumetric weight from the Volume box: volume (MC / CC / CF) in cbm x 1,000,000 / divisor of the ratio (1:6 = 6000
  // cm3 per kg, IATA standard). Was volume x 167 whatever the unit, and the ratio was changed by the screen itself from
  // the cargo's own density (light cargo got 1:8 = 125 kg per cbm). 29-Oct-2026
  React.useEffect(() => {
    const cbm = cbmOf(volume, mcUnit);
    if (!(cbm > 0) || !(rateLines || []).length) return;
    // 11-Nov-2026: rate lines with their own dimensions / volume (Rate Line window) are the source - their volumetric
    // weight is not overwritten from the Volume box. Before, ADD in the window put the sum of the lines' volume in the
    // box and this effect then wrote the box's weight back on line 1: the window's 5470.52 kg became 5470.50 (3-decimal
    // CBM), a manual chargeable weight was replaced, and a wrong value in the box was multiplied onto line 1.
    if ((rateLines || []).some(r => r && ((parseFloat(r.volume) || 0) > 0 || (Array.isArray(r.dimensions) && r.dimensions.some(d => parseFloat(d.length) > 0))))) return;
    // with dimension lines they are the source (the 3-decimal volume would give a slightly different weight)
    const volWt = +((dimRows || []).length && !noDimensions ? volWtFromDims(dimRows, densityGroup) : volWtFromCbm(cbm, densityGroup)).toFixed(2);
    const cur = parseFloat(rateLines[0].volumetricWeight) || 0;
    if (Math.abs(cur - volWt) > 0.01) setRateLines(prev => withVolWt(prev, volWt));
  }, [volume, densityGroup, mcUnit, dimRows, noDimensions]); // eslint-disable-line

  // (the density group is no longer picked from the cargo's density: it set the divisor and so the volumetric weight. 29-Oct-2026)
  // ────────────────────────────────────────────────────────────────────────

  // ── Auto-fill outer VOLUME (CBM) from rate lines ─────────────────────────
  React.useEffect(() => {
    // 1. Try to sum CBM volumes from rate lines (set when user enters L×W×H in modal)
    const totalCbm = rateLines.reduce((sum, r) => sum + (parseFloat(r.volume) || 0), 0);
    if (totalCbm > 0) {
      setVolume(prev => {
        const rounded = totalCbm.toFixed(3);
        return prev !== rounded ? rounded : prev;
      });
      setMcUnit('MC'); // the rate lines' volume is in cbm (a CF / CC unit left on the box changed the volumetric weight)
      return;
    }
    }, [rateLines, densityGroup]);
  // ────────────────────────────────────────────────────────────────────────


    const handleOciChange = (id, field, val) => { setOciRows(ociRows.map(r => r.id === id ? { ...r, [field]: val } : r)); };
  const handleAutoFilleCSD = () => {
    const shpCountry = (parties['Shipper']?.country || airportCountryOf(depAirport, ctx.masterAirports) || 'IN').toUpperCase().substring(0,2);
    const newRows = [
      { id: Date.now() + 101, countryCode: shpCountry, infoId: 'SEC', customsId: 'V', suppInfo: 'SPX' },
      { id: Date.now() + 102, countryCode: shpCountry, infoId: 'SEC', customsId: 'SM', suppInfo: 'XRY' },
      { id: Date.now() + 103, countryCode: shpCountry, infoId: 'SEC', customsId: 'RA', suppInfo: '' }
    ];
    let currentRows = [...ociRows];
    newRows.forEach(nr => {
       if (!currentRows.some(cr => cr.infoId === nr.infoId && cr.customsId === nr.customsId)) {
           currentRows.push(nr);
       }
    });
    setOciRows(currentRows);
  };

  
  const getCustomsIdForParty = (party, ccode = '') => {
      if (!party) return 'T';
      const ctxType = party.ctxType || (party.addresses && party.addresses[0] && party.addresses[0].ctxType) || '';
      if (ctxType.toLowerCase() === 'passport') return 'P';
      const euCountries = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB','CH','NO'];
      if (ccode && euCountries.includes(ccode)) return 'E';
      return 'T';
  };
  
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
  const runIataValidation = () => runEdiValidation(ctx, 'AWB');

  // Fully automate OCI sync based on Shipper/Consignee selection
  React.useEffect(() => {
      setOciRows(prev => {
          const originalStr = JSON.stringify(prev || []);
          let newOcis = JSON.parse(originalStr);
          
          const shp = parties["Shipper"];
            if (shp) {
                const shpCcode = (shp.countryCode || shp.country || (shp.addresses && shp.addresses[0]?.country) || airportCountryOf(depAirport, ctx.masterAirports) || 'IN').substring(0,2).toUpperCase();
                const shpTax = shp.regNo || shp.gstin || shp.taxId || (shp.addresses && shp.addresses[0] && (shp.addresses[0].regNo || shp.addresses[0].gstin)) || shp.panNumber || shp.iec || '';
                if (shpTax) {
                    const existingShp = newOcis.find(r => r.infoId === 'SHP');
                    if (existingShp) {
                        existingShp.countryCode = shpCcode;
                        existingShp.suppInfo = shpTax;
                        existingShp.customsId = getCustomsIdForParty(shp, shpCcode);
                    } else {
                        newOcis.push({ id: Date.now(), countryCode: shpCcode, infoId: 'SHP', customsId: getCustomsIdForParty(shp, shpCcode), suppInfo: shpTax });
                    }
                }
            }
            
            const cne = parties["Consignee"];
            if (cne) {
                const cneCcode = (cne.countryCode || cne.country || (cne.addresses && cne.addresses[0]?.country) || airportCountryOf(destAirport, ctx.masterAirports) || '').substring(0,2).toUpperCase();
                const cneTax = cne.regNo || cne.gstin || cne.taxId || (cne.addresses && cne.addresses[0] && (cne.addresses[0].regNo || cne.addresses[0].gstin)) || cne.panNumber || cne.iec || '';
                if (cneTax && cneCcode) {
                    const existingCne = newOcis.find(r => r.infoId === 'CNE');
                    const defaultCustomsId = getCustomsIdForParty(cne, cneCcode);
                    if (existingCne) {
                        existingCne.countryCode = cneCcode;
                        existingCne.suppInfo = cneTax;
                        existingCne.customsId = defaultCustomsId;
                    } else {
                        newOcis.push({ id: Date.now() + 1, countryCode: cneCcode, infoId: 'CNE', customsId: defaultCustomsId, suppInfo: cneTax });
                    }
                }
            }
            
          if (!shp) newOcis = newOcis.filter(r => r.infoId !== 'SHP');
          if (!cne) newOcis = newOcis.filter(r => r.infoId !== 'CNE');
          
          const isDifferent = originalStr !== JSON.stringify(newOcis);
          return isDifferent ? newOcis : prev;
      });
  }, [parties['Shipper'], parties['Consignee']]);

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
    
    // 1. Other Charges Logic — only auto-fill if chgWt is reasonable (≤10000 kg)
    if (chgWt > 0 && chgWt <= 10000 && typeof setOtherCharges === 'function') {
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
                // Only overwrite if current amount is blank or zero (don't overwrite manual entries)
                const existingAmt = parseFloat(currentCharges[existingIndex].amount) || 0;
                if (existingAmt === 0) {
                    currentCharges[existingIndex].amount = bc.amount;
                    changed = true;
                }
            } else {
                  const emptyIdx = currentCharges.findIndex(c => !c.code && !c.amount);
                  if (emptyIdx >= 0) {
                      currentCharges[emptyIdx] = { ...currentCharges[emptyIdx], ...bc, id: currentCharges[emptyIdx].id };
                  } else {
                      currentCharges.push({ id: Date.now() + Math.random(), ...bc });
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
  const STORAGE_KEY = 'CreateAirWaybill_DRAFT';
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
      const draftData = { awbPrefix, awbSuffix, hawbNumber, natureOfGoods };
      if (awbPrefix || awbSuffix || natureOfGoods) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [awbPrefix, awbSuffix, hawbNumber, natureOfGoods]);
  // ------------------------------------------------

  
  const handleClearForm = () => {
    if (ctx.setExtraDocs) ctx.setExtraDocs({}); // document windows of the previous AWB
    if (ctx.setTempAwbId) ctx.setTempAwbId(Math.random().toString(36).substring(7)); // fresh e-document pouch
    setCurrentAwbId(null);
    setDepAirport(''); setDestAirport('');
    setDestinationCurrency(''); setCcChargesDest('');
    setBy1(''); setBy2(''); setBy3(''); setTo1(''); setTo2(''); setTo3('');
    setAgentDetails({});
    setNatureOfGoods(''); setVolume(''); setDensityGroup('1:6'); setMcUnit('MC'); setNoDimensions(false);
    setAwbPrefix(''); setAwbSuffix(''); setHawbNumber('');
    setRateLines([{ id: 1, pieces: '', grossWeight: '', rateClass: '', commodityItemNo: '', chargeableWeight: '', rateCharge: '', total: '', natureOfGoods: '' }]);
    setOtherCharges([]); setOciRows([]); setDimRows([]);
    setSphCodes(['','','','','','','','','']);
    setSsrText(''); setOsiText(''); setSci('');
    setFlightNumber1(''); setFlightDate1('');
    setFlightNumber2(''); setFlightDate2('');
    setCurrencyCode('INR'); setChargeCode('PP');
    setCarriageValue('NVD'); setCustomsValue('NCV'); setInsuranceValue('XXX');
    setAccountingInfo(''); setSignatureShipper(''); setSignatureCarrier('');
    setExecutedDate(getTodayDate()); setExecutedPlace('NEW DELHI');
      setParties({ 'Shipper': {}, 'Consignee': {}, 'Buyer': {}, 'Sub Agent': {}, 'Overseas Agent': {}, 'Notify 1': {}, 'Notify 2': {} });
    
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* no storage */ } // no RESTORE DRAFT? prompt on the fresh screen
    if (typeof ctx.freshScreen === 'function') ctx.freshScreen(); // 11-Nov-2026: a fresh screen - every box as on a new page
    showSuccessToast('Info', 'Form Cleared.', false);
  };
  return { STORAGE_KEY, addPartyTitle, airlineCode, airlineName, densityGroup, dimRows, fetchStock, foundAirline, getAwbError, getCustomsIdForParty, handleAutoFilleCSD, handleClearForm, handleDiscardDraft, handleOciChange, handleRestoreDraft, handleSmartAutoFillOCI, mcUnit, noDimensions, ociRows, runIataValidation, setAddPartyTitle, setDensityGroup, setDimRows, setMcUnit, setNoDimensions, setOciRows, setVolume, totalAmountSum, totalChgWt, totalGrossWt, totalPcs, totalVolWt, volume };
}
