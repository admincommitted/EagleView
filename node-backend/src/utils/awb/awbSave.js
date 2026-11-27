// Shared field mapping and checks for POST /api/awb/create and PUT /api/awb/update/:id.
// - A key sent by the screen is used as sent (even empty); only keys not sent at all keep the saved value.
// - The columns keep the full address / city text; the XML builder cuts it to the IATA lengths.
// - Dimension rows: the Dimension window sends pkgs / unit / volWt (also read: pcs / cmIn / vol).
const has = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;
const str = (value) => (value === null || value === undefined ? '' : String(value));

// first key the screen sent (even empty) -> its value; none sent -> saved value; nothing saved -> default
function field(formData, keys, prev, column, fallback = '') {
  for (const key of keys) if (has(formData, key)) return formData[key] === null ? '' : formData[key];
  if (prev && prev[column] !== undefined && prev[column] !== null) return prev[column];
  return fallback;
}

// party block (shipper / consignee / buyer): when the screen sends the party, its fields are used as sent
function party(formData, key, prev, prefix) {
  const sentParty = has(formData, key) && formData[key] && typeof formData[key] === 'object' ? formData[key] : null;
  const saved = (column) => (prev ? str(prev[prefix + column]) : '');
  const pick = (partyKey, column) => (sentParty ? str(sentParty[partyKey]) : saved(column));
  const columns = {
    [prefix + 'Name']: pick('name', 'Name'),
    [prefix + 'Address']: pick('street', 'Address'),
    [prefix + 'City']: pick('city', 'City'),
    [prefix + 'State']: pick('state', 'State'),
    [prefix + 'Country']: pick('country', 'Country'),
    [prefix + 'Zip']: pick('zip', 'Zip'),
    [prefix + 'Phone']: pick('phone', 'Phone'),
  };
  const emailKey = key + 'Email';
  if (has(formData, emailKey)) columns[prefix + 'Email'] = str(formData[emailKey]);
  else columns[prefix + 'Email'] = sentParty && sentParty.email !== undefined ? str(sentParty.email) : saved('Email');
  return columns;
}

const numOr = (value, fallback) => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const CHARGE_COLUMNS = [
  ['weightChargePP', ['weightChargePP']],
  ['weightChargeCC', ['weightChargeCC']],
  ['valChargePP', ['valChargePP']],
  ['valChargeCC', ['valChargeCC']],
  ['taxPP', ['taxPP']],
  ['taxCC', ['taxCC']],
  ['totalChargePP', ['totalPP', 'totalChargePP']],
  ['totalChargeCC', ['totalCC', 'totalChargeCC']],
  ['ccChargesDest', ['ccChargesDest']],
];

