/**
 * XmlPayloadGenerator.js
 * Generates IATA CargoXML messages for Descartes myVan GLN submission.
 *
 * Supported message types:
 *   XFWB  — Master Air Waybill        (IATA Res. 600a/b, Version 3.00)
 *   XFHL  — House Manifest            (IATA, Version 2.00)
 *   XFZB  — House Waybill, one per HAWB (IATA, Version 3.00) - 29-Oct-2026; was a security-declaration stub
 *   XFFM  — Flight Manifest           (IATA, Version 2.00)
 *
 * Standards compliance:
 *   - IATA CargoXML Implementation Guide v3.00 (XFWB)
 *   - IATA CargoXML Implementation Guide v2.00 (XFHL, XFFM)
 *   - Descartes myVan SFTP FAQ + sample XMLs
 *
 * Fixed issues (2026-09-13):
 *   1.  ProductID element added to MasterConsignment
 *   2.  OriginLocation/Name + FinalDestinationLocation/Name from Airport DB
 *   3.  CountryName resolved from ISO code via Country DB lookup
 *   4.  ConsigneeParty/CountryName empty fallback fixed
 *   5.  FreightForwarder CountryName same fix applied
 *   6.  XFHL OriginLocation/Name currency-in-Name BUG fixed
 *   7.  XFHL house AllowanceCharge now includes <Reason>
 *   8.  ValuationChargeTotalAmount & TaxTotalAmount added to TotalRating
 *   9.  SlacPieceQuantity DB field confirmed in AwbRateLine model
 *  10.  Non-standard FreightForwarderDocText replaced with IncludedHeaderNote
 *  11.  Duplicate HandlingOSIInstructions merged (osi + handlingInformation combined)
 *  12.  SSR DescriptionCode now uses actual code, not full description text
 *  13.  Leg-3 flight number now reads awb.flightNumber3 (not flightNumber2)
 *  14.  Email included in DefinedTradeContact when available
 *  15.  XFHL SenderParty/RecipientParty schemeID changed from "P" to "C"
 *  16.  SenderAssignedID added to XFHL BusinessHeaderDocument
 *  17.  ApplicableRating/TypeCode set to "A" when rateAsAgreed
 *  18.  XFZB screeningMethod validated — no silent XRY default
 *  19.  XFFM FlightLeg ArrivalEvent now includes ScheduledOccurrenceDateTime
 *  20.  XFFM SummaryDescription truncated to 70 chars per IATA spec
 *  21.  AgentTotalDuePayableAmount added to TotalRating summary block
 *  22.  Dimension unitCode validated (CMT/INH/MTR from db.cmIn)
 *  23.  ConversationID populated for amendment messages
 *  24.  PurposeCode supports "Creation" and "Modification" (amendment flow)
 *  25.  XFHL/XFFM ConsignorParty now also includes CountryName
 */

const Airwaybill  = require("../models/Airwaybill");
const HouseAWB    = require("../models/HouseAWB");
const AppSetting  = require("../models/AppSetting");
const Airport     = require("../models/Airport");
const Country     = require("../models/Country");
const { Op }      = require("sequelize");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSetting(key, fallback) {
  try {
    return await require('./settingsStore').get(key, fallback); // SftpConfig / AppSetting (28-Oct-2026)
  } catch (_) { return fallback; }
}

/** Lookup airport name from DB by IATA code. Returns empty string if not found. */
const _airportCache = {};
async function getAirportName(code) {
  if (!code) return "";
  const KEY = code.toUpperCase().trim();
  if (_airportCache[KEY] !== undefined) return _airportCache[KEY];
  try {
    const ap = await Airport.findOne({ where: { code: KEY } });
    _airportCache[KEY] = ap ? ap.name.toUpperCase() : "";
  } catch (_) { _airportCache[KEY] = ""; }
  return _airportCache[KEY];
}

/** Lookup country name from DB by ISO 2-letter code. Returns code itself as fallback. */
const _countryCache = {};
async function getCountryName(code) {
  if (!code) return "";
  const KEY = code.toUpperCase().trim();
  if (_countryCache[KEY] !== undefined) return _countryCache[KEY];
  try {
    const c = await Country.findOne({ where: { code: KEY } });
    _countryCache[KEY] = c ? c.name.toUpperCase() : KEY;
  } catch (_) { _countryCache[KEY] = KEY; }
  return _countryCache[KEY];
}

/** XML-escape and uppercase */
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, " AND ")
    .replace(/[^A-Za-z0-9\s\.\-]/g, " ") // 11-Nov-2026: a comma / slash becomes a space - before "A-406,ROAD" went as "A-406ROAD"
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .toUpperCase();
}

/** XML-escape without forcing uppercase (for codes, booleans) */
function escRaw(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "");
}

/** Format a numeric value to fixed decimal places */
// IATA weights of a rate line (29-Oct-2026): unit KGM / LBR from the line's K / L (was always KGM, so a weight in lb
// went as kg), and when the chargeable weight is empty it is the higher of gross and volumetric weight rounded up to
// the next 0.5 kg / whole lb (was the gross weight as it is).
function wtUnit(rt) { return /^L/i.test(String((rt && rt.gwUnit) || '')) ? 'LBR' : 'KGM'; }
function chargeableOfLine(rt) {
  const g = parseFloat(rt.grossWeight) || 0;
  let v = parseFloat(rt.volumetricWeight) || ((parseFloat(rt.volume) || 0) * 1e6 / 6000);
  const lb = wtUnit(rt) === 'LBR';
  if (lb) v = v / 0.45359237;
  const c = Math.max(g, v);
  return lb ? Math.ceil(c - 1e-9) : Math.ceil(c * 2 - 1e-9) / 2;
}
function fmt(n, dec = 2) {
  return (parseFloat(n) || 0).toFixed(dec);
}
// 11-Nov-2026 helpers
// rate class letter: old lines were saved as "N - NORMAL RATE", which went into CategoryCode as it is
function rateCat(rt) { const v = String((rt && rt.rateClass) || "").trim().toUpperCase(); const m = /^SELECT/.test(v) ? null : v.match(/^[A-Z]/); return m ? m[0] : "Q"; }
// weight charge of the rating = the rate lines' amounts (ApplicableRating/TotalChargeAmount; was the grand total with other charges)
function lineAmountSum(lines) { return (lines || []).reduce((s, r) => s + (parseFloat(r.total || r.totalAmount) || 0), 0); }
// IATA cargo agent code: digits only, "14-3-5222" -> "1435222" (CargoAgentID went empty, from the account no.)
function iataAgentId(code, account) { const d = String(code || "").replace(/\D/g, ""); return d.length >= 7 ? d.slice(0, 11) : String(account || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 11); }
// charge code chosen on the screen (was always PX / CX)
const CHARGE_CODES = ["PP", "PX", "PE", "PG", "PZ", "CC", "CP", "CX", "CG", "CZ", "CM", "NC", "NP", "NX", "NT", "NG", "NZ", "CA", "CB", "CE", "CH", "PC", "PD", "PF", "PH"];
function chargeCodeOf(awb) { const c = String((awb && awb.chargeCode) || "").trim().toUpperCase(); return CHARGE_CODES.includes(c) ? c : "PP"; }
// carrier execution date = the executed date on the AWB (was the time of sending)
function executedDateTime(d) { const s = String(d || "").trim(); if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return isoNow(); const day = s.slice(0, 10); return day === isoNow().slice(0, 10) ? isoNow() : day + "T00:00:00"; }

/** Format a date string to ISO datetime format required by CargoXML */
function fmtDateTime(dt) {
  if (!dt) return "";
  if (dt.includes("T")) return dt;
  return dt + "T00:00:00";
}

/**
 * Format AWB number to IATA standard "prefix-serial" format.
 * e.g. "02012345678" → "020-12345678"
 * If already has dash, return as-is.
 */
function fmtAwb(awbNo) {
  if (!awbNo) return "";
  return String(awbNo).replace(/\D/g, "").substring(0, 11);
}

// ── Consol helpers (29-Oct-2026) ─────────────────────────────────────────────
// HAWB number as the house document ID. Before, fmtAwb() was used, which keeps digits only: DEL12345 went out as
// 12345 and ABC-001 as 001, so the airline / customs could not match the house.
function houseNo(no) {
  return String(no || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12);
}
// the live houses of a master, by its number (with or without the dash). Before: VOID houses were sent too, and the
// stale masterAwbId (it is not cleared when a house moves to another master or is unlinked) added houses of other masters.
async function liveHousesOf(mawb, include = true) {
  const bare = String(mawb.awbNumber || "").replace(/\D/g, "").substring(0, 11);
  const dash = bare.length === 11 ? `${bare.slice(0, 3)}-${bare.slice(3)}` : String(mawb.awbNumber || "");
  return HouseAWB.findAll({
    where: { masterAwbNumber: { [Op.in]: [...new Set([bare, dash, mawb.awbNumber].filter(Boolean))] }, status: { [Op.or]: [{ [Op.ne]: "VOID" }, null] } },
    ...(include ? { include: [{ all: true }] } : {}),
    order: [["id", "ASC"]],
  });
}
// weight unit of a house: LBR when its rate lines are in pounds (before always KGM)
function houseWtUnit(h) {
  const rl = (h && h.AwbRateLines) || [];
  return rl.length && rl.every(r => /^L/i.test(String(r.gwUnit || ""))) ? "LBR" : "KGM";
}
// gross weight of a house in kg (houses entered in pounds were added to kg masters as if kg)
function houseKg(h) {
  const w = parseFloat(h && h.grossWeight) || 0;
  return houseWtUnit(h) === "LBR" ? +(w * 0.45359237).toFixed(3) : w;
}
// fill the airport / country name caches for every house (only the master's were loaded, house names came out empty)
async function warmHouseNames(hawbs) {
  for (const h of hawbs) {
    if (h.origin) await getAirportName(h.origin);
    if (h.destination) await getAirportName(h.destination);
    if (h.shipperCountry) await getCountryName(h.shipperCountry);
    if (h.consigneeCountry) await getCountryName(h.consigneeCountry);
  }
}

