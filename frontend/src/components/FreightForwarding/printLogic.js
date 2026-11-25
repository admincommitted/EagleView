import AWBTermsPage from './AWBTermsPage';
import { freightApi } from './freightApi';
import { downloadBlob } from '@/lib/download';
import { getToken } from '@/services/session';

export const showSuccessToast = (title, message, isError = false) => {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { title, message, isError } }));
};

export const showValidationErrorsModal = (errors) => {
  window.dispatchEvent(new CustomEvent('show-validation-errors', { detail: { errors } }));
};

const AS_AGREED = 'AS AGREED';
const FLIGHT_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const EXECUTED_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE_BREAK_STYLE = "\n<style>@media print { .page-break { page-break-after: always; } } .page-break { page-break-after: always; }</style>";
const COPIES_BODY_OPEN = "<body style=\"margin:0; padding:0; background: #fff;\">";
const AUTO_PRINT_SCRIPT = "<script>setTimeout(() => { window.print(); }, 500);</script>";

// The AWB screens keep the whole AWB as JSON on a hidden #awb-print-data element.
function readPrintData() {
  const json = document.getElementById('awb-print-data')?.getAttribute('data-json');
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to parse print data JSON', error);
    return {};
  }
}

const blankIfUndefined = (value) => (value !== undefined ? value : '');
const toNumber = (value) => parseFloat(value) || 0;
const positiveOrBlank = (value) => (toNumber(value) > 0 ? value : '');
const amountOrBlank = (value) => (value > 0 ? Number(value).toFixed(2) : '');
const prepaidCollect = (isAsAgreed, prepaid, collect) => ({
  prepaid: isAsAgreed && prepaid ? AS_AGREED : prepaid,
  collect: isAsAgreed && collect ? AS_AGREED : collect,
});

function chargeBoxes(data, isAsAgreed) {
  return {
    weightCharge: prepaidCollect(isAsAgreed, data.weightChargePP || '', data.weightChargeCC || ''),
    valuationCharge: prepaidCollect(isAsAgreed, positiveOrBlank(data.valChargePP), positiveOrBlank(data.valChargeCC)),
    taxCharge: prepaidCollect(isAsAgreed, positiveOrBlank(data.taxPP), positiveOrBlank(data.taxCC)),
    dueAgent: prepaidCollect(isAsAgreed, amountOrBlank(data.dueAgentPP), amountOrBlank(data.dueAgentCC)),
    dueCarrier: prepaidCollect(isAsAgreed, amountOrBlank(data.dueCarrierPP), amountOrBlank(data.dueCarrierCC)),
    grandTotal: prepaidCollect(isAsAgreed, amountOrBlank(data.totalPP), amountOrBlank(data.totalCC)),
  };
}

// A special handling code already written in the SSR / OSI text is not printed a second time.
function specialHandlingCodesHtml(data) {
  const handlingText = ((data.ssrText || '') + ' ' + (data.osiText || '')).toUpperCase();
  const codes = (data.sphCodes || [])
    .filter((code) => code && code.trim())
    .filter((code) => !handlingText.includes(code.trim().toUpperCase()));
  return codes.length > 0
    ? '<div style="margin-top:3px;font-size:9px;font-weight:bold;letter-spacing:1px;">' + codes.join('  ') + '</div>'
    : '';
}

const escapeOciPart = (value) => String(value == null ? '' : value).trim().toUpperCase()
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// OCI line: country / information id / customs information id / information, e.g. IN/SHP/T/07AAACC6689E1ZJ
function otherCustomsInfoHtml(data) {
  const lines = (data.ociRows || [])
    .map((row) => ({
      country: row.countryCode || row.country || '',
      infoId: row.infoId || '',
      customsId: row.customsId || '',
      info: row.suppInfo || row.addInfo || '',
    }))
    .filter((row) => String(row.info).trim())
    .map((row) => [row.country, row.infoId, row.customsId, row.info].map(escapeOciPart).join('/'))
    .filter((line, index, all) => all.indexOf(line) === index);
  return lines.length > 0
    ? '<div style="margin-top:3px;font-size:8px;font-family:monospace;">' + lines.join('  ') + '</div>'
    : '';
}