function mainFields(body, prev) {
  const formData = body.formData || {};
  const rateLines = Array.isArray(body.rateLines) ? body.rateLines : [];
  const sumPieces = rateLines.reduce((sum, line) => sum + (parseInt(line.noOfPcs || line.pieces, 10) || 0), 0);
  const sumWeight = rateLines.reduce((sum, line) => sum + (parseFloat(line.grossWeight) || 0), 0);
  const agentDetails = formData.agentDetails && typeof formData.agentDetails === 'object' ? formData.agentDetails : {};
  const agent = (keys, detailKey, column) => {
    const value = field(formData, keys, null, column, undefined);
    if (value !== undefined) return str(value);
    if (has(agentDetails, detailKey)) return str(agentDetails[detailKey]);
    return prev ? str(prev[column]) : '';
  };
  const text = (keys, column, fallback) => str(field(formData, keys, prev, column, fallback));
  const topLevel = (key) => (has(body, key) ? str(body[key]) : prev ? str(prev[key]) : '');
  const shipper = party(formData, 'shipper', prev, 'shipper');
  const consignee = party(formData, 'consignee', prev, 'consignee');
  if (!shipper.shipperName && has(formData, 'shipperName')) shipper.shipperName = str(formData.shipperName);
  if (!consignee.consigneeName && has(formData, 'consigneeName')) consignee.consigneeName = str(formData.consigneeName);
  // the screens send handlingInformation at the top level, not inside formData
  const handlingSource = {
    ...(has(body, 'handlingInformation') ? { handlingInformation: body.handlingInformation } : {}),
    ...formData,
  };
  const fields = {
    ...shipper,
    ...consignee,
    ...party(formData, 'buyer', prev, 'buyer'),
    shipperName: shipper.shipperName || 'UNKNOWN',
    consigneeName: consignee.consigneeName || 'UNKNOWN',
    formData,
    agentName: agent(['agentName'], 'name', 'agentName'),
    agentCode: agent(['agentCode'], 'code', 'agentCode'),
    agentAccountNo: agent(['agentAccountNo'], 'accountNo', 'agentAccountNo'),
    agentPlace: agent(['agentPlace'], 'place', 'agentPlace'),
    agentCity: agent(['agentCity'], 'city', 'agentCity'),
    agentCountry: agent(['agentCountry'], 'country', 'agentCountry'),
    agentDocs: text(['agentDocs'], 'agentDocs'),
    agentEori: text(['agentEori'], 'agentEori'),
    agentAccountingInfo: text(['agentAccountingInfo'], 'agentAccountingInfo'),
    origin: text(['dep', 'origin'], 'origin', '') || 'UNK',
    destination: text(['dest', 'destination'], 'destination', '') || 'UNK',
    totalPieces: parseInt(formData.totalPieces, 10) || sumPieces || (prev && prev.totalPieces) || 1,
    grossWeight: numOr(formData.grossWeight, 0) || sumWeight || (prev && prev.grossWeight) || 0.1,
    totalVolume: has(formData, 'totalVolume') ? numOr(formData.totalVolume, 0) : prev ? numOr(prev.totalVolume, 0) : 0,
    flightNumber1: text(['flight1', 'flightNumber1'], 'flightNumber1'),
    flightDate1: text(['flightDate1'], 'flightDate1'),
    flightNumber2: text(['flight2', 'flightNumber2'], 'flightNumber2'),
    flightDate2: text(['flightDate2'], 'flightDate2'),
    flightNumber3: text(['flight3', 'flightNumber3'], 'flightNumber3'),
    flightDate3: text(['flightDate3'], 'flightDate3'),
    to1: text(['to1'], 'to1'),
    by1: text(['by1'], 'by1'),
    to2: text(['to2'], 'to2'),
    by2: text(['by2'], 'by2'),
    to3: text(['to3'], 'to3'),
    by3: text(['by3'], 'by3'),
    depAirport: text(['depAirport'], 'depAirport'),
    destAirport: text(['destAirport'], 'destAirport'),
    natureOfGoods: text(['natureOfGoods'], 'natureOfGoods'),
    productId: text(['productId'], 'productId'),
    currencyCode: text(['currencyCode'], 'currencyCode').slice(0, 3) || null,
    destinationCurrency: text(['destinationCurrency'], 'destinationCurrency').slice(0, 3) || null,
    chargeCode: text(['chargeCode'], 'chargeCode') || 'PP',
    wtVal: text(['wtVal'], 'wtVal') || 'P',
    other: text(['other'], 'other') || 'P',
    declaredValueCarriage: text(['carriageValue', 'declaredValueCarriage'], 'declaredValueCarriage') || 'NVD',
    declaredValueCustoms: text(['customsValue', 'declaredValueCustoms'], 'declaredValueCustoms') || 'NCV',
    amountOfInsurance: text(['insurance', 'amountOfInsurance'], 'amountOfInsurance') || 'XXX',
    accountingInformation: text(['accountingInfo', 'accountingInformation'], 'accountingInformation'),
    handlingInformation: str(
      field(handlingSource, ['handlingInfo', 'handlingInformation'], prev, 'handlingInformation'),
    ),
    ssr: topLevel('ssr'),
    osi: topLevel('osi'),
    sci: topLevel('sci'),
    signatureShipper: text(['signatureShipper'], 'signatureShipper'),
    signatureCarrier: text(['signatureCarrier'], 'signatureCarrier'),
    executedDate: text(['executedDate'], 'executedDate'),
    executedPlace: text(['executedPlace'], 'executedPlace'),
  };
  for (const [column, keys] of CHARGE_COLUMNS) fields[column] = numOr(field(formData, keys, prev, column, 0), 0);
  return fields;
}

// rate class code: the window sends rateClass "Q" and rateClassCode "Q - QUANTITY RATE". The grid's select changes
// rateClassCode only, so the code (the select) wins, as a letter; "N - NORMAL RATE" style values become "N".
const RATE_CLASSES = ['M', 'N', 'Q', 'B', 'K', 'C', 'E', 'R', 'S', 'U', 'X', 'Y', 'W', 'P'];
const rateClassLetter = (value) => {
  const letter = str(value)
    .trim()
    .toUpperCase()
    .split(/\s*-\s*/)[0]
    .trim();
  return RATE_CLASSES.includes(letter) ? letter : '';
};
const rateClassOf = (line) => {
  const fromCode = rateClassLetter(line.rateClassCode) || rateClassLetter(line.rateClass);
  if (fromCode) return fromCode;
  const raw = str(line.rateClass).trim();
  return raw && !/^SELECT/i.test(raw) ? raw.toUpperCase().charAt(0) : '';
};

