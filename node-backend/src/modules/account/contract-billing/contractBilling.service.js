// The charges a docket should be billed under the customer's contract (Customer Contract & Quotation Master,
// /api/contracts). Used by the Provisional Sheet of the GST invoice. Read only.
//   contract: the docket's "Quotation" field when it holds an Active contract no., else the Active contract of the
//             billing party / main party valid on the docket date
//   freight:  contract freight matrix - origin, destination (codes matched to the docket's port names through the
//             port masters), cargo type, carrier (any, or the docket's airline), weight slab on chargeable weight, Min
//   charges:  the contract's charges for the docket's division, by basis (flat, per kg, per package, per CBM, per
//             container 20'/40', % of freight / value / duty) with Min / Max; Reimbursement or At Actuals charges
//             are billed at the actual cost booked on the docket (receipted charges), never at a rate
//   transport: the contract's cartage rates, offered unticked (the route is chosen by the user)
// Every line carries an Accounts GST charge name.

const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const round2 = (value) => Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
const upper = (value) =>
  String(value == null ? '' : value)
    .trim()
    .toUpperCase();
const normalisePortName = (text) =>
  upper(text)
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(NEW|INTL|INTERNATIONAL|AIRPORT|AIR PORT|APT|PORT|SEAPORT)\b/g, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// weight slabs of the freight matrix, highest first: [column, from kg, label]
const WEIGHT_SLABS = [
  ['plus1000', 1000, '+1000 kg'],
  ['plus500', 500, '+500 kg'],
  ['plus300', 300, '+300 kg'],
  ['plus100', 100, '+100 kg'],
  ['plus45', 45, '+45 kg'],
  ['normal', 0, 'Normal'],
];
const ANY_CARRIER = ['ANY', '*', 'ALL'];
const INR = 'INR';
const UN_LOCODE_LENGTH = 5;
const IATA_CODE_LENGTH = 3;

const parseJson = (text, fallback) => {
  try {
    return JSON.parse(text || fallback) || JSON.parse(fallback);
  } catch {
    return JSON.parse(fallback);
  }
};

/** IATA codes a docket's port text can mean: the text itself, a code in brackets, and the port masters' codes. */
async function portCodes(query, text) {
  const codes = new Set();
  const raw = upper(text);
  if (!raw) return codes;
  if (/^[A-Z]{3}$/.test(raw)) codes.add(raw);
  const bracketCode = raw.match(/\(([A-Z]{3})\)/);
  if (bracketCode) codes.add(bracketCode[1]);
  const name = normalisePortName(text);
  if (!name) return codes;
  const foreignPorts = await query('SELECT code FROM ForeignPorts WHERE upper(trim(name)) = ? LIMIT 20', [name]).catch(
    () => [],
  );
  for (const port of foreignPorts) {
    const code = upper(port.code);
    if (code.length === UN_LOCODE_LENGTH) codes.add(code.slice(2));
    else if (code.length === IATA_CODE_LENGTH) codes.add(code);
  }
  const airports = await query(
    'SELECT code FROM Airports WHERE upper(trim(name)) = ? OR upper(trim(name)) LIKE ? LIMIT 20',
    [name, name + ' %'],
  ).catch(() => []);
  for (const airport of airports) codes.add(upper(airport.code));
  return codes;
}

/** Every name / code the docket's carrier is known by (also found from the MAWB prefix). */
async function carrierCodes(query, carrier, mawbNo) {
  const codes = new Set();
  const carrierText = upper(carrier);
  if (carrierText) codes.add(carrierText);
  const prefix = String(mawbNo || '')
    .replace(/\D/g, '')
    .slice(0, 3);
  const airlines = await query(
    "SELECT name, code2, code3, prefix FROM Airlines WHERE upper(trim(name)) = ? OR upper(code2) = ? OR upper(code3) = ? OR (? <> '' AND prefix = ?) LIMIT 10",
    [carrierText, carrierText, carrierText, prefix, prefix],
  ).catch(() => []);
  for (const airline of airlines) {
    for (const value of [airline.name, airline.code2, airline.code3, airline.prefix])
      if (value) codes.add(upper(value));
  }
  return codes;
}

const loadShipment = async (query, jobNo) =>
  (
    await query(
      `SELECT docketNo, docketDate, division, mainParty, mainPartyId, billingParty, quotationNo, originPort, destinationPort,
    carrier, mawbNo, cargoType, grossWeight, chargeableWeight, pkgs, volume, containersJson, dataJson
    FROM Shipments WHERE upper(trim(docketNo)) = ? LIMIT 1`,
      [jobNo],
    ).catch(() => [])
  )[0];

async function partyIdsByName(query, name) {
  const rows = await query('SELECT id FROM Parties WHERE upper(trim(name)) = ? LIMIT 3', [upper(name)]).catch(() => []);
  return rows.map((row) => row.id);
}

