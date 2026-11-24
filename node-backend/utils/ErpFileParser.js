/**
 * ErpFileParser.js
 * Parses JSON / ICEGATE flat files → jobData / exportData
 */

// ─── HEURISTIC JSON → BE jobData MAPPING ──────────────────────────────────────
// description 1 + 2 of a filed BE: joined as they were split (at 60 raw characters = no space in between)
const joinDesc = (a, b) => { const x = String(a || ''), y = String(b || ''); if (!y) return x.trim(); return (x.length >= 60 ? x + y : x + ' ' + y).trim(); };

const BE_JSON_KEYS = {

  autoField_1:  ['customsLocation','location','portCode','port','customsPort','locCode'],
  autoField_2:  ['portCodeShort','portCode2'],
  autoField_3:  ['chaCode','chaDetails','chaLicNo','chaLicenseNumber','chaLicense'],
  autoField_4:  ['importerName','nameOfImporter','impExpName','importer','iecName','consigneeName'],
  autoField_5:  ['iecCode','importerExporterCode','iec','iecNo'],
  autoField_6:  ['address1','addr1','impExpAddress1','importerAddress1'],
  autoField_7:  ['address2','addr2','impExpAddress2','importerAddress2'],
  autoField_8:  ['city','impExpCity','importerCity'],
  autoField_9:  ['state','impExpState','importerState'],
  autoField_10: ['pin','pinCode','zip','impExpPin'],
  autoField_11: ['ctxState','taxState'],
  autoField_12: ['stateCode','taxStateCode'],
  autoField_13: ['registrationNo','gstin','gstNo','taxId'],
  autoField_15: ['igmDate','igmDt'],
  autoField_16: ['blDate','awbDate','billOfLadingDate'],
  autoField_18: ['igmNo','igmNumber'],
  autoField_19: ['blNo','awbNo','billOfLadingNo','blNumber','awbNumber'],
  autoField_20: ['countryOfOrigin','originCountry','coo'],
  autoField_21: ['countryOfConsignment','consignmentCountry'],
  autoField_22: ['portOfShipment','loadingPort','portOfLoading'],
  autoField_23: ['masterBlNo','masterBL'],
  autoField_24: ['vesselName','flightNo','vesselOrFlightNo','vessel','flight'],
  autoField_25: ['rotationNo','rotNo'],
  autoField_46: ['govtIec','governmentIec'],
  autoField_48: ['branchSrNo','branchSerialNo'],
  autoField_48: ['branchNo','branchNumber'],
  autoField_51: ['beType','billOfEntryType','boeType'],
  autoField_52: ['modeOfTransport','transportMode','shipmentMode'],
  autoField_53: ['importerType','impType'],
  autoField_55: ['greenChannel','greenChannelRequested'],
};

// ─── HEURISTIC JSON → SB exportData MAPPING ───────────────────────────────────
const SB_JSON_KEYS = {
  customsPort:  ['customsPort','portCode','port','location','locCode'],
  iecCode:      ['iecCode','importerExporterCode','iec'],
  shipperName:  ['shipperName','exporterName','impExpName','exporter'],
  address1:     ['address1','addr1','impExpAddress1'],
  address2:     ['address2','addr2','impExpAddress2'],
  city:         ['city','impExpCity'],
  state:        ['state','impExpState'],
  pin:          ['pin','pinCode','zip','impExpPin'],
  chaCode:      ['chaCode','chaLicenseNumber','chaDetails'],
  sbType:       ['sbType','shippingBillType'],
  shipmentMode: ['shipmentMode','modeOfTransport','transportMode'],
  autoField_6:  ['countryOfDestination','destCountry','destinationCountry'],
  autoField_7:  ['portOfDestination','destPort'],
  autoField_5:  ['portOfLoading','loadingPort'],
  autoField_22: ['vesselOrFlightNo','vesselName','flightNo','vessel'],
  autoField_23: ['vesselOrFlightDate','vesselDate','flightDate'],
  autoField_24: ['rotationNo','rotNo'],
  autoField_25: ['rotationDate','rotDate'],
  autoField_8:  ['stateOfOrigin','stateOrigin'],
  autoField_32: ['sbType','shippingBillType'],
};

const norm = k => k.toLowerCase().replace(/[_\s-]/g, '');

function findValue(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    const found = Object.keys(obj).find(k => norm(k) === norm(key));
    if (found && obj[found] !== undefined && obj[found] !== null && obj[found] !== '') return obj[found];
  }
  return undefined;
}


// Convert YYYYMMDD to YYYY-MM-DD for date input fields
function fmtDate(d) {
  if (!d || d.length !== 8) return d || '';
  return d.substring(0,4) + '-' + d.substring(4,6) + '-' + d.substring(6,8);
}
// ─── DETECT FORMAT ─────────────────────────────────────────────────────────────
function detectFormat(obj) {
  if (obj.headerField && obj.master) {
    if (obj.master.BEModel || obj.master.beModel) return 'CACHI01';
    if (obj.master.SBModel || obj.master.sbModel) return 'CACHE01';
  }
  if (obj.beType || obj.iecCode || obj.nameOfImporter) return 'BE_GENERIC';
  if (obj.sbType || obj.importerExporterCode || obj.impExpName) return 'SB_GENERIC';
  return 'UNKNOWN';
}