const CBM_PER_KG = 1 / 166.6667; // IATA 6000 cm3 per kg
const CUBIC_CM_PER_CUBIC_INCH = 16.387064;
const CUBIC_CM_PER_CBM = 1e6;

function rateLineRow(line, awbId, type) {
  const volumetricWeight = numOr(line.volumetricWeight, 0);
  const volume = numOr(line.volume, 0) || (volumetricWeight ? +(volumetricWeight * CBM_PER_KG).toFixed(3) : 0);
  return {
    awbId,
    awbType: type,
    pieces: str(line.noOfPcs || line.pieces),
    grossWeight: str(line.grossWeight),
    rateClass: rateClassOf(line),
    commodityItemNo: str(line.commodityItemNumber || line.commodityItemNo),
    chargeableWeight: str(line.chargeableWeight),
    rateCharge: str(line.rateCharge),
    total: str(line.totalAmount || line.total),
    natureOfGoods: str(line.goodsDescription || line.natureOfGoods),
    slac: str(line.slac),
    rcp: str(line.rcp),
    rateClassPercentage: str(line.rateClassPercentage),
    volume: volume ? String(volume) : '',
    volumetricWeight: volumetricWeight ? String(volumetricWeight) : '',
    cwUnit: str(line.cwUnit),
    mc: str(line.mc),
    harmonisedCode: str(line.harmonisedCode || line.hsCode),
    isRounded: line.isRounded !== false, // IATA 0.5 kg rounding is on unless switched off
    rateAsAgreed: !!line.rateAsAgreed,
    gwUnit: str(line.gwUnit) || 'K',
    length: str(line.length),
    width: str(line.width),
    height: str(line.height),
    cmIn: str(line.cmIn),
    noOfUnits: str(line.noOfUnits),
    dimensions: Array.isArray(line.dimensions) && line.dimensions.length ? JSON.stringify(line.dimensions) : null,
    uldType: str(line.uldType),
    uldSerial: str(line.uldSerial),
    uldOwner: str(line.uldOwner),
    uldRateClass: str(line.uldRateClass),
  };
}

function dimRow(dim, awbId, type, _index) {
  const pieces = parseInt(dim.pcs || dim.pieces || dim.pkgs || dim.noOfUnits, 10) || null;
  const length = numOr(dim.len ?? dim.length, null);
  const width = numOr(dim.wid ?? dim.width, null);
  const height = numOr(dim.ht ?? dim.height, null);
  const unitText = str(dim.cmIn || dim.unit || 'CM').toUpperCase();
  const unit = unitText.startsWith('IN') ? 'IN' : 'CM';
  let volume = numOr(dim.vol ?? dim.volume, null);
  if (!volume && length && width && height) {
    const cubicCm = length * width * height * (pieces || 1) * (unit === 'IN' ? CUBIC_CM_PER_CUBIC_INCH : 1);
    volume = +(cubicCm / CUBIC_CM_PER_CBM).toFixed(4);
  }
  return {
    awbId,
    awbType: type,
    rateLineIndex: dim.rateLineIndex ?? dim.lineIndex ?? null,
    pieces,
    length,
    width,
    height,
    volume,
    cmIn: unit,
    volumetricWeight: numOr(dim.volWt ?? dim.volumetricWeight, null),
  };
}

const listOf = (value) => (Array.isArray(value) ? value : []);

