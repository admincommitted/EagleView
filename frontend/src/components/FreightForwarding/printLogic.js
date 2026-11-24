import AWBTermsPage from './AWBTermsPage';

export const showSuccessToast = (title, message, isError = false) => {
    const event = new CustomEvent('show-toast', { detail: { title, message, isError } });
    window.dispatchEvent(event);
};

export const showValidationErrorsModal = (errors) => {
    const event = new CustomEvent('show-validation-errors', { detail: { errors } });
    window.dispatchEvent(event);
};

import domtoimage from 'dom-to-image';
import { jsPDF } from 'jspdf';
import html2pdf from 'html2pdf.js';


export const getPrintHTML = (copyText = "", includeTerms = true) => {
    // Extractor functions
    

    
    
    // Try to load state from hidden JSON div for 100% robust extraction
    let printData = {};
    const printDataEl = document.getElementById('awb-print-data');
    if (printDataEl && printDataEl.getAttribute('data-json')) {
        try {
            printData = JSON.parse(printDataEl.getAttribute('data-json'));
        } catch (e) {
            console.error("Failed to parse print data JSON", e);
        }
    }

    

    

    const isAsAgreed = printData.rateLines && printData.rateLines.length > 0 && printData.rateLines.some(r => r.rateAsAgreed);

    const wChg = { pp: (isAsAgreed && printData.weightChargePP) ? 'AS AGREED' : (printData.weightChargePP || ''), cc: (isAsAgreed && printData.weightChargeCC) ? 'AS AGREED' : (printData.weightChargeCC || '') };
    const _vPP = (parseFloat(printData.valChargePP) || 0) > 0 ? printData.valChargePP : '';
    const _vCC = (parseFloat(printData.valChargeCC) || 0) > 0 ? printData.valChargeCC : '';
    const vChg = { pp: (isAsAgreed && _vPP) ? 'AS AGREED' : _vPP, cc: (isAsAgreed && _vCC) ? 'AS AGREED' : _vCC };
    const _tPP = (parseFloat(printData.taxPP) || 0) > 0 ? printData.taxPP : '';
    const _tCC = (parseFloat(printData.taxCC) || 0) > 0 ? printData.taxCC : '';
    const tChg = { pp: (isAsAgreed && _tPP) ? 'AS AGREED' : _tPP, cc: (isAsAgreed && _tCC) ? 'AS AGREED' : _tCC };
    
    const tAgentPP = (isAsAgreed && printData.dueAgentPP > 0) ? 'AS AGREED' : (printData.dueAgentPP > 0 ? Number(printData.dueAgentPP).toFixed(2) : '');
    const tAgentCC = (isAsAgreed && printData.dueAgentCC > 0) ? 'AS AGREED' : (printData.dueAgentCC > 0 ? Number(printData.dueAgentCC).toFixed(2) : '');
    const tCarrierPP = (isAsAgreed && printData.dueCarrierPP > 0) ? 'AS AGREED' : (printData.dueCarrierPP > 0 ? Number(printData.dueCarrierPP).toFixed(2) : '');
    const tCarrierCC = (isAsAgreed && printData.dueCarrierCC > 0) ? 'AS AGREED' : (printData.dueCarrierCC > 0 ? Number(printData.dueCarrierCC).toFixed(2) : '');
    const tTotalPP = (isAsAgreed && printData.totalPP > 0) ? 'AS AGREED' : (printData.totalPP > 0 ? Number(printData.totalPP).toFixed(2) : '');
    const tTotalCC = (isAsAgreed && printData.totalCC > 0) ? 'AS AGREED' : (printData.totalCC > 0 ? Number(printData.totalCC).toFixed(2) : '');

    const ssrText = printData.ssrText !== undefined ? printData.ssrText : '';
    const osiText = printData.osiText !== undefined ? printData.osiText : '';
    const acctText = printData.accountingInfo !== undefined ? printData.accountingInfo : '';
    const sciInput = printData.sci !== undefined ? printData.sci : '';

    // SPH Codes — skip codes already mentioned in SSR/OSI text to avoid duplicates
    const _combinedHandlingText = ((printData.ssrText || '') + ' ' + (printData.osiText || '')).toUpperCase();
    const sphCodesArr = (printData.sphCodes || [])
      .filter(s => s && s.trim())
      .filter(s => !_combinedHandlingText.includes(s.trim().toUpperCase()));
    const sphCodesHtml = sphCodesArr.length > 0
      ? '<div style="margin-top:3px;font-size:9px;font-weight:bold;letter-spacing:1px;">' + sphCodesArr.join('  ') + '</div>' : '';


    // OCI Rows — only rows with the information typed. 29-Oct-2026: read addInfo / country, which the screens never
    // fill (they keep suppInfo / countryCode), so no OCI line was ever printed. Printed the OCI way:
    // country / information id / customs id / information, e.g. IN/SHP/T/07AAACC6689E1ZJ
    const ociRowsArr = printData.ociRows || [];
    const escOci = (v) => String(v == null ? '' : v).trim().toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ociHtml = ociRowsArr.length > 0
      ? (() => {
          const filtered = ociRowsArr
            .map(r => ({ cc: r.countryCode || r.country || '', id: r.infoId || '', cid: r.customsId || '', info: r.suppInfo || r.addInfo || '' }))
            .filter(r => String(r.info).trim())  // Must have actual supplementary info
            .map(r => [r.cc, r.id, r.cid, r.info].map(escOci).join('/'))
            .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
          return filtered.length > 0
            ? '<div style="margin-top:3px;font-size:8px;font-family:monospace;">' + filtered.join('  ') + '</div>'
            : '';
        })()
      : '';

    // Linked HAWBs (for MAWB print)
    const linkedHawbsArr = printData.linkedHawbs || [];
    const linkedHawbsHtml = linkedHawbsArr.length > 0
      ? '<div style="margin-top:2px;font-size:8px;"><strong>HOUSE WAYBILLS:</strong> ' +
        linkedHawbsArr.map(h => h.hawbNumber || h.awbNumber || h.awb || '').filter(Boolean).join(' / ') + // the MAWB screen keeps the number in .awb - none was printed (29-Oct-2026)
        '</div>' : '';

    const otherChargesList = printData.otherCharges || [];
    let combinedOtherChargesStr = '';
      if (isAsAgreed && otherChargesList.length > 0) {
          combinedOtherChargesStr = 'AS AGREED';
      } else {
          // IATA Standard format: [ChargeCode + EntitlementSuffix] [Amount]
          // 2-letter code: AW + carrier → AWC, AW + agent → AWA
          // 3-letter code: AMS → AMS (no suffix)
          combinedOtherChargesStr = otherChargesList
            .filter(c => c.code && c.amount && parseFloat(c.amount) > 0)
            .map(c => {
              const code = (c.code || '').toUpperCase().trim();
              const suffix = c.entitlement === 'agent' ? 'A' : 'C';
              const finalCode = code.length === 2 ? `${code}${suffix}` : code;
              return `${finalCode} ${parseFloat(c.amount).toFixed(2)}`;
            }).join('   ');
      }


    // Extract user name from JWT token
    let userName = '';
    try {
        const token = localStorage.getItem('token');
        if (token) {
            const payloadStr = atob(token.split('.')[1]);
            const payload = JSON.parse(payloadStr);
            userName = payload.name || payload.username || payload.user || payload.email || 'SYSTEM';
            if (userName.includes('@')) {
                userName = userName.split('@')[0];
            }
            userName = userName.toUpperCase();
        }
    } catch (e) {
        userName = 'SYSTEM';
    }

    const formatParty = (p) => {
        if (!p) return { name: '', address: '' };
        let addressLines = [];
        if (p.street) addressLines.push(p.street);
        let cs = [];
        if (p.city) cs.push(p.city);
        if (p.state) cs.push(p.state);
        if (p.country) cs.push(p.country);
        if (p.zip) cs.push(p.zip);
        if (cs.length > 0) addressLines.push(cs.join(' '));
        if (p.phone) addressLines.push('PH: ' + p.phone);
        return { name: p.name || '', address: addressLines.join('<br/>'), code: p.code || '' };
    };

    const shipper = formatParty(printData.parties && printData.parties['Shipper']);
    const consignee = formatParty(printData.parties && printData.parties['Consignee']);
    
    let agent = { name: '', address: '', code: '' };
    if (printData.agentDetails) {
        let a = printData.agentDetails;
        let addr = a.place || '';
        agent = { name: a.name || '', address: addr, code: a.code || '' };
    }

    let awbPrefix = printData.awbPrefix || '';
    let hawbNumber = printData.hawbNumber || '';
    // 11-Nov-2026: a house AWB is issued by us (the forwarder), not by the airline; a MAWB / AWB is the airline's
    const isHouseAwb = printData.awbKind ? printData.awbKind === 'HAWB' : !!hawbNumber;
    const issuerName = isHouseAwb ? (agent.name || '') : (printData.airlineName || '');
    let awbSuffix = printData.awbSuffix || '';

    
    const dep = printData.depAirport || '';
    let dest = printData.destAirport || '';
      // Use only IATA code (3 letters) for destination box — not full airport name
      // Full name is too long and overlaps with adjacent boxes
    let to1 = printData.to1 || '';
    if (!to1) to1 = dest;
    const carrier = printData.by1 || '';
    
    // Attempt to get FLIGHT NO and DATE
    // 11-Nov-2026: flight date as on an AWB, "12 NOV" (it printed 2026-11-12)
    const fltDay = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]} ${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][Number(m[2]) - 1] || m[2]}` : String(d || ''); };
    const fltNo1 = printData.flightNumber1 || '';
    const fltDt1 = fltDay(printData.flightDate1);
    const flt = fltNo1 && fltDt1 ? `${fltNo1} / ${fltDt1}` : (fltNo1 || fltDt1 || '');
    const fltNo2 = printData.flightNumber2 || '';
    const fltDt2 = fltDay(printData.flightDate2);
    const flt2 = fltNo2 && fltDt2 ? `${fltNo2} / ${fltDt2}` : (fltNo2 || fltDt2 || '');

    // The other To/By fields
    const to2 = printData.to2 || '';
    const by2 = printData.by2 || '';
    const to3 = printData.to3 || '';
    const by3 = printData.by3 || '';

    
    const curr = printData.currencyCode || 'INR';
    const chgs = printData.chargeCode || 'PP';
    const insurance = printData.insuranceValue || '';
    const nvd = printData.carriageValue || '';
    const ncv = printData.customsValue || '';

    let rawExecDate = printData.executedDate || '';
    let executedPlace = printData.executedPlace || '';
    let executedDate = rawExecDate;
    if (rawExecDate && rawExecDate.includes('-')) {
        const parts = rawExecDate.split('-');
        if (parts.length === 3) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthStr = months[parseInt(parts[1], 10) - 1];
            executedDate = `${parts[2]} ${monthStr} ${parts[0]}`;
        }
    }


    const acct = chgs.startsWith('PP') ? 'FREIGHT PREPAID' : (chgs.startsWith('CC') ? 'FREIGHT COLLECT' : '');
    
    // Grid values
    
    let pcs = '', grossWt = '', kg = 'K', rc = '', itemNo = '', chgWt = '', rate = '', total = '';
    if (printData.rateLines && printData.rateLines.length > 0) {
        const r = printData.rateLines[0];
        pcs = r.pieces || r.noOfPcs || '';
        grossWt = r.grossWeight || '';
        kg = (r.gwUnit || 'K').charAt(0).toUpperCase();
        rc = String(r.rateClassCode || r.rateClass || '').trim().charAt(0); // the class as saved - an empty one printed as Q (11-Nov-2026)
        if (/^SELECT/i.test(String(r.rateClassCode || r.rateClass || ''))) rc = '';
        if (rc.includes('-')) rc = rc.split('-')[0].trim();
        itemNo = r.commodityItemNumber || r.commodityItemNo || '';
        chgWt = r.chargeableWeight || '';
        rate = r.rateAsAgreed ? 'AS AGREED' : (r.rateCharge || '');
        total = r.rateAsAgreed ? 'AS AGREED' : (r.totalAmount || r.total || '');
    }


    // 11-Nov-2026: EVERY rate line is printed (one under the other) and the sub-total row adds them up. Before, only
    // the first line and its own figures were printed, so a 2-line AWB lost line 2 and its total did not match.
    const RL = (printData.rateLines || []).filter(r => r && (r.pieces || r.noOfPcs || r.grossWeight || r.chargeableWeight));
    const cell = (v) => (v === undefined || v === null || String(v) === '' ? '&nbsp;' : v);
    const colOf = (f) => RL.map(f).map(cell).join('<br/>');
    const rcOf = (r) => { const v = String(r.rateClassCode || r.rateClass || '').trim(); return /^SELECT/i.test(v) ? '' : v.charAt(0); };
    let linePcs = pcs, lineGross = grossWt, lineKg = kg, lineRc = rc, lineItem = itemNo, lineChg = chgWt, lineRate = rate, lineTotal = total, sumPcs = pcs, sumGross = grossWt, sumTotal = total;
    if (RL.length > 1) {
        linePcs = colOf(r => r.pieces || r.noOfPcs); lineGross = colOf(r => r.grossWeight); lineKg = colOf(r => (r.gwUnit || 'K').charAt(0).toUpperCase());
        lineRc = colOf(rcOf); lineItem = colOf(r => r.commodityItemNumber || r.commodityItemNo); lineChg = colOf(r => r.chargeableWeight);
        lineRate = colOf(r => r.rateAsAgreed ? 'AS AGREED' : r.rateCharge); lineTotal = colOf(r => r.rateAsAgreed ? 'AS AGREED' : (r.totalAmount || r.total));
        const n = (v) => parseFloat(v) || 0;
        sumPcs = RL.reduce((a, r) => a + (parseInt(r.pieces || r.noOfPcs, 10) || 0), 0);
        sumGross = RL.reduce((a, r) => a + n(r.grossWeight), 0).toFixed(2);
        sumTotal = RL.some(r => r.rateAsAgreed) ? 'AS AGREED' : RL.reduce((a, r) => a + n(r.totalAmount || r.total), 0).toFixed(2);
    }

    let natureQty = printData.natureOfGoods || '';
    if (printData.rateLines && printData.rateLines.length > 0) {
        const r = printData.rateLines[0];
        natureQty = r.goodsDescription || r.natureOfGoods || r.description || printData.natureOfGoods || '';
        if (RL.length > 1) natureQty = [...new Set(RL.map(x => String(x.goodsDescription || x.natureOfGoods || x.description || '').trim()).filter(Boolean))].join('\n') || natureQty;
        
        let dims = [];
        if (printData.dimRows && printData.dimRows.length > 0) {
            printData.dimRows.forEach(d => {
                if (d.length && d.width && d.height) {
                    const pcs = d.pieces || d.pcs || d.pkgs || 1;
                    const u = d.unit || 'CM';
                    dims.push(`DIMS: ${pcs} PCS ${d.length} X ${d.width} X ${d.height} ${u}`);
                }
            });
        } else if (r.length && r.width && r.height) {
            const pcs = r.noOfUnits || r.pieces || r.noOfPcs || 1;
            const u = r.cmIn || 'CM';
            dims.push(`DIMS: ${pcs} PCS ${r.length} X ${r.width} X ${r.height} ${u}`);
        }
        
        const vol = printData.volume || r.volume;
        if (vol) {
            dims.push(`VOL: ${vol} MC`);
        }
        if (dims.length > 0) {
           natureQty = natureQty.replace(/\n/g, '<br/>');
           natureQty += (natureQty ? '<br/><br/>' : '') + dims.join('<br/>');
        } else {
           natureQty = natureQty.replace(/\n/g, '<br/>');
        }
        
        if (r.harmonisedCode) {
            natureQty += `<br/><br/>HSN: ${r.harmonisedCode}`;
        }
    }
    

  const printType = 'Print AWB';
  // const AWBTermsPage removed to use import
    return `
      <html>
        <head>
          <title>Air Waybill Print Preview</title>
          <style>
            @page { margin: 5mm; size: A4; }
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .awb-outer { width: 100%; max-width: 190mm; margin: 0 auto; border: 2px solid #000; box-sizing: border-box; }
            .row { display: flex; border-bottom: 1px solid #000; width: 100%; }
            .row.thick-bottom { border-bottom: 2px solid #000; }
            .col { border-right: 1px solid #000; padding: 2px 4px; box-sizing: border-box; display: flex; flex-direction: column; }
            .col:last-child { border-right: none; }
            .col.thick-right { border-right: 2px solid #000; }
            .box-title { font-size: 7px; margin-bottom: 2px; line-height: 1; }
            .val { font-size: 11px; font-family: monospace; white-space: pre-wrap; font-weight: normal; text-transform: uppercase; }
            .val-normal { font-size: 11px; font-family: monospace; white-space: pre-wrap; text-transform: uppercase; }
            
            .top-bar { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: none; font-size: 14px; font-weight: normal; width: 100%; max-width: 190mm; margin: 0 auto; box-sizing: border-box; }
            .top-bar-left { display: flex; gap: 4px; }
            .top-bar-left span { padding: 0 4px; }
            .top-bar-left span:not(:last-child) { border-right: 1px solid #000; }
            
            .header-gray { background-color: #e5e5e5; border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px 4px; font-size: 7px; width: fit-content; align-self: flex-end; }
            .header-gray-full { background-color: #e5e5e5; border-bottom: 1px solid #000; padding: 2px 4px; font-size: 7px; text-align: center; }
            
            .grid-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .grid-table th { border-right: 1px solid #000; border-bottom: 2px solid #000; font-size: 7px; font-weight: normal; padding: 2px; vertical-align: top; text-align: left; }
            .grid-table td { border-right: 1px solid #000; padding: 2px; vertical-align: top; font-family: monospace; font-size: 11px; font-weight: normal; }
            .grid-table th:last-child, .grid-table td:last-child { border-right: none; }
            .grid-table th.thick, .grid-table td.thick { border-right: 2px solid #000; }
            
            .routing-table { width: 100%; border-collapse: collapse; }
            .routing-table td { border-right: 1px solid #000; padding: 2px; vertical-align: top; }
            .routing-table td:last-child { border-right: none; }
            .routing-title { font-size: 7px; }
            .routing-val { font-size: 11px; font-weight: normal; font-family: monospace; text-align: center; text-transform: uppercase; }
            
            .totals-right { width: 52%; padding: 4px; display: flex; flex-direction: column; justify-content: space-between; }
            
            /* Rigid IATA Box Styles */
            .iata-wrap { position: absolute; top: -1px; height: 14px; }
            .svg-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }
            .svg-text {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      text-align: center;
      font-size: 7.5px;
      line-height: 12px;
      font-family: Arial, sans-serif;
      z-index: 1;
      white-space: nowrap;
      pointer-events: none;
    }
            
            .abs-row { position: relative; width: 100%; border-bottom: 1px solid #000; box-sizing: border-box; }
            .abs-val { position: absolute; left: 0; width: 50%; text-align: center; font-size: 11px; font-weight: normal; font-family: monospace; }
            
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <!-- Top Bar -->
          <div class="top-bar">
            <div class="top-bar-left">
              <span>${awbPrefix || "&nbsp;"}</span>
              <span>${dep || "&nbsp;"}</span>
              <span>${awbSuffix || "&nbsp;"}</span>
            </div>
            <div>${hawbNumber ? hawbNumber : (awbPrefix ? awbPrefix + '-' + awbSuffix : "&nbsp;")}</div>
          </div>
          <div class="awb-outer">
            
            <!-- Row 1 -->
            <div class="row thick-bottom" style="height: 90px;">
              <div class="col thick-right" style="width: 48%; position: relative; padding: 0;">
                <div style="display: flex; justify-content: space-between;">
                  <span class="box-title" style="margin-top: 2px; padding-left: 4px;">Shipper's Name and Address</span>
                  <div style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px 4px; font-size: 8px; width: 180px; height: 16px; box-sizing: border-box; background-color: #fff; display: flex; align-items: center;">Shipper's Account Number</div>
                </div>
                <div class="val" style="padding: 4px;">${shipper.name ? shipper.name + '<br/>' + shipper.address : ''}</div>
              </div>
              <div class="col" style="width: 52%; padding: 4px;">
                <span class="box-title">Not negotiable</span>
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <span style="font-size: 14px; font-weight: normal;">${isHouseAwb ? 'HOUSE AIR WAYBILL' : 'AIR WAYBILL'}</span>
                  <span class="val" style="font-size: 14px;"></span>
                </div>
                <span class="box-title" style="margin-top: 10px;">issued by</span>
                  <div class="val" style="margin-top: 4px; font-weight: bold; font-family: Arial, sans-serif; font-size: 11px;">${issuerName ? issuerName.toUpperCase() : ''}</div>
              </div>
            </div>
            
            <!-- Row 2 -->
            <div class="row thick-bottom" style="height: 90px;">
              <div class="col thick-right" style="width: 48%; position: relative; padding: 0;">
                <div style="display: flex; justify-content: space-between;">
                  <span class="box-title" style="margin-top: 2px; padding-left: 4px;">Consignee's Name and Address</span>
                  <div style="border-bottom: 1px solid #000; border-left: 1px solid #000; padding: 2px 4px; font-size: 8px; width: 180px; height: 16px; box-sizing: border-box; background-color: #e5e5e5; display: flex; align-items: center;">Consignee's Account Number</div>
                </div>
                <div class="val" style="padding: 4px;">${consignee.name ? consignee.name + '<br/>' + consignee.address : ''}</div>
              </div>
              <div class="col" style="width: 52%; padding: 0; display: flex; flex-direction: column;">
                <div style="border-bottom: 1px solid #000; padding: 4px; font-size: 7px; font-weight: normal;">
                  Copies 1, 2 and 3 of this ${isHouseAwb ? 'House Air Waybill' : 'Air Waybill'} are originals and have the same validity
                </div>
                <div style="padding: 4px; font-size: 7px; text-align: justify;">
                  It is agreed that the goods described herein are accepted in apparent good order and condition (except as noted) for carriage SUBJECT TO THE CONDITIONS OF CONTRACT ON THE REVERSE HEREOF. ALL goods may be carried by any other means including road or any other carrier unless specific contrary instructions are given herein by the shipper and shipper agrees that the shipment may be carried via intermediate stopping places which the carrier deems appropriate.
                </div>
              </div>
            </div>
            
            <!-- Row 3 -->
            <div class="row" style="display: flex; border-bottom: none;">
              <div class="col" style="width: 48%; border-right: 2px solid #000; border-bottom: 2px solid #000; padding: 4px;">
                <span class="box-title">Issuing Carrier's Agent Name and City</span>
                <div class="val" style="margin-top: 10px; font-size: 12px; line-height: 1.2;">${agent.name ? agent.name + (agent.address ? '<br/>' + agent.address : '') : ''}</div>
              </div>
              <div class="col" style="width: 52%; padding: 4px; border-bottom: none; border-right: none;">
                <span class="box-title">Accounting Information</span>
                <div class="val-normal" style="margin-top: 10px;">${acctText && acctText.toUpperCase().includes('FREIGHT') ? acctText : (acct + (acctText ? '<br/>' + acctText : ''))}</div>
              </div>
            </div>
            
            <!-- Row 4 -->
            <div class="row" style="display: flex; border-bottom: none;">
              <div class="col" style="width: 48%; border-right: 2px solid #000; border-bottom: 2px solid #000; padding: 0; display: flex; flex-direction: row;">
                <div style="flex: 1; border-right: 1px solid #000; padding: 4px;">
                  <span class="box-title">Agent's IATA Code</span>
                  <div class="val" style="margin-top: 4px; font-size: 12px;">${agent.code || ''}</div>
                </div>
                <div style="flex: 1; padding: 4px;">
                  <span class="box-title">Account No.</span>
                </div>
              </div>
              <div class="col" style="width: 52%; padding: 0; border-bottom: none; border-right: none;"></div>
            </div>
            
            <!-- Row 5 -->
            <div class="row thick-bottom" style="display: flex;">
              <div class="col" style="width: 48%; border-right: 2px solid #000; padding: 4px;">
                <span class="box-title">Airport of Departure (Addr. Of First Carrier) and requested Routing</span>
                <div class="val-normal" style="margin-top: 4px;">${dep}</div>
              </div>
              <div class="col" style="width: 52%; padding: 4px; border-right: none;"></div>
            </div>
            
            <!-- Row 6 (Routing) -->
            <div class="row thick-bottom" style="display: flex; box-sizing: border-box; height: 38px;">
              <div style="width: 4.5%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                <div class="routing-title">To</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${to1}</div>
              </div>
              <div style="width: 13.5%; position: relative; padding: 2px; box-sizing: border-box;">
                  <div class="routing-title">By First Carrier</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${carrier}</div>
                </div>
                <div style="width: 12%; border-right: 1px solid #000; position: relative; box-sizing: border-box;">
                  <div style="position: absolute; top: -1px; left: -25%; width: 125%; height: 14px; z-index: 1;">
                    <svg class="svg-bg" style="width: 100%; height: 100%; overflow: visible;" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 85,100 15,100" fill="none" stroke="black" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: 0; left: 0; font-size: 7.5px; width: 100%; text-align: center; letter-spacing: -0.3px;">Routing and Destination</div>
                  </div>
                </div>
                <div style="width: 18%; border-right: 2px solid #000; position: relative; display: flex; padding: 0; box-sizing: border-box;">
                  <!-- The 4 boxes -->
                    <div style="width: 25%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;"><div class="routing-title">To</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${to2}</div></div>
                    <div style="width: 25%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;"><div class="routing-title">by</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${by2}</div></div>
                    <div style="width: 25%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;"><div class="routing-title">To</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${to3}</div></div>
                    <div style="width: 25%; position: relative; padding: 2px; box-sizing: border-box;"><div class="routing-title">by</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${by3}</div></div>
                  </div>
              <div style="width: 6.5%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                <div class="routing-title">Currency</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${curr}</div>
              </div>
              <div style="width: 6.5%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                <div class="routing-title" style="line-height: 1.1; font-size: 8px;">CHGS<br/>Code</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${chgs.substring(0,2)}</div>
              </div>
              <div style="width: 5.25%; border-right: 2px solid #000; padding: 0; box-sizing: border-box;">
                <div style="height: 50%; border-bottom: 1px solid #000; padding: 2px; box-sizing: border-box;">
                  <div class="routing-title" style="font-size: 8px;">WT/VAL</div>
                </div>
                <div style="height: 50%; display: flex; box-sizing: border-box;">
                  <div style="width: 50%; border-right: 1px solid #000; padding: 0 2px; box-sizing: border-box; font-family: monospace; font-size: 10px; display: flex; align-items: flex-end;">X</div>
                  <div style="width: 50%; padding: 0 2px; box-sizing: border-box;"></div>
                </div>
              </div>
              <div style="width: 5.25%; border-right: 1px solid #000; padding: 0; box-sizing: border-box;">
                <div style="height: 50%; border-bottom: 1px solid #000; padding: 2px; box-sizing: border-box;">
                  <div class="routing-title" style="font-size: 8px;">Other</div>
                </div>
                <div style="height: 50%; display: flex; box-sizing: border-box;">
                  <div style="width: 50%; border-right: 1px solid #000; padding: 0 2px; box-sizing: border-box; font-family: monospace; font-size: 10px; display: flex; align-items: flex-end;">X</div>
                  <div style="width: 50%; padding: 0 2px; box-sizing: border-box;"></div>
                </div>
              </div>
              <div style="width: 14.25%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                <div class="routing-title">Declared Value for Carriage</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${nvd}</div>
              </div>
              <div style="width: 14.25%; position: relative; padding: 2px; box-sizing: border-box;">
                <div class="routing-title">Declared Value for Customs</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${ncv}</div>
              </div>
            </div>
            
            <!-- Row 7 -->
              <div class="row thick-bottom" style="display: flex; box-sizing: border-box; height: 38px;">
                <div style="width: 24%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                  <div class="routing-title">Airport of Destination</div><div class="val-normal" style="position: absolute; bottom: 2px; left: 2px;">${dest}</div>
                </div>
                <div style="width: 24%; border-right: 2px solid #000; position: relative; box-sizing: border-box;">
                  <div style="position: absolute; top: -1px; left: 10%; width: 80%; height: 14px; z-index: 1;">
                    <svg class="svg-bg" style="width: 100%; height: 100%; overflow: visible;" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 85,100 15,100" fill="none" stroke="black" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: 0; left: 0; font-size: 7.5px; width: 100%; text-align: center; letter-spacing: -0.2px;">Requested Flight No/Date</div>
                  </div>
                  <div class="routing-val" style="position: absolute; bottom: 2px; left: 0; width: 100%;">${flt} ${flt2}</div>
                </div>
                <div style="width: 13%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                  <div class="routing-title">Amount of Insurance</div><div class="val-normal" style="position: absolute; bottom: 2px; left: 2px;">${insurance}</div>
                </div>
                <div style="width: 39%; padding: 2px; box-sizing: border-box;">
                  <div class="routing-title" style="text-align: justify; line-height: 1.1; font-size: 6.5px;">INSURANCE - If carrier offers insurance and such insurance is requested in accordance with conditions on reverse herof indicate amount to be insured in figures in box marked Amount of Insurance.</div>
                </div>
              </div>
              
              <!-- Row 8 (Handling Info) -->
            <div class="row thick-bottom" style="position: relative;">
              <div class="col" style="width: 100%; padding: 4px; min-height: 40px;">
                <span class="box-title">Handling Information</span>
                <div class="val-normal" style="margin-top: 4px;">${ssrText}<br/>${osiText}${sphCodesHtml}${ociHtml}${linkedHawbsHtml}</div>
              </div>
              <div style="position: absolute; bottom: 0; right: 2px; border: 1px solid #000; padding: 2px 10px; font-size: 9px;">SCI ${sciInput}</div>
            </div>
            
            <!-- Row 9 (Grid) -->
            <div class="row thick-bottom" style="padding: 0;">
              <style>
                .div-col { width: 8px; background-color: #d1d5db; border-left: 1px solid #000 !important; border-right: 1px solid #000 !important; padding: 0 !important; }
              </style>
              <table class="grid-table" style="height: 100%;">
                <thead>
                  <tr>
                    <th style="width: 5%;"><div class="box-title">No.of<br/>Pieces<br/>RCP</div></th>
                    <th style="width: 9%;"><div class="box-title">Gross<br/>Weight</div></th>
                    <th style="width: 1.5%;"><div class="box-title" style="text-align: center;">kg<br/>lb</div></th>
                    <th class="div-col" style="width: 0.8%;"></th>
                    <th style="width: 1.5%; padding: 0; position: relative; height: 35px; border-right: none; overflow: visible;">
                      <div style="position: absolute; top: 2px; left: 4px; font-size: 8px; white-space: nowrap; z-index: 2;">Rate Class</div>
                    </th>
                    <th style="width: 9%; padding: 0; position: relative; height: 35px; border-right: none;">
                      <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 20px; border-top: 1px solid #000; border-left: 1px solid #000; padding: 2px; font-size: 8px; box-sizing: border-box; z-index: 1;">Commodity<br/>Item No.</div>
                    </th>
                    <th class="div-col" style="width: 0.8%;"></th>
                    <th style="width: 10%;"><div class="box-title">Chargeable<br/>Weight</div></th>
                    <th class="div-col" style="width: 0.8%;"></th>
                    <th style="width: 9%; padding: 0; position: relative; border-right: none;">
                      <div style="position: absolute; top: 2px; left: 4px; font-size: 8px;">Rate</div>
                      <svg style="position: absolute; top:0; left:0; width:100%; height:100%; z-index: 0;" preserveAspectRatio="none"><line x1="0" y1="100%" x2="100%" y2="0" stroke="black" stroke-width="1"/></svg>
                      <div style="position: absolute; bottom: 2px; right: 4px; font-size: 8px; z-index: 1;">Class</div>
                    </th>
                    <th class="div-col" style="width: 0.8%;"></th>
                    <th style="width: 16%;"><div class="box-title text-center">Total</div></th>
                    <th class="div-col" style="width: 0.8%;"></th>
                    <th style="width: 35%; border-right: none;"><div class="box-title" style="text-align: left; padding-left: 4px;">Nature and Quantity of Goods<br/>(incl. Dimensions or Volume)</div></th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="height: 180px;">
                    <td class="val-normal">${linePcs}</td>
                    <td class="val-normal text-right">${lineGross}</td>
                    <td class="val-normal text-center" style="border-right: none;">${lineKg}</td>
                    <td class="div-col"></td>
                    <td class="val-normal text-center" style="border-right: 1px solid #000;">${lineRc}</td>
                    <td class="val-normal text-center" style="border-right: none;">${lineItem}</td>
                    <td class="div-col"></td>
                    <td class="val-normal text-center" style="border-right: none;">${lineChg}</td>
                    <td class="div-col"></td>
                    <td class="val-normal text-center" style="border-right: none;">${lineRate}</td>
                      <td class="div-col"></td>
                      <td class="val-normal text-center" style="border-right: none;">${lineTotal}</td>
                    <td class="div-col"></td>
                    <td class="val-normal" style="font-weight: normal; font-family: Arial, sans-serif; border-right: none;">${natureQty}</td>
                  </tr>
                  <!-- Sub-total row -->
                  <tr style="height: 20px;">
                    <td style="border-top: 1px solid #000; text-align: left; font-weight: normal; font-size: 11px;">${sumPcs}</td>
                    <td style="border-top: 1px solid #000; text-align: right; font-weight: normal; font-size: 11px;">${sumGross}</td>
                    <td style="border-right: none;"></td>
                    <td class="div-col"></td>
                    <td style="border-right: 1px solid #000;"></td>
                    <td style="border-right: none;"></td>
                    <td class="div-col"></td>
                    <td style="border-right: none;"></td>
                    <td class="div-col"></td>
                    <td style="border-right: none;"></td>
                    <td class="div-col"></td>
                    <td style="border-top: 1px solid #000; text-align: center; font-family: monospace; font-weight: normal; font-size: 11px; border-right: none;">${sumTotal}</td>
                    <td class="div-col"></td>
                    <td style="border-right: none;"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Row 11 (Totals Block - Aligned to Rating Grid) -->
            <div class="row" style="display: flex; border-bottom: none;">
              
                            <!-- Left Block (Totals) - 38.4% width -->
              <div style="width: 38.4%; border-right: 2px solid #000; border-bottom: none; position: relative;">
                <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #000; z-index: 0;"></div>
                
                <!-- Totals Row 1 -->
                <div class="abs-row" style="height: 25px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${wChg.pp}</div>
                  <div class="iata-wrap" style="left: 6%; width: 32%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 85,100 15,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Prepaid</div>
                  </div>
                  <div class="iata-wrap" style="left: 36%; width: 28%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 85,100 15,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Weight Charge</div>
                  </div>
                  <div class="iata-wrap" style="left: 62%; width: 32%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 85,100 15,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Collect</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${wChg.cc}</div>
                </div>

                <!-- Totals Row 2 (No AS AGREED here) -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${vChg.pp}</div>
                  <div class="iata-wrap" style="left: 33%; width: 34%; height: 12px;">
                    <!-- All remaining polygons point INWARDS -->
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 90,100 10,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Valuation Charge</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${vChg.cc}</div>
                </div>

                <!-- Totals Row 3 -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${tChg.pp}</div>
                  <div class="iata-wrap" style="left: 36%; width: 28%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 85,100 15,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Tax</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${tChg.cc}</div>
                </div>

                <!-- Totals Row 4 -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${tAgentPP}</div>
                  <div class="iata-wrap" style="left: 7%; width: 86%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 95,100 5,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Total other Charges Due Agent</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${tAgentCC}</div>
                </div>

                <!-- Totals Row 5 -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${tCarrierPP}</div>
                  <div class="iata-wrap" style="left: 7%; width: 86%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 95,100 5,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Total other Charges Due Carrier</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${tCarrierCC}</div>
                </div>

                <!-- Totals Row 6 (Gray Bar) -->
                <div class="abs-row" style="height: 25px; border-bottom: 2px solid #000; background-color: #e5e5e5;">
                </div>

                <!-- Totals Row 7 -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px; font-weight: bold;">${tTotalPP}</div>
                  <div class="iata-wrap" style="left: 33%; width: 34%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 90,100 10,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px; font-weight: bold;">Total</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%; font-weight: bold;">${tTotalCC}</div>
                </div>

                <!-- Totals Row 8 -->
                <div class="abs-row" style="height: 30px;">
                  <div class="iata-wrap" style="left: 3%; width: 44%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 90,100 10,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px; font-size: 7px;">Currency Conversion Rates</div>
                  </div>
                  <div class="iata-wrap" style="left: 53%; width: 44%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 90,100 10,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px; font-size: 7px;">cc charges in Dest.Currency</div>
                  </div>
                </div>

                <!-- Totals Row 9 -->
                <div class="abs-row" style="height: 30px; border-bottom: none;">
                  <div style="position: absolute; left: 2%; top: 4px; font-size: 9px; line-height: 1.2;">For Carrier's use<br/>only at Destination</div>
                  <div class="iata-wrap" style="right: 2%; width: 46%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 90,100 10,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px; font-size: 8px;">Charges at Destination</div>
                  </div>
                </div>
              </div>
                
                                                    <!-- Merged Right Block (Other Charges + Nature) - 61.6% width -->
                <div style="width: 61.6%; display: flex; flex-direction: column; position: relative;">
                  
                  <!-- Row A (Other Charges) -->
                  <div style="height: 97px; border-bottom: 1px solid #000; padding: 2px 4px; box-sizing: border-box;">
                    <div class="box-title" style="font-size: 8px;">Other Charges</div>
                    <div class="val-normal" style="font-size: 11px; margin-top: 4px; word-wrap: break-word;">${combinedOtherChargesStr}</div>
                  </div>
                  
                  <!-- Row B (Shipper Signature) -->
                  <div style="height: 72px; border-bottom: 1px solid #000; padding: 2px 4px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                    <div class="box-title" style="font-size: 7px; text-align: justify; line-height: 1.1;">
                      Shipper certifies that the particulars on the face herof arre correct and that insofar as any part of the consignment contains dangerous goods such part is properly described by name and is in proper condition for carriage by air according to the applicable Dangerous Goods Regulations
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; width: 100%; padding-bottom: 4px;">
                      <div class="val-normal text-center" style="font-size: 9px; margin-bottom: 2px;">${printData.signatureShipper || shipper.name}</div>
                      <div style="width: 90%; border-top: 1px dashed #000; text-align: center; padding-top: 2px; font-size: 7px;">Signature of Shipper or his Agent</div>
                    </div>
                  </div>
                  
                  <!-- Row C+D (Executed On) -->
                  <div style="height: 91px; border-bottom: 1px solid #000; padding: 2px 4px 6px 4px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-grow: 1; padding-bottom: 2px;">
                      <div class="val-normal" style="font-size: 10px; width: 30%;"></div>
                      <div class="val-normal" style="font-size: 10px; width: 25%; text-align: center;"></div>
                      <div class="val-normal" style="font-size: 9px; width: 45%; text-align: right; word-wrap: break-word;">${(printData.signatureCarrier && !/^\s*AS AGENT FOR CARRIER\s*$/i.test(printData.signatureCarrier)) ? printData.signatureCarrier : ('AS AGENT FOR CARRIER ' + (agent.name || ''))}</div>
                    </div>
                    <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; position: relative; height: 12px;">
                      <div style="position: absolute; top: -11px; left: 16%; font-size: 11px; font-family: 'Courier New', Courier, monospace; font-weight: bold; white-space: nowrap; z-index: 2;">${executedDate}</div>
                      <div style="position: absolute; top: -11px; left: 47%; font-size: 11px; font-family: 'Courier New', Courier, monospace; font-weight: bold; white-space: nowrap; z-index: 2;">${executedPlace}</div>
                      <div style="position: absolute; top: 6px; left: 0; right: 0; border-top: 1px dashed #000; z-index: 0;"></div>
                      <div class="box-title" style="font-size: 8px; background: white; z-index: 1; padding-right: 4px; margin: 0;">Executed on</div>
                      <div class="box-title" style="font-size: 8px; background: white; z-index: 1; padding: 0 4px; margin: 0;">(Date)</div>
                      <div class="box-title" style="font-size: 8px; background: white; z-index: 1; padding: 0 4px; margin: 0;">at</div>
                      <div class="box-title" style="font-size: 8px; background: white; z-index: 1; padding: 0 4px; margin: 0;">(Place)</div>
                      <div class="box-title" style="font-size: 8px; background: white; z-index: 1; padding-left: 4px; margin: 0;">Signature of issuing carrier or Agent</div>
                    </div>
                  </div>
                  
                  <!-- Row E (Total Collect / AWB) -->
                  <div style="flex-grow: 1; padding: 0; box-sizing: border-box; display: flex; align-items: stretch; border-bottom: none;">
                    <!-- Left side of Row E -->
                    <div style="width: 43%; border-bottom: none; border-right: 1px solid #000; position: relative;">
                      <div class="iata-wrap" style="left: 10%; width: 80%; height: 12px; top: -1px; position: absolute;">
                        <svg class="svg-bg" viewBox="0 -1 100 102" preserveAspectRatio="none"><polygon points="0,0 100,0 90,100 10,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                        <div class="svg-text" style="top: -1px; font-size: 8px;">Total collect Charges</div>
                      </div>
                    </div>
                    <!-- Right side of Row E -->
                    <div style="width: 57%; display: flex; justify-content: space-between; align-items: center; padding: 0 8px; font-family: monospace; position: relative; z-index: 1;">
                      <!-- White cover up to hide awb-outer bottom AND right borders for this section -->
                      <div style="position: absolute; top: 0; bottom: -2px; right: -2px; width: 4px; background: white; z-index: -1;"></div>
                      <div style="position: absolute; bottom: -2px; left: 0; right: -2px; height: 4px; background: white; z-index: -1;"></div>
                      
                      <div style="font-size: 11px; padding-left: 4px; padding-right: 8px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; position: relative; z-index: 2;">${userName}</div>
                      <div style="font-weight: bold; font-size: 13px; white-space: nowrap; position: relative; z-index: 2;">${hawbNumber ? hawbNumber : (awbPrefix ? awbPrefix + "-" + awbSuffix : "")}</div>
                    </div>
                  </div>

                </div>
              </div>
              
            </div>
                          
              <div style="text-align: center; font-weight: 900; font-size: 16px; margin-top: 10px; padding-bottom: 15px; color: #000; text-transform: uppercase;">
                ${copyText ? copyText.toUpperCase() : ''}
              </div>

              ${includeTerms ? AWBTermsPage : ''}
          <script>
            setTimeout(() => {
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `;
  };

  const handlePrintPreview = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(getPrintHTML());
    printWindow.document.close();
  };

  
  
  export const handleDownloadManifest = (data) => {
    if (!data || !data.awbPrefix || !data.awbSuffix) return;
    
    const mawb = data.awbPrefix + '-' + data.awbSuffix;
    const dep = data.depAirport || 'UNK';
    const dest = data.destAirport || 'UNK';
    const pcs = data.rateLines && data.rateLines[0] ? data.rateLines[0].pieces : '0';
    const grossWt = data.rateLines && data.rateLines[0] ? data.rateLines[0].grossWeight : '0.00';
    const nature = data.natureOfGoods || 'CONSOLIDATION';
    const issueDate = new Date().toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:HouseManifest xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:rsm="iata:housemanifest:1" xmlns:ram="iata:datamodel:3">
  <rsm:MessageHeaderDocument>
    <ram:ID>${mawb}</ram:ID>
    <ram:Name>Cargo Manifest</ram:Name>
    <ram:TypeCode>785</ram:TypeCode>
    <ram:IssueDateTime>${issueDate}</ram:IssueDateTime>
    <ram:PurposeCode>Creation</ram:PurposeCode>
    <ram:VersionID>2.00</ram:VersionID>
  </rsm:MessageHeaderDocument>
  <rsm:BusinessHeaderDocument>
    <ram:ID>${mawb}</ram:ID>
  </rsm:BusinessHeaderDocument>
  <rsm:MasterConsignment>
    <ram:IncludedTareGrossWeightMeasure unitCode="KGM">${grossWt}</ram:IncludedTareGrossWeightMeasure>
    <ram:TotalPieceQuantity>${pcs}</ram:TotalPieceQuantity>
    <ram:FinalDestinationLocation>
      <ram:ID>${dest}</ram:ID>
    </ram:FinalDestinationLocation>
  </rsm:MasterConsignment>
</rsm:HouseManifest>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manifest_${mawb}_XFZB.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

  
  

export const handleDownloadXFWB = (data) => {
    if (!data || !data.awbPrefix || !data.awbSuffix) return;

    const mawb = data.awbPrefix + '-' + data.awbSuffix;
    const dep = data.depAirport || 'UNK';
    const dest = data.destAirport || 'UNK';
    const pcs = data.rateLines && data.rateLines[0] ? data.rateLines[0].pieces : '0';
    const grossWt = data.rateLines && data.rateLines[0] ? data.rateLines[0].grossWeight : '0.00';
    const shipperName = data.parties?.Shipper?.name || '';
    const consigneeName = data.parties?.Consignee?.name || '';
    const issueDate = new Date().toISOString().split('.')[0];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<awb:Waybill xmlns:awb="iata:waybill:1" xmlns:ram="iata:datamodel:3">
  <awb:MessageHeaderDocument>
    <ram:ID>${data.awbSuffix}</ram:ID>
    <ram:Name>Master Air Waybill</ram:Name>
    <ram:TypeCode>741</ram:TypeCode>
    <ram:IssueDateTime>${issueDate}</ram:IssueDateTime>
    <ram:PurposeCode>Creation</ram:PurposeCode>
    <ram:VersionID>3.00</ram:VersionID>
  </awb:MessageHeaderDocument>
  <awb:BusinessHeaderDocument>
    <ram:ID>${mawb}</ram:ID>
  </awb:BusinessHeaderDocument>
  <awb:MasterConsignment>
    <ram:TotalPieceQuantity>${pcs}</ram:TotalPieceQuantity>
    <ram:IncludedTareGrossWeightMeasure unitCode="KGM">${grossWt}</ram:IncludedTareGrossWeightMeasure>
    <ram:ConsignorParty>
      <ram:Name>${shipperName}</ram:Name>
    </ram:ConsignorParty>
    <ram:ConsigneeParty>
      <ram:Name>${consigneeName}</ram:Name>
    </ram:ConsigneeParty>
    <ram:OriginLocation>
      <ram:ID>${dep}</ram:ID>
    </ram:OriginLocation>
    <ram:FinalDestinationLocation>
      <ram:ID>${dest}</ram:ID>
    </ram:FinalDestinationLocation>
  </awb:MasterConsignment>
</awb:Waybill>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AWB_${mawb}_XFWB.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

  


export const printAWB = (selectedCopies = [""], includeTerms = true) => {
    if (!selectedCopies || selectedCopies.length === 0) selectedCopies = [""];
    
    let firstHtml = getPrintHTML(selectedCopies[0], includeTerms);
    let headMatch = firstHtml.match(/<head>([\s\S]*?)<\/head>/i);
    let headContent = headMatch ? headMatch[1] : '';
    headContent += "\n<style>@media print { .page-break { page-break-after: always; } } .page-break { page-break-after: always; }</style>";
    
    let fullHtml = "<html><head>" + headContent + "</head><body style=\"margin:0; padding:0; background: #fff;\">";
    
    for (let i = 0; i < selectedCopies.length; i++) {
        let singleHtml = getPrintHTML(selectedCopies[i], includeTerms);
        let bodyContentMatch = singleHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let content = bodyContentMatch ? bodyContentMatch[1] : singleHtml;
        content = content.replace(/<script>[\s\S]*?<\/script>/gi, ''); // remove individual scripts
        fullHtml += "<div class=\"page-break\">" + content + "</div>";
    }
    
    fullHtml += "<script>setTimeout(() => { window.print(); }, 500);</script></body></html>";

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(fullHtml);
    doc.close();
    
    setTimeout(() => {
        if(document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 10000);
};


export const downloadAWBPDF = async (selectedCopies = [""], includeTerms = true) => {
    if (!selectedCopies || selectedCopies.length === 0) selectedCopies = [""];
    
    let firstHtml = getPrintHTML(selectedCopies[0], includeTerms);
    let headMatch = firstHtml.match(/<head>([\s\S]*?)<\/head>/i);
    let headContent = headMatch ? headMatch[1] : '';
    headContent += "\n<style>@media print { .page-break { page-break-after: always; } } .page-break { page-break-after: always; }</style>";
    
    let fullHtml = "<html><head>" + headContent + "</head><body style=\"margin:0; padding:0; background: #fff;\">";
    
    for (let i = 0; i < selectedCopies.length; i++) {
        let singleHtml = getPrintHTML(selectedCopies[i], includeTerms);
        let bodyContentMatch = singleHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let content = bodyContentMatch ? bodyContentMatch[1] : singleHtml;
        content = content.replace(/<script>[\s\S]*?<\/script>/gi, '');
        fullHtml += "<div class=\"page-break\">" + content + "</div>";
    }
    fullHtml += "</body></html>";
    let html = fullHtml;
    
    let awbPrefix = '', awbSuffix = '';
    try {
        const payload = JSON.parse(document.getElementById('awb-print-data').getAttribute('data-json'));
        awbPrefix = payload.awbPrefix || '';
        awbSuffix = payload.awbSuffix || '';
    } catch(e) {}
    const filename = awbPrefix && awbSuffix ? `AWB_${awbPrefix}-${awbSuffix}.pdf` : 'Airway_Bill.pdf';

    try {
        showSuccessToast('Info', 'Generating PDF... Please wait.', false);
        const response = await fetch('/api/awb/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html, filename })
        });
        
        if (!response.ok) {
            let errMsg = 'Failed to generate PDF';
            try {
                const errData = await response.json();
                errMsg = errData.error || errMsg;
            } catch(e) { errMsg = 'HTTP ERROR'; }
            throw new Error(errMsg);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Open in new tab
        window.open(url, '_blank');
        
        // Also download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => window.URL.revokeObjectURL(url), 2000);
        showSuccessToast('Success', 'PDF Downloaded Successfully!');
    } catch (err) {
        console.error(err);
        // 11-Nov-2026: the server could not make the PDF - open the print window instead, where "Microsoft Print to
        // PDF" / "Save as PDF" makes the same file (as before the server PDF)
        showSuccessToast('Info', 'Server PDF not available (' + (err.message || err.toString()) + '). Opening the print window - choose "Microsoft Print to PDF" or "Save as PDF".', false);
        printAWB(selectedCopies, includeTerms);
    }
};