// ─── PARSE JSON → BE jobData ───────────────────────────────────────────────────
function parseJsonToBE(jsonObj) {
  const result = { jobData: {}, invoices: [], items: [], detectedFormat: '' };
  const fmt = detectFormat(jsonObj);
  result.detectedFormat = fmt;

  let src = jsonObj;
  let invArr = [];
  let itemArr = [];

  if (fmt === 'CACHI01') {
    const h = jsonObj.headerField || {};
    const m = jsonObj.master || {};
    const beArr = m.BEModel || m.beModel || [];
    const be = Array.isArray(beArr) ? (beArr[0] || {}) : beArr;
    src = { ...h, ...be };
    invArr  = m.invoiceModel || m.invoicemodel || [];
    itemArr = m.itemsModel   || m.itemsmodel   || [];

    
    
    // Dump EVERYTHING from all singular models into jobData first so no data is lost!
    const singleModels = ['beModel', 'igmModel', 'igmsModel', 'ctxModel', 'exchangeModel', 'permissionModel'];
    for (const mod of singleModels) {
       const arr = m[mod] || m[mod.toLowerCase()] || [];
       const obj = Array.isArray(arr) ? (arr[0] || {}) : arr;
       Object.assign(result.jobData, obj);
    }
    
    // Dump headerField too (for digital signatures etc)
    Object.assign(result.jobData, h);

    // Dump all other arrays into result._[arrayName]
    const arraysToKeep = ['supportingDocsModel', 'licenseModel', 'misc_chModel', 'rspModel', 'depbModel', 'bondModel', 'certModel', 'hssModel', 'reimportModel', 'amendModel', 'sw_ConstModel', 'sw_ProdModel', 'ctrlModel'];
    for (const arrName of arraysToKeep) {
       const arr = m[arrName] || m[arrName.toLowerCase()] || [];
       if (arr.length > 0) {
          result['_' + arrName] = arr;
       }
    }

    // Bond / certificate / high-sea-sale rows -> the header screen's own fields; control + e-Sanchit rows kept
    // in ICEGATE form on the job so the BE JSON sends them back unchanged. 28-Oct-2026
    const mArr = (k) => { const a = m[k] || m[k.toLowerCase()] || []; return Array.isArray(a) ? a : [a]; };
    if (mArr('bondModel').length) result.jobData._bondRows = mArr('bondModel').map((b, i) => ({ id: Date.now() + i, bondNo: b.bondNumber || '', bondCode: b.bondCode || '', bondPort: b.bondPort || '' }));
    // every certificate row goes to the Job Header certificate grid (only the first one was kept). 28-Oct-2026
    const certs = mArr('certModel');
    if (certs.length) { result.jobData._certRows = certs.map((c, i) => ({ id: Date.now() + i, certNo: c.certificateNumber || '', certDate: fmtDate(c.certificationDate) || '', certType: c.certificationType || '' })); result.jobData.certificate = 'Y'; }
    if (mArr('hssModel').length) result.jobData._hssRows = mArr('hssModel').map((r, i) => ({ id: Date.now() + i, importerName: r.importerName || '', iecNo: r.iec || '', branchSrNo: r.branchSrNo || '',
      address1: r.importerAddress1 || '', address2: r.importerAddress2 || '', city: r.importerCity || '', pin: r.importerPin || '', precedingLevel: 'Level- ' + (r.precedingLevel || '0') }));
    ['supportingDocsModel', 'ctrlModel', 'sw_ConstModel', 'sw_ProdModel'].forEach(k => { if (mArr(k).length) result.jobData['_' + k] = mArr(k); });
    
    // ---------- beModel


    if (be.customHouseCode)          { result.jobData.autoField_2  = be.customHouseCode; result.jobData.portCode = be.customHouseCode; }
    if (be.chaCode)                  result.jobData.autoField_3  = be.chaCode;
    // 30-Oct-2026: autoField_40-45 are the HIGH SEA SELLER boxes - the importer is never the seller, so they are no
    // longer pre-filled from the importer (one click on "Add" filed the importer as its own HSS seller)
    if (be.nameOfImporter)           result.jobData.autoField_4  = be.nameOfImporter;
    if (be.iecCode)                  result.jobData.autoField_5  = be.iecCode;
    if (be.address1)                 result.jobData.autoField_6  = be.address1;
    if (be.address2)                 result.jobData.autoField_7  = be.address2;
    if (be.city)                     result.jobData.autoField_8  = be.city;
    if (be.state) {                  result.jobData.autoField_9  = be.state; result.jobData.autoField_11 = be.state; }
    if (be.pin)                      result.jobData.autoField_10 = be.pin;
    if (be.beType)                   result.jobData.autoField_51 = be.beType;
    if (be.modeOfTransport)          { result.jobData.autoField_52 = be.modeOfTransport; result.jobData.trans = be.modeOfTransport; }
    if (be.countryOfOrigin)          { result.jobData.autoField_20 = be.countryOfOrigin; result.jobData.countryOfOrigin = be.countryOfOrigin; }
    if (be.countryOfConsignment)     { result.jobData.autoField_21 = be.countryOfConsignment; result.jobData.countryOfConsignment = be.countryOfConsignment; }
    if (be.portOfShipment)           { result.jobData.autoField_22 = be.portOfShipment; result.jobData.portOfOrigin = be.portOfShipment; }
    // screen keys too (Job Header shows greenChannel / importerType / paymentMethodCode). 28-Oct-2026
    if (be.greenChannelRequested)    { result.jobData.autoField_55 = be.greenChannelRequested; result.jobData.greenChannel = be.greenChannelRequested; }
    if (be.importerType)             { result.jobData.autoField_53 = be.importerType; result.jobData.importerType = be.importerType; }
    if (be.branchSrNo)               result.jobData.autoField_48 = be.branchSrNo;
    if (be.portOfOrigin)             result.jobData.portOfOrigin = be.portOfOrigin;
    if (be.paymentMethodCode)        { result.jobData.paymentMethod = be.paymentMethodCode; result.jobData.paymentMethodCode = be.paymentMethodCode; }
    if (be.uniqueConsignmentReferenceNo) result.jobData.ucr = be.uniqueConsignmentReferenceNo;
    if (be.ucrType)                  result.jobData.ucrType = be.ucrType;
    if (be.warehouseCode)            result.jobData.warehouseCode = be.warehouseCode;
    if (be.warehouseBENo)            result.jobData.warehouseBENo = be.warehouseBENo;
    if (be.warehouseBEDate)          result.jobData.warehouseBEDate = fmtDate(be.warehouseBEDate);
    if (be.warehouseCustomSiteId)    result.jobData.warehouseCustomSiteId = be.warehouseCustomSiteId;
    if (be.beClass)                  result.jobData.beClass = be.beClass;
    // Flags
    if (be.highSeaSaleFlag)          result.jobData.highSeaSaleFlag = be.highSeaSaleFlag;
    if (be.kachchaBE)                result.jobData.kachchaBE = be.kachchaBE;
    if (be.whetherPriorBE)           result.jobData.whetherPriorBE = be.whetherPriorBE;
    if (be.firstCheckRequested)      result.jobData.firstCheckRequested = be.firstCheckRequested;
    if (be.section48Requested)       result.jobData.section48Requested = be.section48Requested;
    if (be.authorizedEconomicDealerCode) result.jobData.aeoCode = be.authorizedEconomicDealerCode;
    // Packages / weight from beModel (fallback if igmsModel is empty)
    if (be.noOfPackagesReleased)     result.jobData.totalPkg = be.noOfPackagesReleased;
    if (be.packageCode)              result.jobData.pkg = be.packageCode;
    if (be.grossWeight)              result.jobData.grossWt = be.grossWeight;
    if (be.unitOfMeasurement)        result.jobData.grossWtUnit = be.unitOfMeasurement;

    // ---------- igmsModel → jobData (IGM / shipment details) ----------
    const igmArr = m.igmsModel || m.igmModel || m.igmmodel || [];
    
    // Create _igmRows for the grid
    result.jobData._igmRows = [];
    // ICD: gateway IGM of the first row (Job Header "ICD Specification")
    const g0 = (Array.isArray(igmArr) && igmArr[0]) || {};
    if (g0.gatewayIgmNo)    result.jobData.gatewayIgmNo = g0.gatewayIgmNo;
    if (g0.gatewayIgmDate)  result.jobData.gatewayIgmDate = fmtDate(g0.gatewayIgmDate);
    if (g0.gatewayPortCode) result.jobData.gatewayPortCode = g0.gatewayPortCode;
    // 20-Nov-2026: an ICD BE filed as mode L (Land) with a gateway IGM or containers is sea cargo moved inland - iCAFFE
    // files its sea jobs at an ICD that way (7675, INTKD6). It opens as a Sea job, so the Job Header shows the ICD box
    // and the containers; the BE file is made with L again for the ICD.
    { const ch = String(be.customHouseCode || (result.jobData && result.jobData.portCode) || '').trim().toUpperCase();
      const conts = m.containerModel || m.containermodel || [];
      if (String(be.modeOfTransport || '').trim().toUpperCase() === 'L' && /^IN[A-Z0-9]{3}6$/.test(ch) && (g0.gatewayIgmNo || (Array.isArray(conts) && conts.length))) {
        result.jobData.autoField_52 = 'S'; result.jobData.trans = 'S';
      } }
    if (Array.isArray(igmArr)) {
      igmArr.forEach((igmItem, idx) => {
         result.jobData._igmRows.push({
            id: Date.now() + idx,
            igmNo: igmItem.igmNumber || '',
            igmDate: fmtDate(igmItem.igmDate) || '',
            mawbNo: igmItem.mawbNo || '',
            mawbDate: fmtDate(igmItem.mawbDate) || '',
            hawbNo: igmItem.hawbNo || '',
            hawbDate: fmtDate(igmItem.hawbDate) || '',
            inwardDate: fmtDate(igmItem.inwardDate) || '',
            totalPkg: igmItem.totalNoOfPackages || '',
            pkgCode: igmItem.packageCode || '',
            grossWt: igmItem.grossWeight || '',
            wtUnit: igmItem.unitQuantityCode || '',
            marks1: igmItem.marksAndNumbers1 || '',
            marks2: igmItem.marksAndNumbers2 || '',
            marks3: igmItem.marksAndNumbers3 || '',
            lineNo: igmItem.lineNo || igmItem.lineNumber || ''
         });
      });
    }

    // Scalar fields intentionally left blank so they do not duplicate _igmRows into the ADD form
    

    // ---------- ctxModel → jobData (CTX / GST state details) ----------
    const ctxArr = m.ctxModel || m.ctxmodel || [];
    const ctx = Array.isArray(ctxArr) ? (ctxArr[0] || {}) : ctxArr;
    if (ctx.stateCode)               result.jobData.autoField_12 = ctx.stateCode;
    if (ctx.commercialTaxType)       { result.jobData.autoField_50 = (ctx.commercialTaxType === 'GSTN' || ctx.commercialTaxType === 'GSTIN') ? 'GSTIN' : ctx.commercialTaxType; }
    if (ctx.commercialTaxRegistrationNo) result.jobData.autoField_13 = ctx.commercialTaxRegistrationNo;

    // ---------- headerField → jobData ----------
    if (h.jobNumber)                 result.jobData._jobNo  = String(h.jobNumber);
    if (h.jobDate)                   result.jobData._jobDate = h.jobDate;

    // ---------- invoiceModel → invoices ----------
    result.invoices = invArr.map((inv, _i) => ({ ...inv,
      id: Date.now() + Math.floor(Math.random()*10000) + _i,
      // 30-Oct-2026: the serial number is not an invoice number - a file without actualInvoiceNumber gives a blank
      // Invoice No (the save then says which invoice to fill in) instead of an invented "1"
      invoiceNo:       inv.actualInvoiceNumber || inv.invoiceNo || '',
      invNo:           inv.actualInvoiceNumber || inv.invoiceNo || '',
      invoiceDate:     fmtDate(inv.invoiceDate) || '',
      invDate:         fmtDate(inv.invoiceDate) || '',
      currency:        inv.invoiceCurrency || inv.currency || '',
      value:           parseFloat(inv.invoiceValue || inv.value) || 0,
      invValue:        parseFloat(inv.invoiceValue || inv.value) || 0,
      supplierName:    inv.supplierName || inv.supplier_name || inv.buyerName || '',
      supplierAddress1: inv.supplierAddress1 || '',
      supplierAddress2: inv.supplierAddress2 || '',
      supplierCountry: inv.supplierCountryName || '',
      terms:           inv.termsOfInvoice || inv.terms || '',
      termsPlace:      inv.termsPlace || '',
      paymentTerms:    inv.paymentTerms || '',
      natureOfTransaction: inv.natureOfTransaction || '',
      freightValue:    inv.freightValue || '',
      freightCurrency: inv.freightCurrency || '',
      freightRate:     inv.freightRate || '',
      whetherFreightActual: inv.whetherFreightActual || '',
      insuranceValue:  inv.insuranceValue || '',
      insuranceCurrency: inv.insuranceCurrency || '',
      insuranceRate:   inv.insuranceRate || '',
      miscCharges:     inv.miscCharges || '',
      miscCurrency:    inv.miscCurrency || '',
      discountRate:    inv.discountRate || '',
      discountAmount:  inv.discountAmount || '',
      valuationMethod: inv.valuationMethodApplicable || '',
      buyerSellerRelated: inv.whetherBuyerAndSellerAreRelated || '',
      purchaseOrderNo: inv.purchaseOrderNumber || '',
      purchaseOrderDate: inv.purchaseOrderDate || '',
      contractNo:      inv.contractNumber || '',
      lcNo:            inv.lcNumber || '',
      lcDate:          inv.lcDate || '',
    }));

    // ---------- itemsModel → items ----------
    result.items = itemArr.map((item, _i) => ({
      id: Date.now() + Math.floor(Math.random()*10000) + _i,
      invoiceSrNo:     Number(item.invoiceSerialNumber || item.invoiceSrNo) || 1,
      invSrNo:         String(item.invoiceSerialNumber || item.invoiceSrNo || '1'),
      srNo:            Number(item.itemSerialNumber || item.itemNo || item.srNo) || 0,
      itemSrNo:        String(item.itemSerialNumber || item.srNo || '1'),
      hsnCode:         item.ritcCode || item.hsnCode || item.ritc || '',
      ritc:            item.ritcCode || item.hsnCode || item.ritc || '',
      // a filed BE splits the text at 60 raw characters ("...PHONE MO" + "DEL NOVA 2 PRO)") - join without a space then (29-Oct-2026)
      description:     joinDesc(item.itemDescription1, item.itemDescription2) || item.description || '',
      desc:            joinDesc(item.itemDescription1, item.itemDescription2) || item.description || '',
      genericDesc:     item.genericDescriptionOfTheItem || '',
      quantity:        parseFloat(item.quantity || item.qty) || 0,
      qty:             String(parseFloat(item.quantity || item.qty) || 0),
      unit:            item.unitQuantityCode || item.unit || item.uqc || 'NOS',
      unitPrice:       parseFloat(item.unitPriceInvoiced || item.unitPrice) || 0,
      price:           String(parseFloat(item.unitPriceInvoiced || item.unitPrice) || 0),
      manufacturer:    item.manufacturerName || '',
      brandName:       item.brandName || '',
      model:           item.model || '',
      endUse:          item.endUseOfItem || '',
      countryOfOrigin: item.countryOfOrigin || '',
      itemManufacturerAddress1: item.itemManufacturerAddress1 || '',
      itemManufacturerAddress2: item.itemManufacturerAddress2 || '',
      itemManufacturerCountry: item.itemManufacturerCntry || '',
      preferentialStandard: item.preferentialStandard || '',
      rspApplicability: item.rspApplicability || 'N',
      whetherReimport: item.whetherReimport || 'N',
      assessableValue: parseFloat(item.assessableValue || item.value || item.fobValue) || 0,
      // item total = qty x unit price (it was set to the unit price, so values / duty came out tiny). 28-Oct-2026
      value:           (() => { const q = parseFloat(item.quantity || item.qty) || 0, p = parseFloat(item.unitPriceInvoiced || item.unitPrice) || 0; return q && p ? (q * p).toFixed(2) : String(parseFloat(item.assessableValue || 0) || ''); })(),
      foc:             'N',
      itemCategory:    item.itemCategory || '',
      accessories:     item.accessoriesForTheItem || '',
      sourceCountry:   item.sourceCountry || '',
      transitCountry:  item.transitCountry || '',
      // notifications + other item fields (were not read: re-sending an imported BE lost them). 28-Oct-2026
      bcdNotificationNo: item.bcdNotification || '', bcdSrNo: item.bcdNotificationSrNo || '',
      cvdNotificationNo: item.cvdNotification || '', cvdSrNo: item.cvdNotificationSrNo || '',
      swsNotificationNo: item.socialWelfareNotn || '', swsSrNo: item.socialWelfareNotnSlno || '',
      saptaNotificationNo: item.saptaNotn || '', saptaSrNo: item.saptaSerialNumber || '',
      healthCessNotificationNo: item.healthNotn || '', healthCessSrNo: item.healthSrNo || '',
      adlCvdNotificationNo: item.additionalCvdNotn || '', adlCvdSrNo: item.additionalCvdSrNo || '',
      ...Object.fromEntries(['additionalNotification1', 'additionalNotification1SrNo', 'additionalNotification2', 'additionalNotification2SrNo', 'otherNotification', 'otherNotificationSrNo',
        'cusEducessNotfnNumber', 'cusEducessNotfnSrNo', 'ncdNotn', 'ncdNotnSrNo', 'antiDumpingDutyNotification', 'antiDumpingDutySerialNumber', 'cthSerialNumber', 'supplierSerialNumber',
        'quantityAsPerAntiDumpingNotn', 'tariffValueNotn', 'tariffValueItemSerialNumber', 'quantityAsPerTariffValueNotn', 'aggregateDutyNotn', 'aggregateDutyNotnSrNo', 'safeguardDutyNotn',
        'safeguardDutyNotnSrNo', 'discountRate', 'discountAmount', 'quantityAsPerCth', 'cthQty', 'svbReferenceNumber', 'svbReferenceDate', 'svbLoadAssessableValue', 'svbLoadOnDuty', 'svbFlag',
        'whetherLoadProvisionalOnAssessableValue', 'whetherLoadProvisionalOnDuty', 'customHouseCodeWhichHasImposedLoad', 'policyParaNo', 'policyYear', 'previousBeNo', 'previousBeDate',
        'prevUnitPriceInvoiced', 'prevCurrencyCode', 'prevCustomSite', 'customsFlag', 'itemManufacturerType', 'itemManufacturerCode', 'itemManufacturerCity', 'itemManufacturerSubdivision',
        'itemManufacturerPin', 'cth', 'ceth', 'accessoryStatus'].filter(k => item[k] !== undefined && item[k] !== '').map(k => [k, item[k]])),
    }));

    // ---------- exchangeModel → result.exchangeRates ----------
    const excArr = m.exchangeModel || m.exchangemodel || [];
    result.exchangeRates = excArr.map(e => ({
      currencyCode: e.currencyCode || '',
      rate:         parseFloat(e.rate) || 0,
      unitInRs:     parseFloat(e.unitInRs) || 1,
      effectiveDate: fmtDate(e.effectiveDate) || '',
    }));

    
    // ---------- containerModel -> jobData.containers ----------
    const contArr = m.containerModel || m.containermodel || [];
    if (contArr.length > 0) {
        result.jobData.containers = contArr.map((c, _i) => ({
            ...c,
            id: Date.now() + Math.floor(Math.random()*10000) + _i,
            // schema names are contNumber / lclfcl / sealNumber / truckNumber (29-Oct-2026: the container no of a read
            // file was lost - two filed sea / land BEs came back without it)
            contNo: c.contNumber || c.containerNumber || '',
            sealNo: c.sealNumber || '',
            truckNo: c.truckNumber || '',
            lclFcl: (() => { const v = String(c.lclfcl || c.fclLclCode || '').toUpperCase().slice(0, 1); return v === 'F' ? 'FCL' : v === 'L' ? 'LCL' : ''; })(),
            contSize: c.containerSize || '',
            contType: c.containerType || '',
            igmNo: c.igmNumber || '',
            igmDate: c.igmDate || ''
        }));
    }

    // ---------- sbedutyModel 
 
    const dutyArr = m.sbedutyModel || m.sbedutymodel || [];
    result.duties = dutyArr.map(d => ({
      invoiceSrNo:    d.invoiceSerialNumber || '1',
      itemSrNo:       d.itemSerialNumber || '1',
      notificationNo: d.notificationNo || '',
      notificationSrNo: d.notificationSrNo || '',
      dutyType:       d.dutyType || '',
      addlDutyFlag:   d.addlDutyFlag || '',
      exmpNotificationNo: d.exmpNotificationNo || '',
      exmpNotificationSrNo: d.exmpNotificationSrNo || '',
      customsNotnExemptingIgstFlag: d.customsNotnExemptingIgstFlag || '',
    }));

    // ---------- infoTypeModel → result.infoTypes ----------
    const infoArr = m.infoTypeModel || m.infotypemodel || [];
    result.infoTypes = infoArr.map(i => ({
      invoiceSrNo:  i.invoiceSerialNumber || '1',
      itemSrNo:     i.itemSerialNumber || '1',
      infoType:     i.infoType || '',
      infoQualifier: i.infoQualifier || '',
      infoCode:     i.infoCode || '',
      infoText:     i.infoText || '',
      infoMsr:      i.infoMsr || '',
      infoUqc:      i.infoUqc || '',
    }));

    // permission rows, re-import rows (to their item) and the duty / exchange / info / statement rows on the job itself
    // (the job screen copied the last four, a direct save / re-send lost them; permission and re-import were dropped). 29-Oct-2026
    if (mArr('permissionModel').length) result.jobData._permissionRows = mArr('permissionModel').map(p => ({ permissionCode: p.permissionCode || '', reasonsForRequest: p.reasonsForRequest || '' }));
    for (const r of mArr('reimportModel')) {
      const it = result.items.find(x => String(x.invSrNo) === String(r.invoiceSerialNumber || '1') && String(x.itemSrNo) === String(r.itemSerialNumber || '1'));
      if (!it) continue;
      it.reimportData = { type: 'Y', shippingBillNo: r.shippingBillNo || '', shippingBillDate: fmtDate(r.shippingBillDate) || '', portOfExport: r.portOfExport || '',
        invoiceNoSb: r.invoiceNoSb || '', itemNoSb: r.itemNoSb || '', notificationNo: r.notificationNo || '', notificationSrNo: r.notificationSrNo || '',
        exportFreight: r.exportFreight || '', exportInsurance: r.exportInsurance || '', customsDuty: r.customsDuty || '', exciseDuty: r.exciseDuty || '' };
      it.whetherReimport = 'Y';
    }

    // licence debit rows -> the item's Licence window (licenceData); DEPB rows (duty exemption under a scrip, e.g. RoDTEP) -> item.depbData. 29-Oct-2026
    for (const r of mArr('licenseModel')) {
      const it = result.items.find(x => String(x.invSrNo) === String(r.invoiceSerialNumber || '1') && String(x.itemSrNo) === String(r.itemSerialNumberInvoice || '1'));
      if (!it) continue;
      (it.licenceData = Array.isArray(it.licenceData) ? it.licenceData : []).push({ id: Date.now() + it.licenceData.length, licenceNo: r.licenseRegistrationNumber || '', licenceDate: fmtDate(r.licenseRegistrationDate) || '',
        licenceCode: r.licenseCode || '', regnPort: r.licenseRegnPort || '', itemSrNoLicence: r.itemSrNoLicense || '', debitValue: r.debitValue || '', debitQty: r.debitQuantity || '', debitUqc: r.debitUnitOfMeasurement || '' });
      it.licenceFlag = 'Y';
    }
    for (const r of mArr('depbModel')) {
      const it = result.items.find(x => String(x.invSrNo) === String(r.invoiceSerialNumber || '1') && String(x.itemSrNo) === String(r.itemSerialNumberInvoice || '1'));
      if (!it) continue;
      (it.depbData = Array.isArray(it.depbData) ? it.depbData : []).push({ whetherExemption: r.whetherExemption || 'Y', bcdNotification: r.bcdNotification || '', bcdNotificationSrNo: r.bcdNotificationSrNo || '' });
    }

    // ---------- statementModel → result.statements ----------
    const stmtArr = m.statementModel || m.statementmodel || [];
    result.statements = stmtArr.map(s => ({
      invoiceSrNo:    s.invoiceSerialNumber || '0',
      itemSrNo:       s.itemSerialNumber || '0',
      statementType:  s.statementType || '',
      statementCode:  s.statementCode || '',
      statementText:  s.statementText || '',
      declarationType: s.declarationtype || '',
    }));
    if (result.duties.length) result.jobData._duties = result.duties;
    if (result.exchangeRates.length) result.jobData._exchangeRates = result.exchangeRates;
    if (result.infoTypes.length) result.jobData._infoTypes = result.infoTypes;
    if (result.statements.length) result.jobData._statements = result.statements;

    return result;
  } else if (fmt === 'BE_GENERIC') {
    src = jsonObj;
    invArr  = jsonObj.invoices || jsonObj.invoiceModel || [];
    itemArr = jsonObj.items    || jsonObj.itemsModel   || [];
  } else {
    src = jsonObj;
    invArr  = jsonObj.invoices || [];
    itemArr = jsonObj.items    || [];
  }

  for (const [field, keys] of Object.entries(BE_JSON_KEYS)) {
    const val = findValue(src, keys);
    if (val !== undefined) result.jobData[field] = String(val).trim();
  }

  result.invoices = invArr.map((inv, _i) => ({
      id: Date.now() + Math.floor(Math.random()*10000) + _i,
    invoiceNo:   inv.invoiceNo   || inv.invoice_no  || inv.InvoiceNo  || '',
    invoiceDate: inv.invoiceDate || inv.invoice_date || inv.InvoiceDate|| '',
    currency:    inv.invoiceCurrency || inv.currency || 'USD',
    value:       inv.invoiceValue    || inv.value    || 0,
    quantity:    inv.invoiceQuantity || inv.quantity || 0,
    uqc:         inv.invoiceUqc || inv.uqc || 'NOS',
  }));

  result.items = itemArr.map((item, _i) => ({
      id: Date.now() + Math.floor(Math.random()*10000) + _i,
    hsnCode:         item.hsnCode     || item.hsn_code    || '',
    description:     item.description || item.itemDescription || item.commodityDescription || '',
    quantity:        item.quantity    || item.qty          || 0,
    unit:            item.unit        || item.uqc          || 'NOS',
    assessableValue: item.assessableValue || item.value   || item.fobValue || 0,
    invoiceSrNo:     item.invoiceSrNo || 1,
  }));

  return result;
}