async function writeChildren(models, awbId, type, body, transaction, isUpdate, prevType) {
  const { SpecialHandlingCode, AwbRateLine, AwbOtherCharge, AwbOci, AwbDimension } = models;
  const options = { transaction };
  if (isUpdate) {
    // rows of this record: an AWB opened on the MAWB screen may have been saved as type 'AWB' (or the reverse)
    const types = type === 'HAWB' ? ['HAWB'] : [...new Set([type, prevType, 'AWB', 'MAWB'].filter(Boolean))];
    // only the parts the caller sent are replaced (the AWB screens always send all five)
    const childParts = [
      [SpecialHandlingCode, 'sphCodes'],
      [AwbRateLine, 'rateLines'],
      [AwbOtherCharge, 'otherCharges'],
      [AwbOci, 'ociRows'],
      [AwbDimension, 'dimRows'],
    ];
    for (const [Model, key] of childParts) {
      if (Array.isArray(body[key])) await Model.destroy({ where: { awbId, awbType: types }, transaction });
    }
  }
  for (const code of listOf(body.sphCodes)) {
    if (code && String(code).trim())
      await SpecialHandlingCode.create({ awbId, awbType: type, code: String(code).trim() }, options);
  }
  for (const line of listOf(body.rateLines)) {
    if (!(line && (line.noOfPcs || line.pieces || line.grossWeight || line.goodsDescription || line.natureOfGoods)))
      continue;
    await AwbRateLine.create(rateLineRow(line, awbId, type), options);
  }
  for (const charge of listOf(body.otherCharges)) {
    if (!(charge && charge.code)) continue;
    await AwbOtherCharge.create(
      {
        awbId,
        awbType: type,
        chargeCode: charge.code,
        description: charge.description || charge.chargeDescription || charge.name || null,
        entitlement: charge.entitlement,
        ppcc: charge.ppcc || charge.entitlement || 'PP',
        amount: charge.amount,
        rate: charge.rate,
      },
      options,
    );
  }
  for (const oci of listOf(body.ociRows)) {
    if (!(oci && (oci.country || oci.infoId || oci.countryCode))) continue;
    await AwbOci.create(
      {
        awbId,
        awbType: type,
        countryCode: oci.country || oci.countryCode || '',
        infoId: oci.infoId || '',
        customsId: oci.customsId || '',
        suppInfo: oci.suppInfo || '',
      },
      options,
    );
  }
  // extra documents (DG declaration, SLI, DO ...): { DGD: {...fields}, SLI: {...} } - upsert, a null value removes it
  if (models.AwbExtraDoc && body.extraDocs && typeof body.extraDocs === 'object') {
    for (const [docType, data] of Object.entries(body.extraDocs)) {
      const key = String(docType)
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 30);
      if (!key) continue;
      const types = type === 'HAWB' ? ['HAWB'] : ['AWB', 'MAWB'];
      await models.AwbExtraDoc.destroy({ where: { awbId, awbType: types, docType: key }, transaction });
      if (data !== null && data !== undefined) {
        await models.AwbExtraDoc.create(
          { awbId, awbType: type, docType: key, data: JSON.stringify(data), updatedBy: body.user || null },
          options,
        );
      }
    }
  }
  const dims = listOf(body.dimRows);
  for (let index = 0; index < dims.length; index++) {
    const dim = dims[index];
    if (!(dim && (dim.pcs || dim.pieces || dim.pkgs || dim.noOfUnits || dim.len || dim.length))) continue;
    await AwbDimension.create(dimRow(dim, awbId, type, index), options);
  }
}

// ---- server-side checks for create / update ----
const AWB_RE = /^\d{11}$/;
function awbNoError(number, label = 'AWB') {
  const digits = String(number || '').replace(/[\s-]/g, '');
  if (!AWB_RE.test(digits))
    return `${label} number must be 11 digits (3-digit airline prefix + 8 digits), got "${number || ''}"`;
  const serial = digits.slice(3, 10);
  if (Number(serial) % 7 !== Number(digits[10])) {
    return `${label} ${number}: check digit is wrong (for ${serial} it must be ${Number(serial) % 7})`;
  }
  return null;
}

const nameOf = (formData, key) => {
  const sentParty = formData && formData[key];
  if (sentParty && typeof sentParty === 'object') return str(sentParty.name).trim();
  return str(formData && formData[key + 'Name']).trim();
};
// null = empty, NaN = not a number
const parseAmount = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : NaN;
};
const normalisedNo = (value) =>
  String(value)
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const sameNo = (a, b) => !!a && !!b && normalisedNo(a) === normalisedNo(b);