/** Safely trim a string or return empty */
function safe(str) {
  if (!str) return "";
  return String(str).trim();
}

/**
 * Normalize cmIn unit code to valid UN/CEFACT code.
 * DB stores "CM" or "IN" → map to "CMT" or "INH".
 */
function normUnit(u) {
  if (!u) return "CMT";
  const v = u.toUpperCase().trim();
  if (v === "CM" || v === "CMT") return "CMT";
  if (v === "IN" || v === "INH" || v === "INCH") return "INH";
  if (v === "M"  || v === "MTR" || v === "METER") return "MTR";
  return "CMT"; // safe default
}

/**
 * Truncate a string to max length (for IATA field limits).
 */
function trunc(str, max) {
  if (!str) return "";
  return String(str).substring(0, max);
}

/**
 * Build DefinedTradeContact XML for a party.
 * Includes phone (DirectTelephoneCommunication) and email (URIEmailCommunication)
 * when available.
 */
function buildContact(phone, email, indent = "      ") {
  const parts = [];
  if (phone) {
    parts.push(`${indent}<ram:DirectTelephoneCommunication>
${indent}  <ram:CompleteNumber>${esc(phone)}</ram:CompleteNumber>
${indent}</ram:DirectTelephoneCommunication>`);
  }
  if (email) {
    parts.push(`${indent}<ram:URIEmailCommunication>
${indent}  <ram:URIID>${esc(email)}</ram:URIID>
${indent}</ram:URIEmailCommunication>`);
  }
  if (!parts.length) return "";
  return `${indent}<ram:DefinedTradeContact>
${parts.join("\n")}
${indent}</ram:DefinedTradeContact>`;
}

/** IATA Other Charge codes → human-readable Reason text (for XML <ram:Reason>) */
const CHARGE_REASONS = {
  // Airfreight & AWB
  AW: 'AIR WAYBILL FEE',     AV: 'AD VALOREM CHARGE',      RA: 'RATE COMBINATION',
  // Fuel & Security
  YQ: 'FUEL SURCHARGE',      FS: 'FUEL SURCHARGE',          MY: 'FUEL SURCHARGE',
  YR: 'CARRIER SURCHARGE',   SC: 'SECURITY CHARGE',         SB: 'SCREENING CHARGE',
  // Customs & Clearance
  CC: 'CUSTOMS CLEARANCE',   CK: 'CLEARANCE CHARGES',       CE: 'CUSTOMS EXAMINATION',
  CB: 'CUSTOMS BOND',        CD: 'CUSTOMS DECLARATION',
  // Destination & Handling
  DT: 'DESTINATION CHARGES', DC: 'DESTINATION CHARGE',      DA: 'DELIVERY AREA SURCHARGE',
  HT: 'HANDLING CHARGE',     GH: 'GROUND HANDLING CHARGE',  WH: 'WAREHOUSE CHARGE',
  TC: 'TERMINAL CHARGE',     AH: 'AFTER HOURS CHARGE',
  // Agent & Carrier
  OA: 'OTHER AGENT CHARGE',  OC: 'OTHER CARRIER CHARGE',    MX: 'MISCELLANEOUS CHARGE',
  // Surface & Special
  SU: 'SURFACE CHARGE',      SD: 'SPECIAL DELIVERY',        SG: 'SPECIAL HANDLING CHARGE',
  DG: 'DANGEROUS GOODS FEE', CH: 'COD FEE',                 EF: 'EXCESS BAGGAGE FEE',
  // Insurance & Valuation
  VA: 'VALUATION CHARGE',    IN: 'INSURANCE CHARGE',
  // Export & Documentary
  EX: 'EXPORT DOCUMENTATION',DO: 'DOCUMENTATION CHARGE',    ID: 'ICED/PERISHABLE CHARGE',
};