// ─── PARSE JSON → SB exportData ───────────────────────────────────────────────
function legacyParseJsonToSB(jsonObj) {
  const result = { exportData: {}, invoices: [], items: [], detectedFormat: '' };
  const fmt = detectFormat(jsonObj);
  result.detectedFormat = fmt;

  let src = jsonObj;
  let invArr = [];
  let itemArr = [];

  if (fmt === 'CACHE01') {
    const h = jsonObj.headerField || {};
    const m = jsonObj.master || {};
    const sb = m.SBModel || m.sbModel || {};
    src = { ...h, ...sb };
    invArr  = m.invoiceModel || [];
    itemArr = m.itemsModel   || [];
  } else {
    src = jsonObj;
    invArr  = jsonObj.invoices || jsonObj.invoiceModel || [];
    itemArr = jsonObj.items    || jsonObj.itemsModel   || [];
  }

  for (const [field, keys] of Object.entries(SB_JSON_KEYS)) {
    const val = findValue(src, keys);
    if (val !== undefined) result.exportData[field] = String(val).trim();
  }

  result.invoices = invArr.map((inv, _i) => ({
      id: Date.now() + Math.floor(Math.random()*10000) + _i,
    invoiceNo:   inv.invoiceNo   || inv.invoice_no || inv.actualInvoiceNumber || inv.invoiceSerialNumber || '',
    invoiceDate: inv.invoiceDate || inv.invoice_date || '',
    currency:    inv.invoiceCurrency || inv.currency || 'USD',
    value:       parseFloat(inv.invoiceValue || inv.value) || 0,
    quantity:    parseFloat(inv.invoiceQuantity || inv.quantity) || 0,
    uqc:         inv.invoiceUqc || inv.uqc || 'NOS',
    terms:       inv.terms || inv.termsOfInvoice || '',
    supplierName:inv.buyerName || inv.supplierName || inv.supplier_name || '',
  }));

  result.items = itemArr.map((item, _i) => ({
      id: Date.now() + Math.floor(Math.random()*10000) + _i,
    hsnCode:     item.hsnCode     || item.hsn_code || item.ritcCode || item.ritc || '',
    description: item.description || item.itemDescription || ((item.itemDescription1||'') + ' ' + (item.itemDescription2||'')).trim() || '',
    quantity:    parseFloat(item.quantity || item.qty) || 0,
    unit:        item.unit        || item.uqc || item.unitQuantityCode || 'NOS',
    fobValue:    parseFloat(item.fobValue || item.assessableValue || item.value) || 0,
    invoiceSrNo: Number(item.invoiceSrNo || item.invoiceSerialNumber) || 1,
    srNo:        Number(item.itemSerialNumber || item.itemNo || item.srNo) || 0,
  }));

  return result;
}