function checkNumbers(body, docType, isCreate, prev, errors) {
  const number = body.awbNumber;
  if (isCreate || (number !== undefined && number !== 'DRAFT' && !(prev && sameNo(number, prev.awbNumber)))) {
    if (!number || number === 'DRAFT') {
      errors.push(docType === 'HAWB' ? 'HAWB number is required' : 'AWB number is required');
    } else if (docType === 'HAWB') {
      if (!/^[A-Za-z0-9][A-Za-z0-9\-/]{0,34}$/.test(String(number).trim()))
        errors.push('HAWB number: up to 35 letters / digits (- and / allowed)');
    } else {
      const error = awbNoError(number);
      if (error) errors.push(error);
    }
  }
  const masterChanged =
    body.masterAwbNumber !== undefined && !(prev && sameNo(body.masterAwbNumber, prev.masterAwbNumber));
  if (docType === 'HAWB' && (isCreate || masterChanged)) {
    if (!body.masterAwbNumber) {
      errors.push('MAWB number is required for a HAWB');
    } else {
      const error = awbNoError(body.masterAwbNumber, 'MAWB');
      if (error) errors.push(error);
    }
  }
}

function checkRoute(formData, isCreate, errors) {
  const originSent = has(formData, 'dep') || has(formData, 'origin');
  const destinationSent = has(formData, 'dest') || has(formData, 'destination');
  const origin = str(has(formData, 'dep') ? formData.dep : formData.origin)
    .trim()
    .toUpperCase();
  const destination = str(has(formData, 'dest') ? formData.dest : formData.destination)
    .trim()
    .toUpperCase();
  if ((isCreate || originSent) && !/^[A-Z]{3}$/.test(origin)) errors.push('Origin airport must be a 3-letter code');
  if ((isCreate || destinationSent) && !/^[A-Z]{3}$/.test(destination))
    errors.push('Destination airport must be a 3-letter code');
  if (origin && destination && origin === destination) errors.push('Origin and destination cannot be the same airport');
}

function checkRateLines(rateLines, errors) {
  const lines = listOf(rateLines).filter(
    (line) =>
      line &&
      (line.noOfPcs ||
        line.pieces ||
        line.grossWeight ||
        line.goodsDescription ||
        line.natureOfGoods ||
        line.chargeableWeight),
  );
  if (!lines.some((line) => parseAmount(line.grossWeight) > 0))
    errors.push('At least one rate line with gross weight is required');
  lines.forEach((line, index) => {
    const label = `Rate line ${index + 1}`;
    const pieces = parseAmount(line.noOfPcs ?? line.pieces);
    const gross = parseAmount(line.grossWeight);
    const chargeable = parseAmount(line.chargeableWeight);
    const rate = parseAmount(line.rateCharge);
    const total = parseAmount(line.totalAmount ?? line.total);
    if (Number.isNaN(pieces) || (pieces !== null && (pieces < 1 || !Number.isInteger(pieces))))
      errors.push(`${label}: pieces must be a whole number of 1 or more`);
    if (gross > 0 && pieces === null) errors.push(`${label}: pieces are required`);
    if (Number.isNaN(gross) || gross < 0) errors.push(`${label}: gross weight must be 0 or more`);
    if (Number.isNaN(chargeable) || chargeable < 0) {
      errors.push(`${label}: chargeable weight must be 0 or more`);
    } else if (chargeable !== null && chargeable > 0 && gross > 0 && chargeable + 0.001 < gross) {
      errors.push(`${label}: chargeable weight (${chargeable}) cannot be less than gross weight (${gross})`);
    }
    if (Number.isNaN(rate) || rate < 0) errors.push(`${label}: rate must be 0 or more`);
    if (Number.isNaN(total) || total < 0) errors.push(`${label}: total must be 0 or more`);
  });
}

const DIMENSION_KEYS = ['len', 'length', 'wid', 'width', 'ht', 'height', 'pcs', 'pieces', 'pkgs'];
const CHARGE_KEYS = [
  'weightChargePP',
  'weightChargeCC',
  'valChargePP',
  'valChargeCC',
  'taxPP',
  'taxCC',
  'totalPP',
  'totalCC',
];
const MAX_EXTRA_DOC_JSON = 200000;