// ─────────────────────────────────────────────────────────────────────────────
// XFWB — Master Air Waybill (IATA Resolution 600a/600b, Version 3.00)
// ─────────────────────────────────────────────────────────────────────────────
async function generateXfwb(awbId, options = {}) {
  const awb = await Airwaybill.findByPk(awbId, { include: [{ all: true }] });
  if (!awb) throw new Error("AWB not found: " + awbId);

  const rateLines = awb.AwbRateLines      || [];
  const charges   = awb.AwbOtherCharges   || [];
  const sphCodes  = (awb.SpecialHandlingCodes || []).map(s => s.code).filter(Boolean);
  let ocis = awb.AwbOcis || [];


  const dims      = awb.AwbDimensions     || [];
  const fd        = awb.formData          || {};

  // ── Core fields ─────────────────────────────────────────────────────────────
  const awbNo    = fmtAwb(awb.awbNumber || "");
  const awbSerial = awbNo.includes('-') ? awbNo.split('-')[1] : awbNo;
  const currency = esc(awb.currencyCode || "USD");
  const isPP     = !(awb.chargeCode || "PP").startsWith("C");
  const totalGW  = fmt(awb.grossWeight  || 0, 1);
  const totalVol = fmt(awb.totalVolume  || 0, 3);
  const totalPcs = parseInt(awb.totalPieces) || 1;

  // ── Amendment / PurposeCode support ──────────────────────────────────────────
  const isAmendment    = options.amendment === true;
  const purposeCode    = isAmendment ? "Modification" : "Creation";
  const conversationID = isAmendment ? (options.originalMessageId || awbSerial) : "";

  // NVD / NCV / NII flags
  const nvd = !awb.declaredValueCarriage || awb.declaredValueCarriage === "NVD";
  const ncv = !awb.declaredValueCustoms  || awb.declaredValueCustoms  === "NCV";
  const nii = !awb.amountOfInsurance     || awb.amountOfInsurance     === "XXX";

  // Declared values (only emit if NOT NVD/NCV/NII)
  const declaredCarriage = nvd ? "" : esc(awb.declaredValueCarriage || "");
  const declaredCustoms  = ncv ? "" : esc(awb.declaredValueCustoms  || "");
  const insuranceAmt     = nii ? "" : esc(awb.amountOfInsurance     || "");

  // ── Agent / Sender details ──────────────────────────────────────────────────
  const agentName    = esc(awb.agentName      || "");
  const agentCode    = esc(awb.agentCode      || "");
  const agentAccount = esc(awb.agentAccountNo || "");
  const agentIata    = iataAgentId(awb.agentCode, awb.agentAccountNo);
  const chargeCode   = chargeCodeOf(awb);
  // forwarder (our) address from the company / branch master - the street and city went as the airport code "DEL"
  const co = typeof options.companyOf === "function" ? (await options.companyOf(awb.branchId).catch(() => null)) || {} : {};
  const coAddr = String(co.address || "");
  const coPin = (coAddr.match(/\b\d{6}\b/) || [""])[0];
  const coStreet = coAddr.replace(/,?\s*(India)\s*$/i, "").replace(/[-,]?\s*\b\d{6}\b/, "").split(",").map(x => x.trim()).filter(Boolean)
    .filter(x => !co.city || x.toUpperCase() !== String(co.city).toUpperCase()).join(", ");
  const agentPlace   = esc(awb.agentPlace || fd.agentPlace || awb.origin || "");
  const agentDocs    = esc(awb.agentDocs  || fd.agentDocs || "");

  // ── Sender/Recipient from DB config ─────────────────────────────────────────
  const senderGLN    = esc(awb.agentCode || await getSetting('van_sender_pima') || await getSetting('sftp_username', 'CCCAGENT'));
  const recipientGLN = esc(await getSetting('van_recipient_id', 'TDVAIR01GLNDTCR'));

  // ── Consolidation flag ───────────────────────────────────────────────────────
  const isConsolidated = (awb.type === "MAWB") || (awb.awbType === "MAWB") || !!awb.parentAwb || !!fd.isConsolidated; // awbType: the type column is empty (11-Nov-2026)

  // ── ProductID (CON for consolidation, EXC for express, GEN otherwise) ────────
  const productId = esc(fd.productId || awb.productId || (isConsolidated ? "CON" : "GEN"));

  // ── SCI (Special Customs Information) ───────────────────────────────────────
  const sciCode = esc(awb.sci || "");

  // ── Airport names from DB ───────────────────────────────────────────────────
  const originName = await getAirportName(awb.origin);
  const destName   = await getAirportName(awb.destination);

  // ── Country names from DB ────────────────────────────────────────────────────
  const shipperCountryName   = await getCountryName(awb.shipperCountry   || "IN");
  const consigneeCountryName = await getCountryName(awb.consigneeCountry || "");
  const agentCountryName     = await getCountryName(awb.agentCountry || awb.shipperCountry || "IN");

  // ── Routing legs ─────────────────────────────────────────────────────────────
  const legs = [];
  const routingPoints = [esc(awb.origin || "")];

  // Note: Model has flightNumber1 and flightNumber2 only.
  // flightNumber3 is stored in formData or fd.flight3 — read from there.
  const flightNumbers = [
    safe(awb.flightNumber1 || fd.flight1 || ""),
    safe(awb.flightNumber2 || fd.flight2 || ""),
    safe(fd.flight3        || fd.flightNumber3 || ""),
  ];
  const flightDates = [
    safe(awb.flightDate1 || fd.flightDate1 || ""),
    safe(awb.flightDate2 || fd.flightDate2 || ""),
    safe(fd.flightDate3  || ""),
  ];
  const arrivalDates = [
    safe(fd.arrivalDate1 || ""),
    safe(fd.arrivalDate2 || ""),
    safe(fd.arrivalDate3 || ""),
  ];

  for (let i = 0; i < 3; i++) {
    const airline = safe(awb["by" + (i + 1)] || fd["by" + (i + 1)] || "");
    const toApt   = safe(awb["to" + (i + 1)] || fd["to" + (i + 1)] || (i === 0 ? awb.destination || "" : ""));
    const flight  = flightNumbers[i];
    const depDt   = flightDates[i];
    const arrDt   = arrivalDates[i];

    if (airline || flight) {
      const depApt = routingPoints[routingPoints.length - 1];
      const arrApt = esc(toApt) || esc(awb.destination || "");
      legs.push({ airline: esc(airline), flight: esc(flight), depApt, arrApt, depDt: esc(depDt), arrDt: esc(arrDt), seq: i + 1 });
      routingPoints.push(arrApt);
    }
  }

  if (legs.length === 0) {
    legs.push({
      airline: esc(awb.by1 || fd.by1 || ""),
      flight:  esc(awb.flightNumber1 || ""),
      depApt:  esc(awb.origin || ""),
      arrApt:  esc(awb.destination || ""),
      depDt:   esc(awb.flightDate1 || ""),
      arrDt:   "",
      seq: 1
    });
  }

  // ── Accounting notes ──────────────────────────────────────────────────────────
  const accountingInfo  = safe(awb.accountingInformation || fd.accountingInformation || fd.accountingInfo || (isPP ? "FREIGHT PREPAID" : "FREIGHT COLLECT")); // was always PREPAID
  const accountingNotes = accountingInfo
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => `    <ram:IncludedAccountingNote>
      <ram:ContentCode>GEN</ram:ContentCode>
      <ram:Content>${esc(line)}</ram:Content>
    </ram:IncludedAccountingNote>`).join("\n");

  // ── OSI/Handling instructions — merged to avoid duplicates ───────────────────
  const osiParts = [];
  if (awb.osi) osiParts.push(esc(awb.osi));
  if (awb.handlingInformation && awb.handlingInformation !== awb.osi) {
    osiParts.push(esc(awb.handlingInformation));
  }
  const osiXml = osiParts.map(txt =>
    `    <ram:HandlingOSIInstructions>
      <ram:Description>${txt}</ram:Description>
    </ram:HandlingOSIInstructions>`
  ).join("\n");

  // ── SSR (Special Service Request) — DescriptionCode uses short code ───────────
  // SSR field may contain "EIC SHIPPER CERT..." — extract first word as code
  const ssrXml = awb.ssr ? (() => {
    const ssrText = awb.ssr.trim();
    const ssrCode = ssrText.split(/\s+/)[0].toUpperCase().substring(0, 4); // max 4-char code
    return `    <ram:HandlingSSRInstructions>
      <ram:Description>${esc(ssrText)}</ram:Description>
      <ram:DescriptionCode>${escRaw(ssrCode)}</ram:DescriptionCode>
    </ram:HandlingSSRInstructions>`;
  })() : "";

  // ── SPH codes ─────────────────────────────────────────────────────────────────
  const sphXml = sphCodes.map(c =>
    `    <ram:HandlingSPHInstructions><ram:DescriptionCode>${esc(c)}</ram:DescriptionCode></ram:HandlingSPHInstructions>`
  ).join("\n");

  // ── OCI (Other Customs Information) ───────────────────────────────────────────
  // rows without information (only a country picked) were sent as empty customs notes (29-Oct-2026)
  const ocisXml = ocis.filter(o => String(o.suppInfo || '').trim()).map(o => {
    return `    <ram:IncludedCustomsNote>
        <ram:ContentCode>${esc(o.customsId)}</ram:ContentCode>
        <ram:Content>${esc(o.suppInfo)}</ram:Content>
        <ram:SubjectCode>${esc(o.infoId)}</ram:SubjectCode>
        <ram:CountryID>${esc(o.countryCode)}</ram:CountryID>
    </ram:IncludedCustomsNote>`;
  }).join("\n");

  // ── Agent docs: moved to IncludedHeaderNote (non-standard element removed) ─────
  const agentDocsNoteXml = agentDocs ? `    <ram:IncludedHeaderNote>
      <ram:ContentCode>DOC</ram:ContentCode>
      <ram:Content>${agentDocs}</ram:Content>
    </ram:IncludedHeaderNote>` : "";

  // ── Routing legs XML ──────────────────────────────────────────────────────────
  const legsXml = legs.map(leg => `    <ram:SpecifiedLogisticsTransportMovement>
      <ram:StageCode>Main-carriage</ram:StageCode>
      <ram:ModeCode>Air</ram:ModeCode>
      <ram:ID>${leg.flight}</ram:ID>
      <ram:SequenceNumeric>${leg.seq}</ram:SequenceNumeric>
      <ram:UsedLogisticsTransportMeans><ram:Name>${leg.airline}</ram:Name></ram:UsedLogisticsTransportMeans>
      <ram:DepartureEvent>
        ${leg.depDt ? `<ram:ScheduledOccurrenceDateTime>${fmtDateTime(leg.depDt)}</ram:ScheduledOccurrenceDateTime>` : ""}
        <ram:OccurrenceDepartureLocation>
          <ram:ID>${leg.depApt}</ram:ID>
          <ram:TypeCode>Airport</ram:TypeCode>
        </ram:OccurrenceDepartureLocation>
      </ram:DepartureEvent>
      <ram:ArrivalEvent>
        ${leg.arrDt ? `<ram:ScheduledOccurrenceDateTime>${fmtDateTime(leg.arrDt)}</ram:ScheduledOccurrenceDateTime>` : ""}
        <ram:OccurrenceArrivalLocation>
          <ram:ID>${leg.arrApt}</ram:ID>
          <ram:TypeCode>Airport</ram:TypeCode>
        </ram:OccurrenceArrivalLocation>
      </ram:ArrivalEvent>
    </ram:SpecifiedLogisticsTransportMovement>`).join("\n");

  // ── Rate lines ────────────────────────────────────────────────────────────────
  // Determine overall TypeCode for ApplicableRating
  const anyRateAsAgreed = rateLines.some(rt => rt.rateAsAgreed);
  const ratingTypeCode  = anyRateAsAgreed ? "A" : "F";

  const rateLinesXml = rateLines.length > 0
    ? rateLines.map((rt, i) => {
        const gw  = fmt(rt.grossWeight, 1);
        const cw  = fmt(parseFloat(rt.chargeableWeight) || chargeableOfLine(rt), 1);
        const wu  = wtUnit(rt);
        const vol = fmt(rt.volume || 0, 3);
        const pcs = parseInt(rt.pieces) || 1;
        // Determine rate category code
        let catCode = rateCat(rt);
        if (rt.rateAsAgreed) catCode = "A"; // As Agreed

        // Dimension lines if present in AwbDimension table
        const rtDims = dims.filter(d => d.rateLineIndex === i);
        const dimXml = rtDims.length > 0 ? rtDims.map(d => `            <ram:LinearSpatialDimension>
              <ram:WidthMeasure unitCode="${normUnit(d.cmIn)}">${fmt(d.width, 2)}</ram:WidthMeasure>
              <ram:LengthMeasure unitCode="${normUnit(d.cmIn)}">${fmt(d.length, 2)}</ram:LengthMeasure>
              <ram:HeightMeasure unitCode="${normUnit(d.cmIn)}">${fmt(d.height, 2)}</ram:HeightMeasure>
            </ram:LinearSpatialDimension>`).join("\n") : "";

        // Inline dimensions from rateline itself if no separate dim records
        const hasInlineDims = !rtDims.length && rt.length && rt.width && rt.height;
        const inlineDimXml = hasInlineDims ? `            <ram:LinearSpatialDimension>
              <ram:WidthMeasure unitCode="${normUnit(rt.cmIn)}">${fmt(rt.width, 2)}</ram:WidthMeasure>
              <ram:LengthMeasure unitCode="${normUnit(rt.cmIn)}">${fmt(rt.length, 2)}</ram:LengthMeasure>
              <ram:HeightMeasure unitCode="${normUnit(rt.cmIn)}">${fmt(rt.height, 2)}</ram:HeightMeasure>
            </ram:LinearSpatialDimension>` : "";

        return `        <ram:IncludedMasterConsignmentItem>
          <ram:SequenceNumeric>${i + 1}</ram:SequenceNumeric>
          ${rt.harmonisedCode ? `<ram:TypeCode>${esc(rt.harmonisedCode)}</ram:TypeCode>` : ""}
          <ram:GrossWeightMeasure unitCode="${wu}">${gw}</ram:GrossWeightMeasure>
          ${parseFloat(vol) > 0 ? `<ram:GrossVolumeMeasure unitCode="MTQ">${vol}</ram:GrossVolumeMeasure>` : ""}
          <ram:PieceQuantity>${pcs}</ram:PieceQuantity>
          ${rt.information ? `<ram:Information>${esc(trunc(rt.information, 17))}</ram:Information>` : ""}
          ${rt.slac ? `<ram:SlacPieceQuantity>${parseInt(rt.slac) || 0}</ram:SlacPieceQuantity>` : ""}
          <ram:NatureIdentificationTransportCargo>
            <ram:Identification>${esc(trunc(rt.natureOfGoods, 70))}</ram:Identification>
          </ram:NatureIdentificationTransportCargo>
          ${dimXml}${inlineDimXml}
          <ram:ApplicableFreightRateServiceCharge>
            <ram:CategoryCode>${catCode}</ram:CategoryCode>
            ${rt.commodityItemNo ? `<ram:CommodityItemNumber>${esc(rt.commodityItemNo)}</ram:CommodityItemNumber>` : ""}
            <ram:ChargeableWeightMeasure unitCode="${wu}">${cw}</ram:ChargeableWeightMeasure>
            <ram:AppliedRate>${fmt(rt.rateCharge)}</ram:AppliedRate>
            <ram:AppliedAmount currencyID="${currency}">${fmt(rt.total)}</ram:AppliedAmount>
          </ram:ApplicableFreightRateServiceCharge>
        </ram:IncludedMasterConsignmentItem>`;
      }).join("\n")
    : `        <ram:IncludedMasterConsignmentItem>
          <ram:SequenceNumeric>1</ram:SequenceNumeric>
          <ram:GrossWeightMeasure unitCode="KGM">${totalGW}</ram:GrossWeightMeasure>
          ${parseFloat(totalVol) > 0 ? `<ram:GrossVolumeMeasure unitCode="MTQ">${totalVol}</ram:GrossVolumeMeasure>` : ""}
          <ram:PieceQuantity>${totalPcs}</ram:PieceQuantity>
          <ram:NatureIdentificationTransportCargo>
            <ram:Identification>${esc(trunc(awb.natureOfGoods || fd.natureOfGoods || "GENERAL CARGO", 70))}</ram:Identification>
          </ram:NatureIdentificationTransportCargo>
          <ram:ApplicableFreightRateServiceCharge>
            <ram:CategoryCode>Q</ram:CategoryCode>
            <ram:ChargeableWeightMeasure unitCode="KGM">${totalGW}</ram:ChargeableWeightMeasure>
            <ram:AppliedRate>${fmt(0)}</ram:AppliedRate>
            <ram:AppliedAmount currencyID="${currency}">${fmt((parseFloat(awb.weightChargePP) || 0) + (parseFloat(awb.weightChargeCC) || 0))}</ram:AppliedAmount>
          </ram:ApplicableFreightRateServiceCharge>
        </ram:IncludedMasterConsignmentItem>`;

  // ── Other charges ─────────────────────────────────────────────────────────────
  const chargesXml = charges
    .filter(c => c.chargeCode && parseFloat(c.amount || 0) !== 0)
    .map(c => `    <ram:ApplicableLogisticsAllowanceCharge>
      <ram:ID>${esc(c.chargeCode)}</ram:ID>
      <ram:PrepaidIndicator>${c.ppcc !== "CC"}</ram:PrepaidIndicator>
      <ram:Reason>${esc(CHARGE_REASONS[c.chargeCode] || c.description || c.chargeCode)}</ram:Reason>
      <ram:PartyTypeCode>${(c.entitlement || "C").toUpperCase().charAt(0)}</ram:PartyTypeCode>
      <ram:ActualAmount currencyID="${currency}">${fmt(c.amount)}</ram:ActualAmount>
    </ram:ApplicableLogisticsAllowanceCharge>`).join("\n");

  // ── Charge summary ────────────────────────────────────────────────────────────
  const weightChargePP = fmt(awb.weightChargePP || 0);
  const weightChargeCC = fmt(awb.weightChargeCC || 0);
  const valChargePP    = fmt(awb.valChargePP    || 0);
  const valChargeCC    = fmt(awb.valChargeCC    || 0);
  const taxPP          = fmt(awb.taxPP          || 0);
  const taxCC          = fmt(awb.taxCC          || 0);

  const dueAgentPP   = charges.filter(c => c.ppcc !== "CC" && (c.entitlement || "C").toUpperCase().startsWith("A")).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
  const dueCarrierPP = charges.filter(c => c.ppcc !== "CC" && !(c.entitlement || "C").toUpperCase().startsWith("A")).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
  const dueAgentCC   = charges.filter(c => c.ppcc === "CC" && (c.entitlement || "C").toUpperCase().startsWith("A")).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
  const dueCarrierCC = charges.filter(c => c.ppcc === "CC" && !(c.entitlement || "C").toUpperCase().startsWith("A")).reduce((s, c) => s + parseFloat(c.amount || 0), 0);

  const grandPP = parseFloat(awb.weightChargePP || 0) + parseFloat(awb.valChargePP || 0) + parseFloat(awb.taxPP || 0) + dueAgentPP + dueCarrierPP;
  const grandCC = parseFloat(awb.weightChargeCC || 0) + parseFloat(awb.valChargeCC || 0) + parseFloat(awb.taxCC || 0) + dueAgentCC + dueCarrierCC;
  const totalPP = fmt(grandPP);
  const totalCC = fmt(grandCC);

  const ccDest       = fmt(awb.ccChargesDest  || 0);
  const destCurrency = esc(awb.destinationCurrency || awb.currencyCode || "USD");

  // ── Contact blocks ────────────────────────────────────────────────────────────
  const shipperContact  = buildContact(awb.shipperPhone,   fd.shipperEmail   || awb.shipperEmail,   "      ");
  const consigneeContact= buildContact(awb.consigneePhone, fd.consigneeEmail || awb.consigneeEmail, "      ");

  // ─────────────────────────────────────────────────────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<awb:Waybill xmlns:rsm="iata:response:1" xmlns:awb="iata:waybill:1"
             xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:8"
             xmlns:ram="iata:datamodel:3"
             xmlns:ccts="urn:un:unece:uncefact:documentation:standard:CoreComponentsTechnicalSpecification:2"
             xsi:schemaLocation="iata:waybill:1 Waybill_1.xsd"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <awb:MessageHeaderDocument>
    <ram:ID>${awbSerial}</ram:ID>
    <ram:Name>${isConsolidated ? "Master Air Waybill" : "Air Waybill"}</ram:Name>
    <ram:TypeCode>${isConsolidated ? "741" : "740"}</ram:TypeCode>
    <ram:IssueDateTime>${isoNow()}</ram:IssueDateTime>
    <ram:PurposeCode>${purposeCode}</ram:PurposeCode>
    <ram:VersionID>3.00</ram:VersionID>
    ${conversationID ? `<ram:ConversationID>${escRaw(conversationID)}</ram:ConversationID>` : `<ram:ConversationID/>`}
    <ram:SenderParty><ram:PrimaryID schemeID="C">${senderGLN}</ram:PrimaryID></ram:SenderParty>
    <ram:RecipientParty><ram:PrimaryID schemeID="C">${recipientGLN}</ram:PrimaryID></ram:RecipientParty>
  </awb:MessageHeaderDocument>
  <awb:BusinessHeaderDocument>
    <ram:ID>${awbNo}</ram:ID>
    <ram:SenderAssignedID/>
    ${sciCode ? `<ram:IncludedHeaderNote>
      <ram:ContentCode>SCI</ram:ContentCode>
      <ram:Content>${sciCode}</ram:Content>
    </ram:IncludedHeaderNote>` : ""}
    ${isConsolidated ? `<ram:IncludedHeaderNote>
      <ram:ContentCode>CON</ram:ContentCode>
      <ram:Content>Consolidated</ram:Content>
    </ram:IncludedHeaderNote>` : ""}
    ${agentDocsNoteXml}
    <ram:SignatoryConsignorAuthentication>
      <ram:Signatory>${esc(trunc(awb.signatureShipper || awb.shipperName, 35))}</ram:Signatory>
    </ram:SignatoryConsignorAuthentication>
    <ram:SignatoryCarrierAuthentication>
      <ram:ActualDateTime>${executedDateTime(awb.executedDate)}</ram:ActualDateTime>
      <ram:Signatory>${agentCode || agentName}</ram:Signatory>
      <ram:IssueAuthenticationLocation><ram:Name>${esc(awb.executedPlace || awb.origin)}</ram:Name></ram:IssueAuthenticationLocation>
    </ram:SignatoryCarrierAuthentication>
  </awb:BusinessHeaderDocument>
  <awb:MasterConsignment>
    <ram:ID>${awbNo}</ram:ID>
    <ram:NilCarriageValueIndicator>${nvd}</ram:NilCarriageValueIndicator>
    <ram:NilCustomsValueIndicator>${ncv}</ram:NilCustomsValueIndicator>
    <ram:NilInsuranceValueIndicator>${nii}</ram:NilInsuranceValueIndicator>
    ${declaredCarriage ? `<ram:DeclaredValueForCarriageAmount currencyID="${currency}">${declaredCarriage}</ram:DeclaredValueForCarriageAmount>` : ""}
    ${declaredCustoms  ? `<ram:DeclaredValueForCustomsAmount currencyID="${currency}">${declaredCustoms}</ram:DeclaredValueForCustomsAmount>`  : ""}
    ${insuranceAmt     ? `<ram:InsuranceValueAmount currencyID="${currency}">${insuranceAmt}</ram:InsuranceValueAmount>`                       : ""}
    <ram:TotalChargePrepaidIndicator>${isPP}</ram:TotalChargePrepaidIndicator>
    <ram:IncludedTareGrossWeightMeasure unitCode="KGM">${totalGW}</ram:IncludedTareGrossWeightMeasure>
    ${parseFloat(totalVol) > 0 ? `<ram:GrossVolumeMeasure unitCode="MTQ">${totalVol}</ram:GrossVolumeMeasure>` : ""}
    <ram:PackageQuantity>${totalPcs}</ram:PackageQuantity>
    <ram:TotalPieceQuantity>${totalPcs}</ram:TotalPieceQuantity>
    <ram:ProductID>${productId}</ram:ProductID>
    <ram:ConsignorParty>
      <ram:Name>${esc(trunc(awb.shipperName, 35))}</ram:Name>
      <ram:PostalStructuredAddress>
        ${awb.shipperZip     ? `<ram:PostcodeCode>${esc(trunc(awb.shipperZip, 9))}</ram:PostcodeCode>` : ""}
        ${awb.shipperAddress ? `<ram:StreetName>${esc(trunc(awb.shipperAddress, 35))}</ram:StreetName>` : ""}
        <ram:CityName>${esc(trunc(awb.shipperCity || awb.origin, 17))}</ram:CityName>
        ${awb.shipperState   ? `<ram:CountrySubDivisionName>${esc(trunc(awb.shipperState, 9))}</ram:CountrySubDivisionName>` : ""}
        <ram:CountryID>${esc(awb.shipperCountry || "IN")}</ram:CountryID>
        <ram:CountryName>${esc(shipperCountryName)}</ram:CountryName>
      </ram:PostalStructuredAddress>
      ${shipperContact}
    </ram:ConsignorParty>
    <ram:ConsigneeParty>
      <ram:Name>${esc(trunc(awb.consigneeName, 35))}</ram:Name>
      <ram:PostalStructuredAddress>
        ${awb.consigneeZip     ? `<ram:PostcodeCode>${esc(trunc(awb.consigneeZip, 9))}</ram:PostcodeCode>` : ""}
        ${awb.consigneeAddress ? `<ram:StreetName>${esc(trunc(awb.consigneeAddress, 35))}</ram:StreetName>` : ""}
        <ram:CityName>${esc(trunc(awb.consigneeCity || awb.destination, 17))}</ram:CityName>
        ${awb.consigneeState   ? `<ram:CountrySubDivisionName>${esc(trunc(awb.consigneeState, 9))}</ram:CountrySubDivisionName>` : ""}
        <ram:CountryID>${esc(awb.consigneeCountry || "")}</ram:CountryID>
        ${consigneeCountryName ? `<ram:CountryName>${esc(consigneeCountryName)}</ram:CountryName>` : ""}
      </ram:PostalStructuredAddress>
      ${consigneeContact}
    </ram:ConsigneeParty>
    <ram:FreightForwarderParty>
      <ram:Name>${agentName}</ram:Name>
      <ram:CargoAgentID>${agentIata}</ram:CargoAgentID>
      <ram:FreightForwarderAddress>
        ${coPin ? `<ram:PostcodeCode>${coPin}</ram:PostcodeCode>` : ""}
        ${coStreet ? `<ram:StreetName>${esc(trunc(coStreet, 35))}</ram:StreetName>` : ""}
        <ram:CityName>${esc(trunc(co.city || awb.agentCity || awb.executedPlace || agentPlace || awb.origin, 17))}</ram:CityName>
        <ram:CountryID>${esc(awb.agentCountry || awb.shipperCountry || "IN")}</ram:CountryID>
        <ram:CountryName>${esc(agentCountryName)}</ram:CountryName>
      </ram:FreightForwarderAddress>
      ${fd.agentLocationCode ? `<ram:SpecifiedCargoAgentLocation><ram:ID>${esc(fd.agentLocationCode)}</ram:ID></ram:SpecifiedCargoAgentLocation>` : ""}
    </ram:FreightForwarderParty>
    <ram:OriginLocation>
      <ram:ID>${esc(awb.origin)}</ram:ID>
      ${originName ? `<ram:Name>${esc(originName)}</ram:Name>` : ""}
    </ram:OriginLocation>
    <ram:FinalDestinationLocation>
      <ram:ID>${esc(awb.destination)}</ram:ID>
      ${destName ? `<ram:Name>${esc(destName)}</ram:Name>` : ""}
    </ram:FinalDestinationLocation>