/** The contract no. in the docket's Quotation field, else the billing / main party's Active contract on the date. */
async function findContract(query, shipment, date) {
  if (shipment.quotationNo) {
    const byNumber = (
      await query("SELECT * FROM CustomerContracts WHERE upper(trim(contractNo)) = ? AND status = 'Active' LIMIT 1", [
        upper(shipment.quotationNo),
      ]).catch(() => [])
    )[0];
    if (byNumber) return byNumber;
  }
  const partyIds = [];
  if (shipment.billingParty) partyIds.push(...(await partyIdsByName(query, shipment.billingParty)));
  if (toNumber(shipment.mainPartyId)) partyIds.push(toNumber(shipment.mainPartyId));
  else if (shipment.mainParty) partyIds.push(...(await partyIdsByName(query, shipment.mainParty)));
  if (!partyIds.length) return null;
  return (
    (
      await query(
        `SELECT * FROM CustomerContracts WHERE status = 'Active' AND partyId IN (${partyIds.map(Number).join(',')})
      AND coalesce(validFrom, '0000-00-00') <= ? AND validTo >= ?
      ORDER BY CASE WHEN partyId = ? THEN 0 ELSE 1 END, id DESC LIMIT 1`,
        [date, date, partyIds[0]],
      ).catch(() => [])
    )[0] || null
  );
}

/** Rate of exchange of a currency: import or export rate by the docket's direction (INR and unknown = 1). */
const exchangeRateReader = (query, isImport) => async (currency) => {
  if (!currency || upper(currency) === INR) return 1;
  const rates = (
    await query('SELECT importRate, exportRate FROM Currencies WHERE upper(currencyCode) = ? LIMIT 1', [
      upper(currency),
    ]).catch(() => [])
  )[0];
  return rates ? toNumber(isImport ? rates.importRate : rates.exportRate) || 1 : 1;
};

/** The first active Accounts GST charge whose name matches. */
async function gstChargeNameFinder(query) {
  const gstCharges = await query('SELECT chargeName, coalesce(isActive, 1) active FROM AccGstCharges').catch(() => []);
  return (pattern) => {
    const charge = gstCharges.find((row) => row.active && pattern.test(upper(row.chargeName)));
    return charge ? upper(charge.chargeName) : null;
  };
}

function freightRateRow(freightRates, originCodes, destinationCodes, carrierCodeSet, cargoType) {
  const sector = freightRates.filter(
    (rate) => originCodes.has(upper(rate.origin)) && destinationCodes.has(upper(rate.destination)),
  );
  const ofServiceType = (serviceType) => sector.filter((rate) => upper(rate.serviceType) === serviceType);
  const rows = ofServiceType(cargoType).length ? ofServiceType(cargoType) : ofServiceType('GENERAL');
  const isAnyCarrier = (rate) => !rate.carrier || ANY_CARRIER.includes(upper(rate.carrier));
  const row =
    rows.find((rate) => !isAnyCarrier(rate) && carrierCodeSet.has(upper(rate.carrier))) || rows.find(isAnyCarrier);
  return { row, sector };
}

function freightQuantityAndRate(row, chargeableWeight) {
  let rate = null;
  let slab = '';
  for (const [column, fromKg, label] of WEIGHT_SLABS) {
    if (chargeableWeight >= fromKg && row[column] != null && row[column] !== '') {
      rate = toNumber(row[column]);
      slab = label;
      break;
    }
  }
  const hasMinimum = row.min != null && row.min !== '';
  if (rate == null || (hasMinimum && rate * chargeableWeight < toNumber(row.min))) {
    return { qty: 1, sell: toNumber(row.min), basis: 'Min' };
  }
  return { qty: chargeableWeight, sell: rate || 0, basis: 'Per KG (ChW) ' + slab };
}