function linkedHouseWaybillsHtml(data) {
  const houses = data.linkedHawbs || [];
  if (houses.length === 0) return '';
  const numbers = houses.map((house) => house.hawbNumber || house.awbNumber || house.awb || '').filter(Boolean);
  return '<div style="margin-top:2px;font-size:8px;"><strong>HOUSE WAYBILLS:</strong> ' + numbers.join(' / ') + '</div>';
}

// IATA other-charge code: a 2-letter code takes the entitlement suffix (AW due carrier = AWC, due agent = AWA);
// a 3-letter code (AMS) prints as it is.
function otherChargesText(data, isAsAgreed) {
  const charges = data.otherCharges || [];
  if (isAsAgreed && charges.length > 0) return AS_AGREED;
  return charges
    .filter((charge) => charge.code && charge.amount && parseFloat(charge.amount) > 0)
    .map((charge) => {
      const code = (charge.code || '').toUpperCase().trim();
      const suffix = charge.entitlement === 'agent' ? 'A' : 'C';
      const printedCode = code.length === 2 ? `${code}${suffix}` : code;
      return `${printedCode} ${parseFloat(charge.amount).toFixed(2)}`;
    })
    .join('   ');
}

function printedUserName() {
  try {
    const token = getToken();
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    let name = payload.name || payload.username || payload.user || payload.email || 'SYSTEM';
    if (name.includes('@')) name = name.split('@')[0];
    return name.toUpperCase();
  } catch {
    return 'SYSTEM';
  }
}

function formatParty(party) {
  if (!party) return { name: '', address: '' };
  const addressLines = [];
  if (party.street) addressLines.push(party.street);
  const cityLine = [party.city, party.state, party.country, party.zip].filter(Boolean);
  if (cityLine.length > 0) addressLines.push(cityLine.join(' '));
  if (party.phone) addressLines.push('PH: ' + party.phone);
  return { name: party.name || '', address: addressLines.join('<br/>'), code: party.code || '' };
}

const issuingAgent = (details) => (details
  ? { name: details.name || '', address: details.place || '', code: details.code || '' }
  : { name: '', address: '', code: '' });

const flightDay = (date) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''));
  return match ? `${match[3]} ${FLIGHT_MONTHS[Number(match[2]) - 1] || match[2]}` : String(date || '');
};

const flightText = (flightNumber, flightDate) => {
  const day = flightDay(flightDate);
  return flightNumber && day ? `${flightNumber} / ${day}` : (flightNumber || day || '');
};