// ─── ICEGATE ICES 1.5 FLAT FILE PARSER (.BE) ──────────────────────────────────
// Confirmed from 5650.be analysis:
// HREC: F[2]=SenderID, F[4]=Port, F[7]=BEType, F[8]=MessageType, F[9]=SeqNo, F[10]=Date
// BE:   F[2]=JobNo, F[3]=JobDate, F[6]=BEType(X=ExBond/H=Home/W=WH), F[7]=IEC
//       F[8]=BranchSrNo, F[9]=ImporterName, F[10]=Addr1, F[11]=Addr2
//       F[12]=City, F[13]=State, F[14]=Pin, F[15]=BEClass(P=Provisional)
//       F[16]=Mode(A=Air/S=Sea/L=Land), F[19]=HighSeaSaleFlag
//       F[20]=PortOfOrigin, F[21]=CHA, F[22]=COO, F[23]=COC, F[24]=PortOfShipment
//       F[30]=WarehouseCode, F[31]=WHCustomsCode, F[32]=WHBENo, F[33]=WHBEDate
//       F[36]=GrossWeight, F[37]=WeightUnit
// ICES 1.5 BE flat file -> the same result as a CACHI01 JSON (29-Oct-2026). The layout is the JSON schema order (see
// beFlatFile.js, checked against production .be files); before, INVOICE / ITEMS were read from wrong columns (invoice no
// from the date column, RITC from the UQC column, quantity from the RITC ...) and every other table was skipped.
function parseFlatFileToBE(text) {
  const { readBeFlat } = require('./beFlatFile');
  const cj = readBeFlat(text);
  if (/_A$/.test(String((cj.headerField || {}).messageID || ''))) throw new Error('This is a BE amendment file (CACHI01_A), not a Bill of Entry - it cannot be read into a job');
  if (cj.master && cj.master.beModel && cj.master.beModel.length) {
    const r = parseJsonToBE(cj);
    r.detectedFormat = 'ICES1_5_BE';
    if (cj.unknownTables && cj.unknownTables.length) r.unknownTables = cj.unknownTables;
    return r;
  }
  return legacyParseFlatFileToBE(text);
}
function legacyParseFlatFileToBE(text) {
  const GS   = '\x1d';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const jobData    = {};
  const invoices   = [];
  const items      = [];
  let currentTable = '';

  const f = (p, i) => (p[i] || '').replace(/&AMP;/gi, '&').trim();
  const fmtD = d => (!d || d.length !== 8) ? (d || '') : `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;

    if (line.startsWith('<TABLE>')) {
      currentTable = line.replace('<TABLE>', '').trim().toUpperCase();
      continue;
    }

    const parts = line.split(GS);

    // HREC
    if (line.startsWith('HREC')) {
      jobData.autoField_2 = f(parts, 4); jobData.portCode = f(parts, 4); // INDEL4 - customs port
      jobData._seqNo      = f(parts, 9);  // sequence number
      jobData._fileDate   = fmtD(f(parts, 10));
      continue;
    }

    if (!line.startsWith('F')) continue;

    switch (currentTable) {
      case 'BE':
        jobData._jobNo       = f(parts, 2);  // 5650
        jobData._jobDate     = fmtD(f(parts, 3)); // 20260826
        jobData.autoField_51 = f(parts, 6);  // BEType: X=ExBond, H=Home, W=Warehousing
        jobData.autoField_5  = f(parts, 7);  // IEC Code
        jobData.autoField_48 = f(parts, 8);  // Branch Sr No
        jobData.autoField_4  = f(parts, 9);  // Importer Name
        jobData.autoField_6  = f(parts, 10); // Address 1
        jobData.autoField_7  = f(parts, 11); // Address 2
        jobData.autoField_8  = f(parts, 12); // City
        jobData.autoField_9  = f(parts, 13); // State
        jobData.autoField_10 = f(parts, 14); // Pin
        // Mode: A=Air, S=Sea, L=Land
        { const modeMapBE = { A:'AIR', S:'SEA', L:'LAND' };
          jobData.autoField_52 = modeMapBE[f(parts,16)] || f(parts,16); }
        jobData.autoField_3  = f(parts, 21); // CHA Code
        jobData.autoField_20 = f(parts, 22); // Country of Origin
        jobData.autoField_21 = f(parts, 23); // Country of Consignment
        jobData.autoField_22 = f(parts, 24); // Port of Shipment
        // Job Header boxes (28-Oct-2026): the warehouse code / WH BE No went into autoField_18 / 19, which are the
        // "Bulk shipment" and ICD gateway date boxes; importer / country / port also into the named keys the screen shows
        jobData.warehouseCode   = f(parts, 30);
        jobData.warehouseCustomSiteId = f(parts, 31);
        jobData.warehouseBENo   = f(parts, 32);
        jobData.warehouseBEDate = fmtD(f(parts, 33));
        if (f(parts, 36)) { jobData.grossWt = f(parts, 36); jobData.grossWtUnit = f(parts, 37); }
        Object.assign(jobData, { nameOfImporter: jobData.autoField_4, iecCode: jobData.autoField_5, branchSrNo: jobData.autoField_48, address1: jobData.autoField_6, address2: jobData.autoField_7,
          city: jobData.autoField_8, state: jobData.autoField_9, pin: jobData.autoField_10, chaCode: jobData.autoField_3, countryOfOrigin: jobData.autoField_20,
          countryOfConsignment: jobData.autoField_21, portOfOrigin: jobData.autoField_22, userJobNo: jobData._jobNo, jobDate: jobData._jobDate });
        if (f(parts, 19)) jobData.highSeaSaleFlag = f(parts, 19);
        break;
      case 'INVOICE':
        // screen keys too (invNo / invDate / ...): the Invoice tab showed these invoices empty. 28-Oct-2026
        invoices.push({
          srNo:        Number(f(parts,6)) || (invoices.length+1),
          invoiceNo:   f(parts,7), invNo: f(parts,7),
          invoiceDate: fmtD(f(parts,8)), invDate: fmtD(f(parts,8)),
          currency:    f(parts,9),
          terms:       f(parts,10),
          value:       parseFloat(f(parts,17)) || 0,
          supplierName: f(parts,11),
          supplierCountry: f(parts,14),
        });
        break;
      case 'ITEMS': {
        const qty = parseFloat(f(parts,14)) || 0, val = parseFloat(f(parts,18)) || 0;
        const desc = (f(parts,10)+' '+f(parts,11)).trim();
        items.push({
          invoiceSrNo:     Number(f(parts,6)) || 1, invSrNo: String(Number(f(parts,6)) || 1),
          srNo:            Number(f(parts,7)) || (items.length+1), itemSrNo: String(Number(f(parts,7)) || (items.length+1)),
          hsnCode:         f(parts,9), ritc: f(parts,9), cth: f(parts,9),
          description:     desc, desc,
          uqc:             f(parts,13), unit: f(parts,13),
          quantity:        qty, qty: String(qty),
          price:           qty ? String(+(val / qty).toFixed(6)) : '',
          assessableValue: val, value: String(val),
        });
        break; }
      default: break;
    }
  }

  return { jobData, invoices, items, detectedFormat: 'ICES1_5_BE' };
}

// ─── ICEGATE ICES 1.5 FLAT FILE PARSER (.SB) ─────────────────────────────────
// Field separator: \x1D (ASCII 29 Group Separator) — confirmed from 19129.sb
// HREC:    F[2]=SenderID, F[4]=Port, F[6]=Indicator, F[8]=MessageType, F[9]=JobNo, F[10]=Date
// SB:      F[6]=CHA, F[7]=IEC, F[9]=ExporterName, F[10-11]=Addr, F[12]=City
//          F[13]=State, F[14]=Pin, F[15]=SBType(F/P), F[16]=Mode(P=Air/S=Sea/L=Land)
//          F[29]=CustomsPort, F[30]=LoadingPort, F[31]=DestCountry, F[33]=DestPort
//          F[20]=ConsigneeName, F[25]=ConsigneeCountry, F[48]=GSTType, F[49]=GSTIN
// INVOICE: F[6]=SrNo, F[7]=InvNo, F[8]=Date(YYYYMMDD), F[9]=Currency, F[10]=Terms(CIF/FOB)
//          F[11]=BuyerName, F[14]=BuyerCountry, F[17]=InvValue(FCY), F[20]=Freight
// ITEM:    F[6]=InvSrNo, F[7]=ItemSrNo, F[9]=HSN, F[10+11]=Description
//          F[13]=UQC, F[14]=Qty, F[15]=Rate(FCY), F[18]=FOBValue(INR)
//          F[36]=ExportScheme(GNX100=RODTEP), F[39]=BondType(LUT/Bond)
function legacyParseFlatFileToSB(text) {
  const GS   = '\x1d';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const exportData = {};
  const invoices   = [];
  const items      = [];
  let currentTable = '';
  let jobNo = '';

  const f = (p, i) => (p[i] || '').replace(/&AMP;/gi, '&').trim();
  const fmtD = d => (!d || d.length !== 8) ? (d || '') : `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;

    if (line.startsWith('<TABLE>')) {
      currentTable = line.replace('<TABLE>', '').trim().toUpperCase();
      continue;
    }

    const parts = line.split(GS);

    // HREC
    if (line.startsWith('HREC')) {
      exportData._senderId    = f(parts, 2);
      exportData.customsPort  = f(parts, 4);
      exportData._indicator   = f(parts, 6);
      exportData._messageType = f(parts, 8);
      jobNo                   = f(parts, 9);
      exportData.jobNo        = jobNo;
      exportData._jobDate     = fmtD(f(parts, 10));
      continue;
    }

    if (!line.startsWith('F')) continue;

    switch (currentTable) {
      case 'SB': {
        exportData.chaCode      = f(parts, 6);
        exportData.iecCode      = f(parts, 7);
        exportData.branchNo     = f(parts, 8);
        exportData.shipperName  = f(parts, 9);
        exportData.address1     = f(parts, 10);
        exportData.address2     = f(parts, 11);
        exportData.city         = f(parts, 12);
        exportData.state        = f(parts, 13);
        exportData.pin          = f(parts, 14);
        exportData.autoField_32 = f(parts, 15); // SBType: F=Final
        const modeMap = { P: 'AIR', S: 'SEA', L: 'LAND' };
        exportData.shipmentMode  = modeMap[f(parts, 16)] || f(parts, 16);
        exportData._modeRaw      = f(parts, 16);
        exportData.customsPort   = f(parts, 29) || exportData.customsPort;
        exportData.autoField_5   = f(parts, 30); // Loading Port (AHN)
        exportData.autoField_6   = f(parts, 31); // Dest Country (GR)
        exportData.autoField_7   = f(parts, 33); // Dest Port
        exportData._consigneeName    = f(parts, 20);
        exportData._consigneeAddr    = f(parts, 21);
        exportData._consigneeCity    = f(parts, 22);
        exportData._consigneeCountry = f(parts, 25);
        exportData.gstType      = f(parts, 48); // GSN
        exportData.gstin        = f(parts, 49); // 08AADCT0886F1Z8
        exportData._declaration = f(parts, 40);
        break;
      }
      case 'INVOICE': {
        invoices.push({
          srNo:        Number(f(parts,6)) || (invoices.length+1),
          invoiceNo:   f(parts,7),
          invoiceDate: fmtD(f(parts,8)),
          currency:    f(parts,9),
          terms:       f(parts,10),
          value:       parseFloat(f(parts,17)) || 0,
          freight:     parseFloat(f(parts,20)) || 0,
          buyerName:   f(parts,11),
          buyerCountry:f(parts,14),
          uqc: 'NOS',
        });
        break;
      }
      case 'ITEM': {
        const desc = (f(parts,10) + ' ' + f(parts,11)).trim();
        items.push({
          invoiceSrNo:  Number(f(parts,6)) || 1,
          srNo:         Number(f(parts,7)) || (items.length+1),
          schemeCode:   f(parts,8),
          hsnCode:      f(parts,9),
          description:  desc,
          uqc:          f(parts,13),
          quantity:     parseFloat(f(parts,14)) || 0,
          rateInFcy:    parseFloat(f(parts,15)) || 0,
          fobValue:     parseFloat(f(parts,18)) || 0,
          exportScheme: f(parts,36),  // GNX100=RODTEP
          bondType:     f(parts,39),  // LUT
        });
        break;
      }
      case 'EXCHANGE': {
        exportData._exchangeRate = f(parts,9);
        exportData._exchangeDate = fmtD(f(parts,10));
        exportData._exchangeCcy  = f(parts,6);
        break;
      }
      default: break;
    }
  }

  const totalFOB = items.reduce((s, i) => s + (i.fobValue || 0), 0);

  return {
    exportData,
    invoices,
    items,
    detectedFormat: 'ICES1_5_SB',
    summary: {
      jobNo,
      exporterName: exportData.shipperName,
      chaCode:      exportData.chaCode,
      iecCode:      exportData.iecCode,
      customsPort:  exportData.customsPort,
      loadingPort:  exportData.autoField_5,
      destCountry:  exportData.autoField_6,
      destPort:     exportData.autoField_7,
      mode:         exportData.shipmentMode,
      invoiceCount: invoices.length,
      itemCount:    items.length,
      totalFOBInr:  Math.round(totalFOB),
      gstin:        exportData.gstin,
    }
  };
}

// Shipping bill: ICEGATE CACHE01 JSON and ICES .sb flat files are read by utils/sbFileReader.js (29-Oct-2026);
// the old reader stays only for plain (non-ICEGATE) SB JSON.
const { readShippingBill } = require('./sbFileReader');
function parseJsonToSB(jsonObj) {
  if (detectFormat(jsonObj || {}) === 'CACHE01') return readShippingBill(jsonObj);
  return legacyParseJsonToSB(jsonObj);
}
function parseFlatFileToSB(text) { return readShippingBill(String(text || ''), 'flat'); }

module.exports = { parseJsonToBE, parseJsonToSB, parseFlatFileToBE, parseFlatFileToSB, detectFormat };