// returns a list of messages; [] = ok. On update only the parts the screen sent are checked.
// prev = saved record on update: a number that did not change is not checked again (old records keep working)
function validateAwb(body, type, isCreate, prev) {
  const errors = [];
  const formData = (body && body.formData) || {};
  const docType = String(type || '').toUpperCase();
  if (!['AWB', 'MAWB', 'HAWB'].includes(docType)) errors.push(`Unknown type "${type || ''}" (AWB, MAWB or HAWB)`);
  checkNumbers(body, docType, isCreate, prev, errors);
  checkRoute(formData, isCreate, errors);
  for (const [key, label] of [
    ['shipper', 'Shipper'],
    ['consignee', 'Consignee'],
  ]) {
    const sent = has(formData, key) || has(formData, key + 'Name');
    if ((isCreate || sent) && !nameOf(formData, key)) errors.push(`${label} name is required`);
  }
  if (isCreate || Array.isArray(body.rateLines)) checkRateLines(body.rateLines, errors);
  if (Array.isArray(body.otherCharges)) {
    body.otherCharges.forEach((charge, index) => {
      if (!charge || !charge.code) return;
      const amount = parseAmount(charge.amount);
      if (Number.isNaN(amount) || amount < 0)
        errors.push(`Other charge ${charge.code} (row ${index + 1}): amount must be 0 or more`);
      if (charge.entitlement && !/^(A|C|AGENT|CARRIER|DUE ?AGENT|DUE ?CARRIER)$/i.test(String(charge.entitlement))) {
        errors.push(`Other charge ${charge.code}: due must be Agent or Carrier`);
      }
    });
  }
  if (Array.isArray(body.dimRows)) {
    body.dimRows.forEach((dim, index) => {
      for (const key of DIMENSION_KEYS) {
        const value = dim && parseAmount(dim[key]);
        if (Number.isNaN(value) || value < 0) {
          errors.push(`Dimension row ${index + 1}: ${key} must be 0 or more`);
          break;
        }
      }
    });
  }
  for (const key of CHARGE_KEYS) {
    const value = parseAmount(formData[key]);
    if (Number.isNaN(value) || value < 0) errors.push(`${key} must be 0 or more`);
  }
  for (const key of ['currencyCode', 'destinationCurrency']) {
    if (formData[key] && !/^[A-Za-z]{3}$/.test(String(formData[key]).trim()))
      errors.push(`${key} must be a 3-letter currency code`);
  }
  if (body.extraDocs && typeof body.extraDocs === 'object') {
    for (const [key, value] of Object.entries(body.extraDocs)) {
      if (value !== null && value !== undefined && JSON.stringify(value).length > MAX_EXTRA_DOC_JSON)
        errors.push(`Document ${key} is too large to save`);
    }
  }
  return errors;
}

// minimum the airline needs in an FWB / FHL / FZB; the message generator does not fill gaps itself
function ediReadyErrors(awb, type) {
  const errors = [];
  const docType = String(type || '').toUpperCase();
  const value = (key) => str(awb && awb[key]).trim();
  if (docType === 'HAWB') {
    if (!/^[A-Za-z0-9]{1,12}$/.test(value('awbNumber')))
      errors.push(`HAWB number "${value('awbNumber')}": EDI allows letters and digits only, up to 12`);
    const masterError = awbNoError(value('masterAwbNumber'), 'MAWB');
    if (masterError) errors.push(masterError);
  } else {
    const error = awbNoError(value('awbNumber'));
    if (error) errors.push(error);
  }
  if (!/^[A-Z]{3}$/i.test(value('origin'))) errors.push('Origin airport (3 letters) missing');
  if (!/^[A-Z]{3}$/i.test(value('destination'))) errors.push('Destination airport (3 letters) missing');
  for (const [prefix, label] of [
    ['shipper', 'Shipper'],
    ['consignee', 'Consignee'],
  ]) {
    if (!value(prefix + 'Name')) errors.push(`${label} name missing`);
    if (!value(prefix + 'Address')) errors.push(`${label} address missing`);
    if (!value(prefix + 'City')) errors.push(`${label} city missing`);
    if (!/^[A-Z]{2}$/i.test(value(prefix + 'Country')))
      errors.push(`${label} country must be the 2-letter ISO code (now "${value(prefix + 'Country')}")`);
  }
  if (docType !== 'HAWB') {
    // routing: the first "to" cannot be the departure, the last one must be the destination
    const stops = [value('to1'), value('to2'), value('to3')].map((stop) => stop.toUpperCase()).filter(Boolean);
    if (stops.length && stops[0] === value('origin').toUpperCase()) {
      errors.push(`Routing: first "To" ${stops[0]} is the airport of departure - give the next airport`);
    }
    if (stops.length && value('destination') && stops[stops.length - 1] !== value('destination').toUpperCase()) {
      errors.push(
        `Routing ends at ${stops[stops.length - 1]} but the destination is ${value('destination').toUpperCase()}`,
      );
    }
  }
  if (!(parseInt(value('totalPieces'), 10) >= 1)) errors.push('Total pieces missing');
  if (!(parseFloat(value('grossWeight')) > 0)) errors.push('Gross weight missing');
  return errors;
}

export { mainFields, writeChildren, validateAwb, awbNoError, ediReadyErrors };