function executedOnDate(rawDate) {
  if (!rawDate || !rawDate.includes('-')) return rawDate;
  const parts = rawDate.split('-');
  if (parts.length !== 3) return rawDate;
  return `${parts[2]} ${EXECUTED_MONTHS[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

const freightTermsOf = (chargeCode) => {
  if (chargeCode.startsWith('PP')) return 'FREIGHT PREPAID';
  if (chargeCode.startsWith('CC')) return 'FREIGHT COLLECT';
  return '';
};

const linePieces = (line) => line.pieces || line.noOfPcs;
const lineWeightUnit = (line) => (line.gwUnit || 'K').charAt(0).toUpperCase();
const lineItemNo = (line) => line.commodityItemNumber || line.commodityItemNo;
const lineRate = (line) => (line.rateAsAgreed ? AS_AGREED : line.rateCharge);
const lineTotal = (line) => (line.rateAsAgreed ? AS_AGREED : (line.totalAmount || line.total));
const lineGoods = (line) => line.goodsDescription || line.natureOfGoods || line.description;
const isPrintedLine = (line) => line && (line.pieces || line.noOfPcs || line.grossWeight || line.chargeableWeight);
const blankCell = (value) => (value === undefined || value === null || String(value) === '' ? '&nbsp;' : value);

function firstLineRateClass(line) {
  const saved = String(line.rateClassCode || line.rateClass || '');
  if (/^SELECT/i.test(saved)) return '';
  const letter = saved.trim().charAt(0);
  return letter === '-' ? '' : letter;
}

function multiLineRateClass(line) {
  const saved = String(line.rateClassCode || line.rateClass || '').trim();
  return /^SELECT/i.test(saved) ? '' : saved.charAt(0);
}

function singleLineGrid(firstLine) {
  if (!firstLine) {
    return { pieces: '', gross: '', weightUnit: 'K', rateClass: '', itemNo: '', chargeable: '', rate: '', total: '' };
  }
  return {
    pieces: linePieces(firstLine) || '',
    gross: firstLine.grossWeight || '',
    weightUnit: lineWeightUnit(firstLine),
    rateClass: firstLineRateClass(firstLine),
    itemNo: lineItemNo(firstLine) || '',
    chargeable: firstLine.chargeableWeight || '',
    rate: lineRate(firstLine) || '',
    total: lineTotal(firstLine) || '',
  };
}

// Every rate line is printed one under the other, and the sub-total row adds them up.
function rateGrid(rateLines, printedLines) {
  if (printedLines.length <= 1) {
    const grid = singleLineGrid(rateLines[0]);
    return { ...grid, totalPieces: grid.pieces, totalGross: grid.gross, totalCharge: grid.total };
  }
  const column = (read) => printedLines.map(read).map(blankCell).join('<br/>');
  return {
    pieces: column(linePieces),
    gross: column((line) => line.grossWeight),
    weightUnit: column(lineWeightUnit),
    rateClass: column(multiLineRateClass),
    itemNo: column(lineItemNo),
    chargeable: column((line) => line.chargeableWeight),
    rate: column(lineRate),
    total: column(lineTotal),
    totalPieces: printedLines.reduce((sum, line) => sum + (parseInt(linePieces(line), 10) || 0), 0),
    totalGross: printedLines.reduce((sum, line) => sum + toNumber(line.grossWeight), 0).toFixed(2),
    totalCharge: printedLines.some((line) => line.rateAsAgreed)
      ? AS_AGREED
      : printedLines.reduce((sum, line) => sum + toNumber(line.totalAmount || line.total), 0).toFixed(2),
  };
}

function measurementLines(data, firstLine) {
  const lines = [];
  if (data.dimRows && data.dimRows.length > 0) {
    data.dimRows
      .filter((dim) => dim.length && dim.width && dim.height)
      .forEach((dim) => lines.push(`DIMS: ${dim.pieces || dim.pcs || dim.pkgs || 1} PCS ${dim.length} X ${dim.width} X ${dim.height} ${dim.unit || 'CM'}`));
  } else if (firstLine.length && firstLine.width && firstLine.height) {
    const pieces = firstLine.noOfUnits || firstLine.pieces || firstLine.noOfPcs || 1;
    lines.push(`DIMS: ${pieces} PCS ${firstLine.length} X ${firstLine.width} X ${firstLine.height} ${firstLine.cmIn || 'CM'}`);
  }
  const volume = data.volume || firstLine.volume;
  if (volume) lines.push(`VOL: ${volume} MC`);
  return lines;
}

function natureAndQuantityHtml(data, rateLines, printedLines) {
  if (rateLines.length === 0) return data.natureOfGoods || '';
  const firstLine = rateLines[0];
  let goods = lineGoods(firstLine) || data.natureOfGoods || '';
  if (printedLines.length > 1) {
    const distinctGoods = new Set(printedLines.map((line) => String(lineGoods(line) || '').trim()).filter(Boolean));
    goods = [...distinctGoods].join('\n') || goods;
  }
  const measurements = measurementLines(data, firstLine);
  let html = goods.replace(/\n/g, '<br/>');
  if (measurements.length > 0) html += (html ? '<br/><br/>' : '') + measurements.join('<br/>');
  if (firstLine.harmonisedCode) html += `<br/><br/>HSN: ${firstLine.harmonisedCode}`;
  return html;
}

function carrierSignatureOf(data, agent) {
  const signature = data.signatureCarrier;
  return signature && !/^\s*AS AGENT FOR CARRIER\s*$/i.test(signature) ? signature : 'AS AGENT FOR CARRIER ' + (agent.name || '');
}

export const getPrintHTML = (copyText = "", includeTerms = true) => {
  const data = readPrintData();
  const rateLines = data.rateLines || [];
  const printedLines = rateLines.filter(isPrintedLine);
  const isAsAgreed = rateLines.some((line) => line.rateAsAgreed);

  const charges = chargeBoxes(data, isAsAgreed);
  const grid = rateGrid(rateLines, printedLines);
  const natureQty = natureAndQuantityHtml(data, rateLines, printedLines);
  const otherCharges = otherChargesText(data, isAsAgreed);
  const sphCodesHtml = specialHandlingCodesHtml(data);
  const ociHtml = otherCustomsInfoHtml(data);
  const linkedHawbsHtml = linkedHouseWaybillsHtml(data);
  const userName = printedUserName();

  const ssrText = blankIfUndefined(data.ssrText);
  const osiText = blankIfUndefined(data.osiText);
  const accountingInfo = blankIfUndefined(data.accountingInfo);
  const sci = blankIfUndefined(data.sci);

  const shipper = formatParty(data.parties && data.parties['Shipper']);
  const consignee = formatParty(data.parties && data.parties['Consignee']);
  const agent = issuingAgent(data.agentDetails);
  const shipperSignature = data.signatureShipper || shipper.name;
  const carrierSignature = carrierSignatureOf(data, agent);

  const awbPrefix = data.awbPrefix || '';
  const awbSuffix = data.awbSuffix || '';
  const hawbNumber = data.hawbNumber || '';
  const awbNumberText = hawbNumber || (awbPrefix ? awbPrefix + '-' + awbSuffix : '');
  // A house AWB is issued by the forwarder (us); a master AWB by the airline.
  const isHouseAwb = data.awbKind ? data.awbKind === 'HAWB' : !!hawbNumber;
  const issuerName = isHouseAwb ? (agent.name || '') : (data.airlineName || '');

  const departureAirport = data.depAirport || '';
  const destinationAirport = data.destAirport || '';
  const firstDestination = data.to1 || destinationAirport;
  const firstCarrier = data.by1 || '';
  const to2 = data.to2 || '';
  const by2 = data.by2 || '';
  const to3 = data.to3 || '';
  const by3 = data.by3 || '';
  const firstFlight = flightText(data.flightNumber1 || '', data.flightDate1);
  const secondFlight = flightText(data.flightNumber2 || '', data.flightDate2);

  const currency = data.currencyCode || 'INR';
  const chargeCode = data.chargeCode || 'PP';
  const insurance = data.insuranceValue || '';
  const carriageValue = data.carriageValue || '';
  const customsValue = data.customsValue || '';
  const freightTerms = freightTermsOf(chargeCode);
  const accountingBox = accountingInfo && accountingInfo.toUpperCase().includes('FREIGHT')
    ? accountingInfo
    : freightTerms + (accountingInfo ? '<br/>' + accountingInfo : '');

  const executedDate = executedOnDate(data.executedDate || '');
  const executedPlace = data.executedPlace || '';

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
              <span>${departureAirport || "&nbsp;"}</span>
              <span>${awbSuffix || "&nbsp;"}</span>
            </div>
            <div>${awbNumberText || "&nbsp;"}</div>
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
                <div class="val-normal" style="margin-top: 10px;">${accountingBox}</div>
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
                <div class="val-normal" style="margin-top: 4px;">${departureAirport}</div>
              </div>
              <div class="col" style="width: 52%; padding: 4px; border-right: none;"></div>
            </div>
            
            <!-- Row 6 (Routing) -->
            <div class="row thick-bottom" style="display: flex; box-sizing: border-box; height: 38px;">
              <div style="width: 4.5%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                <div class="routing-title">To</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${firstDestination}</div>
              </div>
              <div style="width: 13.5%; position: relative; padding: 2px; box-sizing: border-box;">
                  <div class="routing-title">By First Carrier</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${firstCarrier}</div>
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
                <div class="routing-title">Currency</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${currency}</div>
              </div>
              <div style="width: 6.5%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                <div class="routing-title" style="line-height: 1.1; font-size: 8px;">CHGS<br/>Code</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${chargeCode.substring(0,2)}</div>
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
                <div class="routing-title">Declared Value for Carriage</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${carriageValue}</div>
              </div>
              <div style="width: 14.25%; position: relative; padding: 2px; box-sizing: border-box;">
                <div class="routing-title">Declared Value for Customs</div><div class="routing-val" style="position: absolute; bottom: 2px; left: 2px;">${customsValue}</div>
              </div>
            </div>
            
            <!-- Row 7 -->
              <div class="row thick-bottom" style="display: flex; box-sizing: border-box; height: 38px;">
                <div style="width: 24%; border-right: 1px solid #000; position: relative; padding: 2px; box-sizing: border-box;">
                  <div class="routing-title">Airport of Destination</div><div class="val-normal" style="position: absolute; bottom: 2px; left: 2px;">${destinationAirport}</div>
                </div>
                <div style="width: 24%; border-right: 2px solid #000; position: relative; box-sizing: border-box;">
                  <div style="position: absolute; top: -1px; left: 10%; width: 80%; height: 14px; z-index: 1;">
                    <svg class="svg-bg" style="width: 100%; height: 100%; overflow: visible;" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 85,100 15,100" fill="none" stroke="black" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: 0; left: 0; font-size: 7.5px; width: 100%; text-align: center; letter-spacing: -0.2px;">Requested Flight No/Date</div>
                  </div>
                  <div class="routing-val" style="position: absolute; bottom: 2px; left: 0; width: 100%;">${firstFlight} ${secondFlight}</div>
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
              <div style="position: absolute; bottom: 0; right: 2px; border: 1px solid #000; padding: 2px 10px; font-size: 9px;">SCI ${sci}</div>
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
                    <td class="val-normal">${grid.pieces}</td>
                    <td class="val-normal text-right">${grid.gross}</td>
                    <td class="val-normal text-center" style="border-right: none;">${grid.weightUnit}</td>
                    <td class="div-col"></td>
                    <td class="val-normal text-center" style="border-right: 1px solid #000;">${grid.rateClass}</td>
                    <td class="val-normal text-center" style="border-right: none;">${grid.itemNo}</td>
                    <td class="div-col"></td>
                    <td class="val-normal text-center" style="border-right: none;">${grid.chargeable}</td>
                    <td class="div-col"></td>
                    <td class="val-normal text-center" style="border-right: none;">${grid.rate}</td>
                      <td class="div-col"></td>
                      <td class="val-normal text-center" style="border-right: none;">${grid.total}</td>
                    <td class="div-col"></td>
                    <td class="val-normal" style="font-weight: normal; font-family: Arial, sans-serif; border-right: none;">${natureQty}</td>
                  </tr>
                  <!-- Sub-total row -->
                  <tr style="height: 20px;">
                    <td style="border-top: 1px solid #000; text-align: left; font-weight: normal; font-size: 11px;">${grid.totalPieces}</td>
                    <td style="border-top: 1px solid #000; text-align: right; font-weight: normal; font-size: 11px;">${grid.totalGross}</td>
                    <td style="border-right: none;"></td>
                    <td class="div-col"></td>
                    <td style="border-right: 1px solid #000;"></td>
                    <td style="border-right: none;"></td>
                    <td class="div-col"></td>
                    <td style="border-right: none;"></td>
                    <td class="div-col"></td>
                    <td style="border-right: none;"></td>
                    <td class="div-col"></td>
                    <td style="border-top: 1px solid #000; text-align: center; font-family: monospace; font-weight: normal; font-size: 11px; border-right: none;">${grid.totalCharge}</td>
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
                  <div class="abs-val" style="width: 50%; top: 12px;">${charges.weightCharge.prepaid}</div>
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
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${charges.weightCharge.collect}</div>
                </div>

                <!-- Totals Row 2 (No AS AGREED here) -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${charges.valuationCharge.prepaid}</div>
                  <div class="iata-wrap" style="left: 33%; width: 34%; height: 12px;">
                    <!-- All remaining polygons point INWARDS -->
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 90,100 10,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Valuation Charge</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${charges.valuationCharge.collect}</div>
                </div>

                <!-- Totals Row 3 -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${charges.taxCharge.prepaid}</div>
                  <div class="iata-wrap" style="left: 36%; width: 28%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 85,100 15,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Tax</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${charges.taxCharge.collect}</div>
                </div>

                <!-- Totals Row 4 -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${charges.dueAgent.prepaid}</div>
                  <div class="iata-wrap" style="left: 7%; width: 86%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 95,100 5,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Total other Charges Due Agent</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${charges.dueAgent.collect}</div>
                </div>

                <!-- Totals Row 5 -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px;">${charges.dueCarrier.prepaid}</div>
                  <div class="iata-wrap" style="left: 7%; width: 86%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 95,100 5,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px;">Total other Charges Due Carrier</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%;">${charges.dueCarrier.collect}</div>
                </div>

                <!-- Totals Row 6 (Gray Bar) -->
                <div class="abs-row" style="height: 25px; border-bottom: 2px solid #000; background-color: #e5e5e5;">
                </div>

                <!-- Totals Row 7 -->
                <div class="abs-row" style="height: 36px;">
                  <div class="abs-val" style="width: 50%; top: 12px; font-weight: bold;">${charges.grandTotal.prepaid}</div>
                  <div class="iata-wrap" style="left: 33%; width: 34%; height: 12px;">
                    <svg class="svg-bg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,0 100,0 90,100 10,100" fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
                    <div class="svg-text" style="top: -1px; font-weight: bold;">Total</div>
                  </div>
                  <div class="abs-val" style="width: 50%; top: 12px; left: 50%; font-weight: bold;">${charges.grandTotal.collect}</div>
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
                    <div class="val-normal" style="font-size: 11px; margin-top: 4px; word-wrap: break-word;">${otherCharges}</div>
                  </div>
                  
                  <!-- Row B (Shipper Signature) -->
                  <div style="height: 72px; border-bottom: 1px solid #000; padding: 2px 4px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
                    <div class="box-title" style="font-size: 7px; text-align: justify; line-height: 1.1;">
                      Shipper certifies that the particulars on the face herof arre correct and that insofar as any part of the consignment contains dangerous goods such part is properly described by name and is in proper condition for carriage by air according to the applicable Dangerous Goods Regulations
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; width: 100%; padding-bottom: 4px;">
                      <div class="val-normal text-center" style="font-size: 9px; margin-bottom: 2px;">${shipperSignature}</div>
                      <div style="width: 90%; border-top: 1px dashed #000; text-align: center; padding-top: 2px; font-size: 7px;">Signature of Shipper or his Agent</div>
                    </div>
                  </div>
                  
                  <!-- Row C+D (Executed On) -->
                  <div style="height: 91px; border-bottom: 1px solid #000; padding: 2px 4px 6px 4px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-grow: 1; padding-bottom: 2px;">
                      <div class="val-normal" style="font-size: 10px; width: 30%;"></div>
                      <div class="val-normal" style="font-size: 10px; width: 25%; text-align: center;"></div>
                      <div class="val-normal" style="font-size: 9px; width: 45%; text-align: right; word-wrap: break-word;">${carrierSignature}</div>
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
                      <div style="font-weight: bold; font-size: 13px; white-space: nowrap; position: relative; z-index: 2;">${awbNumberText}</div>
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

const copiesOrBlank = (copies) => (copies && copies.length ? copies : [""]);

function copiesHtml(copies, includeTerms) {
  const headMatch = getPrintHTML(copies[0], includeTerms).match(/<head>([\s\S]*?)<\/head>/i);
  const head = (headMatch ? headMatch[1] : '') + PAGE_BREAK_STYLE;
  const pages = copies.map((copyText) => {
    const singleHtml = getPrintHTML(copyText, includeTerms);
    const bodyMatch = singleHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = (bodyMatch ? bodyMatch[1] : singleHtml).replace(/<script>[\s\S]*?<\/script>/gi, '');
    return "<div class=\"page-break\">" + body + "</div>";
  });
  return "<html><head>" + head + "</head>" + COPIES_BODY_OPEN + pages.join('');
}

export const printAWB = (selectedCopies = [""], includeTerms = true) => {
  const html = copiesHtml(copiesOrBlank(selectedCopies), includeTerms) + AUTO_PRINT_SCRIPT + "</body></html>";

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'absolute', width: '0', height: '0', border: 'none' });
  document.body.appendChild(iframe);

  const frameDocument = iframe.contentWindow.document;
  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  setTimeout(() => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 10000);
};

async function pdfErrorMessage(error) {
  if (!error.response) return error.message || String(error);
  try {
    const body = JSON.parse(await error.response.data.text());
    return body.error || 'Failed to generate PDF';
  } catch {
    return 'HTTP ERROR';
  }
}

function openAndDownloadPdf(pdf, fileName) {
  const url = URL.createObjectURL(pdf);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  downloadBlob(pdf, fileName);
}

export const downloadAWBPDF = async (selectedCopies = [""], includeTerms = true) => {
  const copies = copiesOrBlank(selectedCopies);
  const html = copiesHtml(copies, includeTerms) + "</body></html>";
  const { awbPrefix, awbSuffix } = readPrintData();
  const fileName = awbPrefix && awbSuffix ? `AWB_${awbPrefix}-${awbSuffix}.pdf` : 'Airway_Bill.pdf';

  try {
    showSuccessToast('Info', 'Generating PDF... Please wait.', false);
    const pdf = await freightApi.generateAwbPdf(html, fileName);
    openAndDownloadPdf(pdf, fileName);
    showSuccessToast('Success', 'PDF Downloaded Successfully!');
  } catch (error) {
    console.error(error);
    // Without the server PDF the print window still makes the same file ("Microsoft Print to PDF" / "Save as PDF").
    const reason = await pdfErrorMessage(error);
    showSuccessToast('Info', 'Server PDF not available (' + reason + '). Opening the print window - choose "Microsoft Print to PDF" or "Save as PDF".', false);
    printAWB(copies, includeTerms);
  }
};

const masterAwbNumber = (data) => data.awbPrefix + '-' + data.awbSuffix;
const xmlIssueDateTime = () => new Date().toISOString().split('.')[0];
const firstLineValue = (data, field, fallback) => (data.rateLines && data.rateLines[0] ? data.rateLines[0][field] : fallback);
const downloadXml = (xml, fileName) => downloadBlob(new Blob([xml], { type: 'application/xml' }), fileName);

export const handleDownloadManifest = (data) => {
  if (!data || !data.awbPrefix || !data.awbSuffix) return;

  const mawb = masterAwbNumber(data);
  const dest = data.destAirport || 'UNK';
  const pcs = firstLineValue(data, 'pieces', '0');
  const grossWt = firstLineValue(data, 'grossWeight', '0.00');
  const issueDate = xmlIssueDateTime();

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

  downloadXml(xml, `Manifest_${mawb}_XFZB.xml`);
};

export const handleDownloadXFWB = (data) => {
  if (!data || !data.awbPrefix || !data.awbSuffix) return;

  const mawb = masterAwbNumber(data);
  const dep = data.depAirport || 'UNK';
  const dest = data.destAirport || 'UNK';
  const pcs = firstLineValue(data, 'pieces', '0');
  const grossWt = firstLineValue(data, 'grossWeight', '0.00');
  const shipperName = data.parties?.Shipper?.name || '';
  const consigneeName = data.parties?.Consignee?.name || '';
  const issueDate = xmlIssueDateTime();

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

  downloadXml(xml, `AWB_${mawb}_XFWB.xml`);
};