/** Air freight from the contract's matrix row for this sector, cargo type and carrier. */
async function freightLine(context) {
  const { query, shipment, contract, division, chargeableWeight, findGstChargeName, rateOf, contractLabel, notes } =
    context;
  const freightRates = await query('SELECT * FROM ContractFreightRates WHERE contractId = ?', [contract.id]).catch(
    () => [],
  );
  if (!(freightRates.length && division.startsWith('A') && chargeableWeight > 0)) return null;
  const [originCodes, destinationCodes, carrierCodeSet] = await Promise.all([
    portCodes(query, shipment.originPort),
    portCodes(query, shipment.destinationPort),
    carrierCodes(query, shipment.carrier, shipment.mawbNo),
  ]);
  const cargoType = upper(shipment.cargoType || 'General');
  const { row, sector } = freightRateRow(freightRates, originCodes, destinationCodes, carrierCodeSet, cargoType);
  if (!row) {
    if (sector.length || freightRates.length) {
      notes.push(
        'No freight rate in the contract for ' +
          (shipment.originPort || '?') +
          ' to ' +
          (shipment.destinationPort || '?') +
          (shipment.carrier ? ' / ' + shipment.carrier : ''),
      );
    }
    return null;
  }
  const { qty, sell, basis } = freightQuantityAndRate(row, chargeableWeight);
  const charge =
    upper(row.chargeName) ||
    findGstChargeName(division === 'AE' ? /FREIGHT.*AIR.*EXPORT/ : /FREIGHT.*AIR.*IMPORT/) ||
    'FREIGHT CHARGES';
  const currency = contract.currency || INR;
  return {
    charge,
    currency,
    exRate: await rateOf(currency),
    qty,
    buyRate: 0,
    sellRate: round2(sell),
    basis,
    from: contractLabel + ' - freight ' + row.origin + '-' + row.destination + (row.carrier ? ' ' + row.carrier : ''),
    note: row.chargeName ? '' : 'set the GST charge of this freight line in the contract',
  };
}

function containerCounts(containers) {
  const twenty = containers.filter((container) => /20/.test(String(container.size || ''))).length;
  const forty = containers.filter((container) => /40|45/.test(String(container.size || ''))).length;
  return { twenty, forty, unknown: containers.length - twenty - forty, total: containers.length };
}

// receipted: the actual cost booked on the docket
const actualCostLine = (charge, costs, contractLabel) => {
  const cost = costs.get(charge) || 0;
  return {
    charge,
    currency: INR,
    exRate: 1,
    qty: 1,
    buyRate: round2(cost),
    sellRate: round2(cost),
    basis: 'At actual cost',
    from: contractLabel + ' - at actual cost',
    receipted: true,
    note: cost ? '' : 'cost not booked on the docket yet',
  };
};

function percentageLine(contractCharge, charge, currency, exchangeRate, context) {
  const basis = upper(contractCharge.basis);
  const { freightAmount, shipmentData } = context;
  let base;
  if (/FREIGHT/.test(basis)) base = freightAmount / exchangeRate;
  else if (/DUTY/.test(basis)) base = toNumber(shipmentData.totalDuty || shipmentData.dutyAmount);
  else {
    base = toNumber(
      shipmentData.assessableValue ||
        shipmentData.assValue ||
        shipmentData.invoiceValueInr ||
        shipmentData.invoiceValue,
    );
  }
  const note = base ? '' : 'base amount (' + contractCharge.basis + ') not on the docket - enter it';
  let amount = (base * toNumber(contractCharge.rate)) / 100;
  if (toNumber(contractCharge.minAmt) && amount < toNumber(contractCharge.minAmt))
    amount = toNumber(contractCharge.minAmt);
  if (toNumber(contractCharge.maxAmt) && amount > toNumber(contractCharge.maxAmt))
    amount = toNumber(contractCharge.maxAmt);
  return {
    charge,
    currency,
    exRate: exchangeRate,
    qty: 1,
    buyRate: 0,
    sellRate: round2(amount),
    basis: contractCharge.basis + ' @ ' + toNumber(contractCharge.rate),
    from: context.contractLabel,
    note,
    optional: !base && !contractCharge.mandatory,
  };
}

// quantity by the charge's basis; container sizes missing on the docket make the line optional
function quantityByBasis(basis, context) {
  const { shipment, chargeableWeight, grossWeight, containers } = context;
  const unknownSize = { optional: true, note: 'container size not on the docket' };
  if (/CHW|CHARGEABLE/.test(basis)) return { qty: chargeableWeight };
  if (/GRW|GROSS/.test(basis)) return { qty: grossWeight };
  if (/KG/.test(basis)) return { qty: chargeableWeight };
  if (/PKG|PACKAGE/.test(basis)) return { qty: toNumber(shipment.pkgs) };
  if (/CBM/.test(basis)) return { qty: toNumber(shipment.volume) };
  if (/20/.test(basis)) {
    const qty = containers.twenty || (containers.forty ? 0 : containers.unknown);
    return !containers.twenty && containers.unknown && !containers.forty ? { qty, ...unknownSize } : { qty };
  }
  if (/40/.test(basis)) {
    const qty = containers.forty || (containers.twenty ? 0 : containers.unknown);
    return !containers.forty && containers.unknown && !containers.twenty ? { qty, ...unknownSize } : { qty };
  }
  if (/CONTAINER/.test(basis)) return { qty: containers.total };
  return { qty: 1 };
}