${legsXml}
${sphXml}
${ssrXml}
${osiXml}
${accountingNotes}
${ocisXml}
    <ram:ApplicableOriginCurrencyExchange>
      <ram:SourceCurrencyCode>${currency}</ram:SourceCurrencyCode>
    </ram:ApplicableOriginCurrencyExchange>
    <ram:ApplicableLogisticsServiceCharge>
      <ram:TransportPaymentMethodCode>${chargeCode}</ram:TransportPaymentMethodCode>
    </ram:ApplicableLogisticsServiceCharge>
${chargesXml}
    <ram:ApplicableRating>
      <ram:TypeCode>${ratingTypeCode}</ram:TypeCode>
      <ram:TotalChargeAmount currencyID="${currency}">${fmt(rateLines.length ? lineAmountSum(rateLines) : (parseFloat(awb.weightChargePP) || 0) + (parseFloat(awb.weightChargeCC) || 0))}</ram:TotalChargeAmount>
      <ram:ConsignmentItemQuantity>${rateLines.length || 1}</ram:ConsignmentItemQuantity>
${rateLinesXml}
    </ram:ApplicableRating>
    <ram:ApplicableTotalRating>
      <ram:TypeCode>${ratingTypeCode}</ram:TypeCode>
      <ram:ApplicableDestinationCurrencyServiceCharge>
        <ram:CollectAppliedAmount currencyID="${destCurrency}">${ccDest}</ram:CollectAppliedAmount>
        <ram:DestinationAppliedAmount currencyID="${destCurrency}">${ccDest}</ram:DestinationAppliedAmount>
        <ram:TotalAppliedAmount currencyID="${destCurrency}">${ccDest}</ram:TotalAppliedAmount>
      </ram:ApplicableDestinationCurrencyServiceCharge>
      <ram:ApplicablePrepaidCollectMonetarySummation>
        <ram:PrepaidIndicator>true</ram:PrepaidIndicator>
        <ram:WeightChargeTotalAmount currencyID="${currency}">${weightChargePP}</ram:WeightChargeTotalAmount>
        ${parseFloat(valChargePP) > 0 ? `<ram:ValuationChargeTotalAmount currencyID="${currency}">${valChargePP}</ram:ValuationChargeTotalAmount>` : ""}
        ${parseFloat(taxPP) > 0 ? `<ram:TaxTotalAmount currencyID="${currency}">${taxPP}</ram:TaxTotalAmount>` : ""}
        ${dueAgentPP > 0 ? `<ram:AgentTotalDuePayableAmount currencyID="${currency}">${fmt(dueAgentPP)}</ram:AgentTotalDuePayableAmount>` : ""}
        ${dueCarrierPP > 0 ? `<ram:CarrierTotalDuePayableAmount currencyID="${currency}">${fmt(dueCarrierPP)}</ram:CarrierTotalDuePayableAmount>` : ""}
        <ram:GrandTotalAmount currencyID="${currency}">${totalPP}</ram:GrandTotalAmount>
      </ram:ApplicablePrepaidCollectMonetarySummation>
      <ram:ApplicablePrepaidCollectMonetarySummation>
        <ram:PrepaidIndicator>false</ram:PrepaidIndicator>
        <ram:WeightChargeTotalAmount currencyID="${currency}">${weightChargeCC}</ram:WeightChargeTotalAmount>
        ${parseFloat(valChargeCC) > 0 ? `<ram:ValuationChargeTotalAmount currencyID="${currency}">${valChargeCC}</ram:ValuationChargeTotalAmount>` : ""}
        ${parseFloat(taxCC) > 0 ? `<ram:TaxTotalAmount currencyID="${currency}">${taxCC}</ram:TaxTotalAmount>` : ""}
        ${dueAgentCC > 0 ? `<ram:AgentTotalDuePayableAmount currencyID="${currency}">${fmt(dueAgentCC)}</ram:AgentTotalDuePayableAmount>` : ""}
        ${dueCarrierCC > 0 ? `<ram:CarrierTotalDuePayableAmount currencyID="${currency}">${fmt(dueCarrierCC)}</ram:CarrierTotalDuePayableAmount>` : ""}
        <ram:GrandTotalAmount currencyID="${currency}">${totalCC}</ram:GrandTotalAmount>
      </ram:ApplicablePrepaidCollectMonetarySummation>
    </ram:ApplicableTotalRating>
  </awb:MasterConsignment>