function rateLine(contractCharge, charge, currency, exchangeRate, context) {
  const basis = upper(contractCharge.basis);
  let { qty, optional = false, note = '' } = quantityByBasis(basis, context);
  if (!(qty > 0)) {
    if (!contractCharge.mandatory) return null;
    qty = 1;
  }
  let sell = toNumber(contractCharge.rate);
  const amount = sell * qty;
  const withNote = (text) => (note ? note + '; ' : '') + text;
  if (toNumber(contractCharge.minAmt) && amount < toNumber(contractCharge.minAmt)) {
    qty = 1;
    sell = toNumber(contractCharge.minAmt);
    note = withNote('Min applied');
  } else if (toNumber(contractCharge.maxAmt) && amount > toNumber(contractCharge.maxAmt)) {
    qty = 1;
    sell = toNumber(contractCharge.maxAmt);
    note = withNote('Max applied');
  }
  return {
    charge,
    currency,
    exRate: exchangeRate,
    qty: round2(qty),
    buyRate: 0,
    sellRate: round2(sell),
    basis: contractCharge.basis,
    from: context.contractLabel,
    note,
    optional,
  };
}

/** The contract's charges for the docket's division (ALL or the division itself). */
async function contractChargeLines(context) {
  const { query, contract, division, costs, rateOf, contractLabel } = context;
  const lines = [];
  const contractCharges = await query('SELECT * FROM ContractCharges WHERE contractId = ? ORDER BY id', [
    contract.id,
  ]).catch(() => []);
  for (const contractCharge of contractCharges) {
    const appliesTo = upper(contractCharge.appliesTo || 'ALL');
    if (appliesTo !== 'ALL' && appliesTo !== division) continue;
    const charge = upper(contractCharge.printName);
    const basis = upper(contractCharge.basis);
    const currency = contractCharge.currency || INR;
    const exchangeRate = await rateOf(currency);
    if (upper(contractCharge.type) === 'REIMBURSEMENT' || /ACTUAL/.test(basis)) {
      lines.push(actualCostLine(charge, costs, contractLabel));
      continue;
    }
    if (/%/.test(basis)) {
      lines.push(percentageLine(contractCharge, charge, currency, exchangeRate, context));
      continue;
    }
    const line = rateLine(contractCharge, charge, currency, exchangeRate, context);
    if (line) lines.push(line);
  }
  return lines;
}

// cartage: offered, not ticked
async function transportLines({ query, contract, findGstChargeName, rateOf, contractLabel }) {
  const lines = [];
  const transportRates = await query('SELECT * FROM ContractTransportRates WHERE contractId = ? ORDER BY id', [
    contract.id,
  ]).catch(() => []);
  for (const transport of transportRates) {
    const charge =
      upper(transport.chargeName) || findGstChargeName(/^TRANSPORTATION CHARGES/) || 'TRANSPORTATION CHARGES';
    lines.push({
      charge,
      currency: transport.currency || INR,
      exRate: await rateOf(transport.currency),
      qty: 1,
      buyRate: 0,
      sellRate: round2(transport.amount),
      basis:
        [transport.fromLoc, transport.toLoc].join(' to ') + (transport.vehicle ? ' (' + transport.vehicle + ')' : ''),
      from: contractLabel + ' - transport',
      optional: true,
    });
  }
  return lines;
}

/**
 * The lines a docket should be billed under its customer's contract.
 * `query(sql, replacements)` runs a SELECT; `costs` maps each charge name to the cost booked on the docket.
 * Answers null when the docket is not a Shipment, { contract: null, lines: [] } when no contract applies.
 */
export async function buildContractBilling(query, jobNo, costs) {
  const shipment = await loadShipment(query, jobNo);
  if (!shipment) return null;
  const date = String(shipment.docketDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const division = upper(shipment.division);
  const notes = [];
  const contract = await findContract(query, shipment, date);
  if (!contract) return { contract: null, lines: [] };

  const findGstChargeName = await gstChargeNameFinder(query);
  const chargeableWeight = toNumber(shipment.chargeableWeight) || toNumber(shipment.grossWeight);
  const context = {
    query,
    shipment,
    contract,
    division,
    costs,
    notes,
    findGstChargeName,
    shipmentData: parseJson(shipment.dataJson, '{}'),
    rateOf: exchangeRateReader(query, division.endsWith('I')),
    contractLabel: 'Contract ' + contract.contractNo,
    chargeableWeight,
    grossWeight: toNumber(shipment.grossWeight) || chargeableWeight,
  };

  const lines = [];
  const freight = await freightLine(context);
  if (freight) lines.push(freight);
  context.containers = containerCounts(parseJson(shipment.containersJson, '[]'));
  context.freightAmount = lines.length ? lines[0].sellRate * lines[0].qty * lines[0].exRate : 0;
  lines.push(...(await contractChargeLines(context)));
  lines.push(...(await transportLines(context)));
  return {
    contract: {
      id: contract.id,
      contractNo: contract.contractNo,
      partyName: contract.partyName,
      validTo: contract.validTo,
      currency: contract.currency,
    },
    lines,
    notes,
  };
}