</awb:Waybill>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// XFHL — House Manifest (IATA, Version 2.00)
// ─────────────────────────────────────────────────────────────────────────────
async function generateXfhl(masterAwbId, options = {}) {
  const mawb = await Airwaybill.findByPk(masterAwbId);
  if (!mawb) throw new Error("Master AWB not found: " + masterAwbId);

  // Normalize AWB number for lookup — match both "020-12345678" and "02012345678"
  // Fix 28-Oct-2026: fmtAwb() strips the dash, so both variants were "02012345678" and houses saved
  // with "020-12345678" were never found. Build the real dashed form as well.
  const mawbWithoutDash = (mawb.awbNumber || "").replace(/\D/g, "").substring(0, 11); // "02012345678"
  const mawbWithDash    = mawbWithoutDash.length === 11 ? `${mawbWithoutDash.slice(0, 3)}-${mawbWithoutDash.slice(3)}` : (mawb.awbNumber || ""); // "020-12345678"

  void mawbWithDash; // kept for reference; liveHousesOf() builds both forms
  let hawbs = await liveHousesOf(mawb);
  if (options.onlyHouseId) hawbs = hawbs.filter(h => String(h.id) === String(options.onlyHouseId)); // one house (XFZB)
  await warmHouseNames(hawbs);

  const awbNo    = fmtAwb(mawb.awbNumber || "");
  const totalGW  = fmt(mawb.grossWeight || 0, 2);
  const totalPcs = parseInt(mawb.totalPieces) || hawbs.reduce((s, h) => s + (parseInt(h.totalPieces) || 1), 0);

  // Sender/Recipient from DB settings — use schemeID="C" consistently
  const senderID    = esc(mawb.agentCode || await getSetting('van_sender_pima') || await getSetting('sftp_username', 'CCCAGENT'));
  const recipientID = esc(await getSetting('van_recipient_id', 'TDVAIR01GLNDTCR'));

  const originCurrency = esc(mawb.currencyCode || "USD");
  const destCurrency   = esc(mawb.destinationCurrency || originCurrency);

  // ── Airport names from DB (fix: was erroneously using currency code as Name) ─
  const originName = await getAirportName(mawb.origin);
  const destName   = await getAirportName(mawb.destination);

  // ── Amendment support ───────────────────────────────────────────────────────
  const isAmendment    = options.amendment === true;
  const purposeCode    = isAmendment ? "Modification" : "Creation";
  const conversationID = isAmendment ? (options.originalMessageId || awbNo) : "";

  // ── Build house consignment XML ───────────────────────────────────────────────
  const houseXml = hawbs.length === 0
    ? `    <ram:IncludedHouseConsignment>
      <ram:SequenceNumeric>1</ram:SequenceNumeric>
      <ram:SummaryDescription>NO HOUSE WAYBILLS LINKED</ram:SummaryDescription>
      <ram:TransportContractDocument><ram:ID>NONE</ram:ID></ram:TransportContractDocument>
      <ram:OriginLocation><ram:ID>${esc(mawb.origin)}</ram:ID>${originName ? `<ram:Name>${esc(originName)}</ram:Name>` : ""}</ram:OriginLocation>
      <ram:FinalDestinationLocation><ram:ID>${esc(mawb.destination)}</ram:ID>${destName ? `<ram:Name>${esc(destName)}</ram:Name>` : ""}</ram:FinalDestinationLocation>
    </ram:IncludedHouseConsignment>`
    : hawbs.map((h, idx) => {
        const hRL   = h.AwbRateLines      || [];
        const hSph  = (h.SpecialHandlingCodes || []).map(s => s.code).filter(Boolean);
        const hOci  = h.AwbOcis            || [];
        const hChg  = h.AwbOtherCharges    || [];
        const fd    = h.formData           || {};

        const hGW   = fmt(h.grossWeight  || hRL.reduce((s, r) => s + parseFloat(r.grossWeight || 0), 0), 2);
        const hVol  = fmt(h.totalVolume  || hRL.reduce((s, r) => s + parseFloat(r.volume || 0), 0), 3);
        const hPcs  = parseInt(h.totalPieces) || hRL.reduce((s, r) => s + parseInt(r.pieces || 0, 10), 0) || 1;
        const desc  = esc(trunc((hRL[0]?.natureOfGoods || h.natureOfGoods || fd.natureOfGoods || "GENERAL CARGO").toUpperCase(), 70));
        const hCurr = esc(h.currencyCode || mawb.currencyCode || "USD");
        const hIsPP = !(h.chargeCode || "PP").startsWith("C");

        const hNvd  = !h.declaredValueCarriage || h.declaredValueCarriage === "NVD";
        const hNcv  = !h.declaredValueCustoms  || h.declaredValueCustoms  === "NCV";
        const hNii  = !h.amountOfInsurance     || h.amountOfInsurance     === "XXX";

        // Airport names for house origin/destination
        // (resolved synchronously from cache — already pre-warmed for mawb)
        const hOriginName = _airportCache[(h.origin || mawb.origin || "").toUpperCase()] || originName || "";
        const hDestName   = _airportCache[(h.destination || mawb.destination || "").toUpperCase()] || destName || "";

        // Country names
        const hShipperCountryCode = h.shipperCountry || "IN";
        const hShipperCountryName = _countryCache[hShipperCountryCode.toUpperCase()] || "";
        const hConsCountryCode    = h.consigneeCountry || "";
        const hConsCountryName    = hConsCountryCode ? (_countryCache[hConsCountryCode.toUpperCase()] || "") : "";
        const hUnit = houseWtUnit(h);

        // SPH codes for house
        const hSphXml = hSph.map(c =>
          `      <ram:HandlingSPHInstructions><ram:DescriptionCode>${esc(c)}</ram:DescriptionCode></ram:HandlingSPHInstructions>`
        ).join("\n");

        // OCI for house
        const hOciXml = hOci.filter(o => String(o.suppInfo || '').trim()).map(o => {
          return `      <ram:IncludedCustomsNote>
        <ram:ContentCode>${esc(o.customsId)}</ram:ContentCode>
        <ram:Content>${esc(o.suppInfo)}</ram:Content>
        <ram:SubjectCode>${esc(o.infoId)}</ram:SubjectCode>
        <ram:CountryID>${esc(o.countryCode)}</ram:CountryID>
      </ram:IncludedCustomsNote>`;
        }).join("\n");

        // OSI/Handling for house — merged to avoid duplicates
        const hOsiParts = [];
        if (h.osi) hOsiParts.push(esc(h.osi));
        if (h.handlingInformation && h.handlingInformation !== h.osi) hOsiParts.push(esc(h.handlingInformation));
        const hOsiXml = hOsiParts.map(txt =>
          `      <ram:HandlingOSIInstructions><ram:Description>${txt}</ram:Description></ram:HandlingOSIInstructions>`
        ).join("\n");

        // SSR for house — use first word as code
        const hSsrXml = h.ssr ? (() => {
          const ssrText = h.ssr.trim();
          const ssrCode = ssrText.split(/\s+/)[0].toUpperCase().substring(0, 4);
          return `      <ram:HandlingSSRInstructions><ram:Description>${esc(ssrText)}</ram:Description><ram:DescriptionCode>${escRaw(ssrCode)}</ram:DescriptionCode></ram:HandlingSSRInstructions>`;
        })() : "";

        // Rate lines for house
        const hRateXml = hRL.length > 0
          ? hRL.map((rt, ri) => {
              const cw = fmt(parseFloat(rt.chargeableWeight) || chargeableOfLine(rt), 1);
              let catCode = rateCat(rt);
              if (rt.rateAsAgreed) catCode = "A";
              return `      <ram:ApplicableFreightRateServiceCharge>
        <ram:CategoryCode>${catCode}</ram:CategoryCode>
        ${rt.commodityItemNo ? `<ram:CommodityItemNumber>${esc(rt.commodityItemNo)}</ram:CommodityItemNumber>` : ""}
        <ram:ChargeableWeightMeasure unitCode="${wtUnit(rt)}">${cw}</ram:ChargeableWeightMeasure>
        <ram:AppliedRate>${fmt(rt.rateCharge)}</ram:AppliedRate>
        <ram:AppliedAmount currencyID="${hCurr}">${fmt(rt.total)}</ram:AppliedAmount>
      </ram:ApplicableFreightRateServiceCharge>`;
            }).join("\n")
          : "";

        // Other charges for house — NOW includes <Reason> (was missing before)
        const hChgXml = hChg
          .filter(c => c.chargeCode && parseFloat(c.amount || 0) !== 0)
          .map(c => `      <ram:ApplicableLogisticsAllowanceCharge>
        <ram:ID>${esc(c.chargeCode)}</ram:ID>
        <ram:PrepaidIndicator>${c.ppcc !== "CC"}</ram:PrepaidIndicator>
        <ram:Reason>${esc(CHARGE_REASONS[c.chargeCode] || c.description || c.chargeCode)}</ram:Reason>
        <ram:PartyTypeCode>${(c.entitlement || "C").toUpperCase().charAt(0)}</ram:PartyTypeCode>
        <ram:ActualAmount currencyID="${hCurr}">${fmt(c.amount)}</ram:ActualAmount>
      </ram:ApplicableLogisticsAllowanceCharge>`).join("\n");

        // Contact for house shipper / consignee
        const hShipperContact  = buildContact(h.shipperPhone,   fd.shipperEmail,   "        ");
        const hConsigneeContact = buildContact(h.consigneePhone, fd.consigneeEmail, "        ");

        const hOriginId  = esc(h.origin       || mawb.origin);
        const hDestId    = esc(h.destination  || mawb.destination);

        return `    <ram:IncludedHouseConsignment>
      <ram:SequenceNumeric>${idx + 1}</ram:SequenceNumeric>
      <ram:NilCarriageValueIndicator>${hNvd}</ram:NilCarriageValueIndicator>
      <ram:NilCustomsValueIndicator>${hNcv}</ram:NilCustomsValueIndicator>
      <ram:NilInsuranceValueIndicator>${hNii}</ram:NilInsuranceValueIndicator>
      <ram:TotalChargePrepaidIndicator>${hIsPP}</ram:TotalChargePrepaidIndicator>
      <ram:GrossWeightMeasure unitCode="${hUnit}">${hGW}</ram:GrossWeightMeasure>
      ${parseFloat(hVol) > 0 ? `<ram:GrossVolumeMeasure unitCode="MTQ">${hVol}</ram:GrossVolumeMeasure>` : ""}
      <ram:PackageQuantity>${hPcs}</ram:PackageQuantity>
      <ram:TotalPieceQuantity>${hPcs}</ram:TotalPieceQuantity>
      <ram:SummaryDescription>${desc}</ram:SummaryDescription>
      <ram:TransportContractDocument><ram:ID>${houseNo(h.awbNumber)}</ram:ID></ram:TransportContractDocument>
      <ram:OriginLocation>
        <ram:ID>${hOriginId}</ram:ID>
        ${hOriginName ? `<ram:Name>${esc(hOriginName)}</ram:Name>` : ""}
      </ram:OriginLocation>
      <ram:FinalDestinationLocation>
        <ram:ID>${hDestId}</ram:ID>
        ${hDestName ? `<ram:Name>${esc(hDestName)}</ram:Name>` : ""}
      </ram:FinalDestinationLocation>
      <ram:ConsignorParty>
        <ram:Name>${esc(trunc(h.shipperName, 35))}</ram:Name>
        <ram:PostalStructuredAddress>
          ${h.shipperZip     ? `<ram:PostcodeCode>${esc(trunc(h.shipperZip, 9))}</ram:PostcodeCode>` : ""}
          ${h.shipperAddress ? `<ram:StreetName>${esc(trunc(h.shipperAddress, 35))}</ram:StreetName>` : ""}
          <ram:CityName>${esc(trunc(h.shipperCity || h.origin || mawb.origin, 17))}</ram:CityName>
          ${h.shipperState   ? `<ram:CountrySubDivisionName>${esc(trunc(h.shipperState, 9))}</ram:CountrySubDivisionName>` : ""}
          <ram:CountryID>${esc(hShipperCountryCode)}</ram:CountryID>
          ${hShipperCountryName ? `<ram:CountryName>${esc(hShipperCountryName)}</ram:CountryName>` : ""}
        </ram:PostalStructuredAddress>
        ${hShipperContact}
      </ram:ConsignorParty>
      <ram:ConsigneeParty>
        <ram:Name>${esc(trunc(h.consigneeName, 35))}</ram:Name>
        <ram:PostalStructuredAddress>
          ${h.consigneeZip     ? `<ram:PostcodeCode>${esc(trunc(h.consigneeZip, 9))}</ram:PostcodeCode>` : ""}
          ${h.consigneeAddress ? `<ram:StreetName>${esc(trunc(h.consigneeAddress, 35))}</ram:StreetName>` : ""}
          <ram:CityName>${esc(trunc(h.consigneeCity || h.destination || mawb.destination, 17))}</ram:CityName>
          ${h.consigneeState   ? `<ram:CountrySubDivisionName>${esc(trunc(h.consigneeState, 9))}</ram:CountrySubDivisionName>` : ""}
          <ram:CountryID>${esc(hConsCountryCode)}</ram:CountryID>
          ${hConsCountryName ? `<ram:CountryName>${esc(hConsCountryName)}</ram:CountryName>` : ""}
        </ram:PostalStructuredAddress>
        ${hConsigneeContact}
      </ram:ConsigneeParty>
${hSphXml}
${hSsrXml}
${hOsiXml}
${hOciXml}
${hChgXml}
      <ram:ApplicableRating>
        <ram:TypeCode>${hRL.some(r => r.rateAsAgreed) ? "A" : "F"}</ram:TypeCode>
        <ram:TotalChargeAmount currencyID="${hCurr}">${fmt(hRL.length ? lineAmountSum(hRL) : (parseFloat(h.weightChargePP) || 0) + (parseFloat(h.weightChargeCC) || 0))}</ram:TotalChargeAmount>
${hRateXml}
      </ram:ApplicableRating>
    </ram:IncludedHouseConsignment>`;
      }).join("\n");

  // XFZB (house waybill, 29-Oct-2026): one message per HAWB with the full house details - same house block as the
  // XFHL. Before, one "XFZB" held every house with only name / country of the shipper and no consignee.
  if (options.asHouseWaybill) {
    const h0 = hawbs[0];
    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:HouseWaybill xmlns:rsm="iata:housewaybill:1"
                  xmlns:ram="iata:datamodel:3"
                  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:8"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <rsm:MessageHeaderDocument>
    <ram:ID>${awbNo}_${houseNo(h0 && h0.awbNumber)}</ram:ID>
    <ram:Name>House Waybill</ram:Name>
    <ram:TypeCode>703</ram:TypeCode>
    <ram:IssueDateTime>${isoNow()}</ram:IssueDateTime>
    <ram:PurposeCode>${purposeCode}</ram:PurposeCode>
    <ram:VersionID>3.00</ram:VersionID>
    ${conversationID ? `<ram:ConversationID>${escRaw(conversationID)}</ram:ConversationID>` : ""}
    <ram:SenderParty><ram:PrimaryID schemeID="C">${senderID}</ram:PrimaryID></ram:SenderParty>
    <ram:RecipientParty><ram:PrimaryID schemeID="C">${recipientID}</ram:PrimaryID></ram:RecipientParty>
  </rsm:MessageHeaderDocument>
  <rsm:BusinessHeaderDocument>
    <ram:ID>${houseNo(h0 && h0.awbNumber)}</ram:ID>
  </rsm:BusinessHeaderDocument>
  <rsm:MasterConsignment>
    <ram:IncludedTareGrossWeightMeasure unitCode="KGM">${totalGW}</ram:IncludedTareGrossWeightMeasure>
    <ram:TotalPieceQuantity>${totalPcs}</ram:TotalPieceQuantity>
    <ram:TransportContractDocument><ram:ID>${awbNo}</ram:ID></ram:TransportContractDocument>
    <ram:OriginLocation><ram:ID>${esc(mawb.origin)}</ram:ID>${originName ? `<ram:Name>${esc(originName)}</ram:Name>` : ""}</ram:OriginLocation>
    <ram:FinalDestinationLocation><ram:ID>${esc(mawb.destination)}</ram:ID>${destName ? `<ram:Name>${esc(destName)}</ram:Name>` : ""}</ram:FinalDestinationLocation>
${houseXml}
  </rsm:MasterConsignment>
</rsm:HouseWaybill>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:HouseManifest xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                   xmlns:rsm="iata:housemanifest:1"
                   xmlns:ccts="urn:un:unece:uncefact:documentation:standard:CoreComponentsTechnicalSpecification:2"
                   xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:8"
                   xmlns:ram="iata:datamodel:3"
                   xmlns:clmIANACharacterSetCode="urn:un:unece:uncefact:codelist:standard:IANA:CharacterSetCode:2007-05-14"
                   xmlns:clmIANAMIMEMediaType="urn:un:unece:uncefact:codelist:standard:IANA:MIMEMediaType:2009-09-01"
                   xmlns:ids5ISO316612A="urn:un:unece:uncefact:identifierlist:standard:5:ISO316612A:SecondEdition2006VI-6"
                   xmlns:clm5ISO42173A="urn:un:unece:uncefact:codelist:standard:5:ISO42173A:2009-09-09"
                   xmlns:clm60133="urn:un:unece:uncefact:codelist:standard:6:0133:40106"
                   xmlns:clm6Recommendation20="urn:un:unece:uncefact:codelist:standard:6:Recommendation20:6"
                   xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:6:3055:D09A"
                   xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:7"
                   xmlns:clm61001="urn:un:unece:uncefact:codelist:standard:UNECE:DocumentNameCode:D09A"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <rsm:MessageHeaderDocument>
    <ram:ID>${awbNo}</ram:ID>
    <ram:Name>Cargo Manifest</ram:Name>
    <ram:TypeCode>785</ram:TypeCode>
    <ram:IssueDateTime>${isoNow()}</ram:IssueDateTime>
    <ram:PurposeCode>${purposeCode}</ram:PurposeCode>
    <ram:VersionID>2.00</ram:VersionID>
    ${conversationID ? `<ram:ConversationID>${escRaw(conversationID)}</ram:ConversationID>` : `<ram:ConversationID/>`}
    <ram:SenderParty><ram:PrimaryID schemeID="C">${senderID}</ram:PrimaryID></ram:SenderParty>
    <ram:RecipientParty><ram:PrimaryID schemeID="C">${recipientID}</ram:PrimaryID></ram:RecipientParty>
  </rsm:MessageHeaderDocument>
  <rsm:BusinessHeaderDocument>
    <ram:ID>${awbNo}</ram:ID>
    <ram:SenderAssignedID/>
  </rsm:BusinessHeaderDocument>
  <rsm:MasterConsignment>
    <ram:IncludedTareGrossWeightMeasure unitCode="KGM">${totalGW}</ram:IncludedTareGrossWeightMeasure>
    <ram:PackageQuantity>${totalPcs}</ram:PackageQuantity>
    <ram:TotalPieceQuantity>${totalPcs}</ram:TotalPieceQuantity>
    <ram:TransportContractDocument><ram:ID>${awbNo}</ram:ID></ram:TransportContractDocument>
    <ram:OriginLocation>
      <ram:ID>${esc(mawb.origin)}</ram:ID>
      ${originName ? `<ram:Name>${esc(originName)}</ram:Name>` : ""}
    </ram:OriginLocation>
    <ram:FinalDestinationLocation>
      <ram:ID>${esc(mawb.destination)}</ram:ID>
      ${destName ? `<ram:Name>${esc(destName)}</ram:Name>` : ""}
    </ram:FinalDestinationLocation>
    <ram:FreightForwarderParty>
      <ram:Name>${esc(mawb.agentName || await getSetting('company_name', 'COMMITTED CARGO CARE LTD'))}</ram:Name>
      <ram:CargoAgentID>${iataAgentId(mawb.agentCode, mawb.agentAccountNo)}</ram:CargoAgentID>
    </ram:FreightForwarderParty>
${houseXml}
  </rsm:MasterConsignment>
</rsm:HouseManifest>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// XFZB — House Waybill, one message per HAWB (IATA Cargo-XML, Version 3.00)
// ─────────────────────────────────────────────────────────────────────────────
async function generateXfzb(masterAwbId) {
  // one XFZB per live HAWB of the master -> [{ hawbNumber, fileHawb, xml }] (29-Oct-2026, see generateXfhl)
  const mawb = await Airwaybill.findByPk(masterAwbId);
  if (!mawb) throw new Error("Master AWB not found: " + masterAwbId);
  const hawbs = await liveHousesOf(mawb, false);
  if (!hawbs.length) throw new Error("No live House AWB is linked to Master AWB " + mawb.awbNumber);
  const out = [];
  for (const h of hawbs) out.push({ hawbNumber: h.awbNumber, fileHawb: houseNo(h.awbNumber), xml: await generateXfhl(masterAwbId, { onlyHouseId: h.id, asHouseWaybill: true }) });
  return out;
}


// ─────────────────────────────────────────────────────────────────────────────
// XFFM — Flight Manifest (IATA Cargo-XML, Version 2.00)
// ─────────────────────────────────────────────────────────────────────────────
async function generateXffm(masterAwbId) {
  const mawb = await Airwaybill.findByPk(masterAwbId);
  if (!mawb) throw new Error("Master AWB not found: " + masterAwbId);

  const hawbs = await liveHousesOf(mawb);
  await warmHouseNames(hawbs);

  const fd          = mawb.formData || {};
  const awbNo       = fmtAwb(mawb.awbNumber || "");
  const senderID    = esc(mawb.agentCode || await getSetting('van_sender_pima') || await getSetting('sftp_username', 'CCCAGENT'));
  const recipientID = esc(await getSetting('van_recipient_id', 'TDVAIR01GLNDTCR'));

  const flightNum   = esc(mawb.flightNumber1 || fd.flight1 || "");
  const flightDate  = esc(mawb.flightDate1   || fd.flightDate1 || "");
  const arrivalDate = esc(fd.arrivalDate1    || "");
  const origin      = esc(mawb.origin || "");
  const dest        = esc(mawb.destination || "");

  const totalHouses = hawbs.length;
  // 29-Oct-2026: the master's pieces / weight were added to the houses' (the houses are inside the master), so the
  // manifest showed double. The master's own totals are the shipment; houses only when the master has none.
  const totalPcs    = parseInt(mawb.totalPieces) || hawbs.reduce((s, h) => s + (parseInt(h.totalPieces) || 0), 0);
  const totalGW     = fmt(parseFloat(mawb.grossWeight) || hawbs.reduce((s, h) => s + (parseFloat(h.grossWeight) || 0), 0), 2);

  const items = hawbs.length > 0 ? hawbs : [{
    awbNumber:        mawb.awbNumber,
    shipperName:      mawb.shipperName,
    shipperAddress:   mawb.shipperAddress,
    shipperCountry:   mawb.shipperCountry,
    consigneeName:    mawb.consigneeName,
    consigneeAddress: mawb.consigneeAddress,
    consigneeCountry: mawb.consigneeCountry,
    origin:           mawb.origin,
    destination:      mawb.destination,
    totalPieces:      mawb.totalPieces,
    grossWeight:      mawb.grossWeight,
    formData:         fd
  }];

  const consignmentXml = items.map((h, idx) => {
    const hRL  = h.AwbRateLines || [];
    const hGW  = fmt(h.grossWeight || hRL.reduce((s, r) => s + parseFloat(r.grossWeight || 0), 0), 2);
    const hPcs = parseInt(h.totalPieces) || hRL.reduce((s, r) => s + parseInt(r.pieces || 0, 10), 0) || 1;
    const desc = esc(trunc((hRL[0]?.natureOfGoods || h.formData?.natureOfGoods || "GENERAL CARGO").toUpperCase(), 70));
    const hShipperCountryCode = h.shipperCountry || "IN";
    const hShipperCountryName = _countryCache[hShipperCountryCode.toUpperCase()] || "";
    const hConsCountryCode    = h.consigneeCountry || "";
    const hConsCountryName    = hConsCountryCode ? (_countryCache[hConsCountryCode.toUpperCase()] || "") : "";
    return `    <ram:IncludedFlightConsignment>
      <ram:SequenceNumeric>${idx + 1}</ram:SequenceNumeric>
      <ram:TransportContractDocument><ram:ID>${h === items[0] && !hawbs.length ? fmtAwb(h.awbNumber) : houseNo(h.awbNumber)}</ram:ID></ram:TransportContractDocument>
      <ram:GrossWeightMeasure unitCode="${houseWtUnit(h)}">${hGW}</ram:GrossWeightMeasure>
      <ram:TotalPieceQuantity>${hPcs}</ram:TotalPieceQuantity>
      <ram:SummaryDescription>${desc}</ram:SummaryDescription>
      <ram:OriginLocation><ram:ID>${esc(h.origin || mawb.origin)}</ram:ID></ram:OriginLocation>
      <ram:FinalDestinationLocation><ram:ID>${esc(h.destination || mawb.destination)}</ram:ID></ram:FinalDestinationLocation>
      <ram:ConsignorParty>
        <ram:Name>${esc(trunc(h.shipperName, 35))}</ram:Name>
        <ram:PostalStructuredAddress>
          ${h.shipperAddress ? `<ram:StreetName>${esc(trunc(h.shipperAddress, 35))}</ram:StreetName>` : ""}
          <ram:CountryID>${esc(hShipperCountryCode)}</ram:CountryID>
          ${hShipperCountryName ? `<ram:CountryName>${esc(hShipperCountryName)}</ram:CountryName>` : ""}
        </ram:PostalStructuredAddress>
      </ram:ConsignorParty>
      <ram:ConsigneeParty>
        <ram:Name>${esc(trunc(h.consigneeName, 35))}</ram:Name>
        <ram:PostalStructuredAddress>
          ${h.consigneeAddress ? `<ram:StreetName>${esc(trunc(h.consigneeAddress, 35))}</ram:StreetName>` : ""}
          <ram:CountryID>${esc(hConsCountryCode)}</ram:CountryID>
          ${hConsCountryName ? `<ram:CountryName>${esc(hConsCountryName)}</ram:CountryName>` : ""}
        </ram:PostalStructuredAddress>
      </ram:ConsigneeParty>
    </ram:IncludedFlightConsignment>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<xffm:FlightManifest
  xmlns:xffm="iata:flightmanifest:2"
  xmlns:ram="iata:datamodel:3"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:8"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <xffm:MessageHeaderDocument>
    <ram:ID>${awbNo}</ram:ID>
    <ram:Name>Cargo Flight Manifest</ram:Name>
    <ram:TypeCode>XFFM</ram:TypeCode>
    <ram:IssueDateTime>${isoNow()}</ram:IssueDateTime>
    <ram:PurposeCode>Creation</ram:PurposeCode>
    <ram:VersionID>2.00</ram:VersionID>
    <ram:SenderParty><ram:PrimaryID schemeID="C">${senderID}</ram:PrimaryID></ram:SenderParty>
    <ram:RecipientParty><ram:PrimaryID schemeID="C">${recipientID}</ram:PrimaryID></ram:RecipientParty>
  </xffm:MessageHeaderDocument>
  <xffm:BusinessHeaderDocument>
    <ram:ID>${awbNo}</ram:ID>
    <ram:SenderAssignedID/>
  </xffm:BusinessHeaderDocument>
  <xffm:FlightLeg>
    <ram:FlightIdentification>
      <ram:ID>${flightNum}</ram:ID>
      <ram:Date>${flightDate}</ram:Date>
    </ram:FlightIdentification>
    <ram:DepartureEvent>
      ${flightDate ? `<ram:ScheduledOccurrenceDateTime>${fmtDateTime(flightDate)}</ram:ScheduledOccurrenceDateTime>` : ""}
      <ram:OccurrenceDepartureLocation><ram:ID>${origin}</ram:ID></ram:OccurrenceDepartureLocation>
    </ram:DepartureEvent>
    <ram:ArrivalEvent>
      ${arrivalDate ? `<ram:ScheduledOccurrenceDateTime>${fmtDateTime(arrivalDate)}</ram:ScheduledOccurrenceDateTime>` : ""}
      <ram:OccurrenceArrivalLocation><ram:ID>${dest}</ram:ID></ram:OccurrenceArrivalLocation>
    </ram:ArrivalEvent>
    <ram:MasterConsignment>
      <ram:TransportContractDocument><ram:ID>${awbNo}</ram:ID></ram:TransportContractDocument>
      <ram:IncludedTareGrossWeightMeasure unitCode="KGM">${totalGW}</ram:IncludedTareGrossWeightMeasure>
      <ram:TotalPieceQuantity>${totalPcs}</ram:TotalPieceQuantity>
      <ram:HouseCount>${totalHouses}</ram:HouseCount>
      <ram:OriginLocation><ram:ID>${origin}</ram:ID></ram:OriginLocation>
      <ram:FinalDestinationLocation><ram:ID>${dest}</ram:ID></ram:FinalDestinationLocation>
${consignmentXml}
    </ram:MasterConsignment>
  </xffm:FlightLeg>
</xffm:FlightManifest>`;
}


module.exports = { generateXfwb, generateXfhl, generateXfzb, generateXffm, liveHousesOf, houseNo, houseKg };
