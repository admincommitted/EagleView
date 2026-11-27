// IATA Cargo-IMP text messages: FWB (freight waybill) and FHL (house manifest).
import { Airwaybill, HouseAWB } from '../../models/index.js';

const CRLF = '\r\n';
const IATA_LINE_LENGTH = 35;
const KG_PER_LB = 0.45359237;
const CUBIC_CM_PER_CBM = 1e6;
const IATA_VOLUME_DIVISOR = 6000; // 6000 cm3 per kg
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// chargeable weight when none is saved: the higher of gross and volumetric weight, rounded up to the next
// 0.5 kg / whole lb
function defaultChargeableWeight(rateLine, grossWeight, inPounds) {
  let volumetric =
    parseFloat(rateLine.volumetricWeight) ||
    ((parseFloat(rateLine.volume) || 0) * CUBIC_CM_PER_CBM) / IATA_VOLUME_DIVISOR;
  if (inPounds) volumetric /= KG_PER_LB;
  const heavier = Math.max(grossWeight, volumetric);
  return inPounds ? Math.ceil(heavier - 1e-9) : Math.ceil(heavier * 2 - 1e-9) / 2;
}

// rate description line: /<line>/P<pieces>/<K|L><gross>/C<rate class>/W<chargeable>/R<rate>/T<total>
function rtdLine(rateLine, lineIndex) {
  const inPounds = /^L/i.test(String(rateLine.gwUnit || ''));
  const pieces = parseInt(rateLine.pieces, 10) || 1;
  const grossWeight = parseFloat(rateLine.grossWeight) || 0;
  const chargeableWeight =
    parseFloat(rateLine.chargeableWeight) || defaultChargeableWeight(rateLine, grossWeight, inPounds);
  const rate = parseFloat(rateLine.rateCharge) || 0;
  const total = parseFloat(rateLine.total) || 0;
  const rateClass = String(rateLine.rateClass || 'Q')
    .charAt(0)
    .toUpperCase();
  return `/${lineIndex + 1}/P${pieces}/${inPounds ? 'L' : 'K'}${grossWeight.toFixed(1)}/C${rateClass}/W${chargeableWeight.toFixed(1)}/R${rate.toFixed(2)}/T${total.toFixed(2)}\r\n`;
}

const upperCut = (value, length) => (value || '').toUpperCase().substring(0, length);

class IataPayloadGenerator {
  static splitAddress(address) {
    if (!address) return { line1: '', line2: '' };
    const clean = address.trim();
    if (clean.length <= IATA_LINE_LENGTH) return { line1: clean.toUpperCase(), line2: '' };
    let breakAt = clean.lastIndexOf(' ', IATA_LINE_LENGTH);
    if (breakAt <= 0) breakAt = IATA_LINE_LENGTH;
    return {
      line1: clean.substring(0, breakAt).trim().toUpperCase(),
      line2: clean.substring(breakAt).substring(0, IATA_LINE_LENGTH).trim().toUpperCase(),
    };
  }

  static pad(value, length) {
    return String(value || '')
      .toUpperCase()
      .padEnd(length)
      .substring(0, length);
  }

  // DDMMMYY, e.g. 01SEP26
  static fmtDate(value) {
    if (!value) return '';
    try {
      const date = new Date(value);
      const day = String(date.getDate()).padStart(2, '0');
      const month = MONTHS[date.getMonth()];
      const year = String(date.getFullYear()).slice(-2);
      return `${day}${month}${year}`;
    } catch {
      return '';
    }
  }

  static shipperSegment(awb) {
    const address = this.splitAddress(awb.shipperAddress);
    let msg = `SHP${CRLF}`;
    msg += `/${upperCut(awb.shipperName || 'UNKNOWN', IATA_LINE_LENGTH)}${CRLF}`;
    msg += `/${address.line1 || 'UNKNOWN'}${CRLF}`;
    if (address.line2) msg += `/${address.line2}${CRLF}`;
    msg += `/${(awb.shipperCity || '').toUpperCase()}`;
    if (awb.shipperState) msg += `/${awb.shipperState.toUpperCase()}`;
    if (awb.shipperCountry) msg += `/${awb.shipperCountry.toUpperCase()}`;
    msg += CRLF;
    if (awb.shipperPhone) msg += `/TEL ${awb.shipperPhone}${CRLF}`;
    return msg;
  }

  static consigneeSegment(awb) {
    const address = this.splitAddress(awb.consigneeAddress);
    let msg = `CNE${CRLF}`;
    msg += `/${upperCut(awb.consigneeName || 'UNKNOWN', IATA_LINE_LENGTH)}${CRLF}`;
    msg += `/${address.line1 || 'UNKNOWN'}${CRLF}`;
    if (address.line2) msg += `/${address.line2}${CRLF}`;
    msg += `/${(awb.consigneeCity || '').toUpperCase()}`;
    if (awb.consigneeCountry) msg += `/${awb.consigneeCountry.toUpperCase()}`;
    msg += CRLF;
    if (awb.consigneePhone) msg += `/TEL ${awb.consigneePhone}${CRLF}`;
    return msg;
  }

  static agentSegment(awb) {
    if (!awb.agentName) return '';
    let msg = `AGT${CRLF}`;
    msg += `/${upperCut(awb.agentName, IATA_LINE_LENGTH)}${CRLF}`;
    if (awb.agentCode) msg += `/CASS ${awb.agentCode}${CRLF}`;
    if (awb.agentAccountNo) msg += `/ACCT ${awb.agentAccountNo}${CRLF}`;
    if (awb.agentPlace) msg += `/${awb.agentPlace.toUpperCase()}${CRLF}`;
    return msg;
  }

  static totalsSegment(awb) {
    if (!(awb.totalChargePP || awb.totalChargeCC)) return '';
    const amount = (value) => (parseFloat(value) || 0).toFixed(2);
    let msg = `TOT${CRLF}`;
    msg += `/${amount(awb.weightChargePP)}/${amount(awb.weightChargeCC)}`;
    msg += `/${amount(awb.valChargePP)}/${amount(awb.valChargeCC)}`;
    msg += `/${amount(awb.totalChargePP)}/${amount(awb.totalChargeCC)}${CRLF}`;
    return msg;
  }

  static async generateFwb(awbId) {
    const awb = await Airwaybill.findByPk(awbId, {
      include: [{ all: true }],
    });
    if (!awb) throw new Error('AWB not found');

    const awbNo = (awb.awbNumber || '').replace('-', '');

    let msg = `FWB/17${CRLF}`;

    // consignment detail: /T<pieces><K|L><weight>
    const pieces = awb.totalPieces || 1;
    const weight = (parseFloat(awb.grossWeight) || 0).toFixed(1);
    const weightUnit = /^L/i.test(String(((awb.AwbRateLines || [])[0] || {}).gwUnit || '')) ? 'L' : 'K';
    msg += `${awbNo}${awb.origin || 'UNK'}${awb.destination || 'UNK'}/T${pieces}${weightUnit}${weight}${CRLF}`;

    if (awb.by1 || awb.to1) {
      let routing = 'RTG/';
      if (awb.by1) routing += `${awb.by1}/${awb.to1 || ''}`;
      if (awb.by2) routing += `/${awb.by2}/${awb.to2 || ''}`;
      if (awb.by3) routing += `/${awb.by3}/${awb.to3 || ''}`;
      msg += routing + CRLF;
    }

    if (awb.flightNumber1) msg += `FLT/${awb.flightNumber1}/${this.fmtDate(awb.flightDate1)}${CRLF}`;

    msg += this.shipperSegment(awb);
    msg += this.consigneeSegment(awb);
    msg += this.agentSegment(awb);

    const handlingCodes = (awb.SpecialHandlingCodes || []).map((row) => row.code).filter((code) => code && code.trim());
    if (handlingCodes.length > 0) msg += `SSP/${handlingCodes.join('/')}${CRLF}`;

    msg += `CHG/${awb.currencyCode || 'USD'}/${awb.chargeCode || 'PP'}`;
    if (awb.wtVal) msg += `/${awb.wtVal}`;
    if (awb.other) msg += `/${awb.other}`;
    msg += CRLF;

    msg += `DAV/${awb.declaredValueCarriage || 'NVD'}/${awb.declaredValueCustoms || 'NCV'}/${awb.amountOfInsurance || 'XXX'}${CRLF}`;

    const rateLines = awb.AwbRateLines || [];
    if (rateLines.length > 0) {
      msg += `RTD${CRLF}`;
      rateLines.forEach((rateLine, lineIndex) => {
        msg += rtdLine(rateLine, lineIndex);
        if (rateLine.natureOfGoods) msg += `//${upperCut(rateLine.natureOfGoods, IATA_LINE_LENGTH)}${CRLF}`;
      });
    }

    const charges = awb.AwbOtherCharges || [];
    if (charges.length > 0) {
      msg += `OCI${CRLF}`;
      charges.forEach((charge) => {
        const entitlement = (charge.ppcc || charge.entitlement || 'PP').toUpperCase();
        const amount = parseFloat(charge.amount) || 0;
        msg += `/${charge.chargeCode}/${entitlement}/${amount.toFixed(2)}${CRLF}`;
      });
    }

    // customs information: only rows that carry supplementary info
    const customsRows = (awb.AwbOcis || []).filter((row) => String(row.suppInfo || '').trim());
    customsRows.forEach((row) => {
      msg += `OCI/${(row.countryCode || '').toUpperCase()}/${(row.infoId || '').toUpperCase()}/${row.customsId || ''}/${(row.suppInfo || '').toUpperCase()}${CRLF}`;
    });

    if (awb.ssr) msg += `SSR/${awb.ssr.substring(0, 70).toUpperCase()}${CRLF}`;
    if (awb.osi) msg += `OSI/${awb.osi.substring(0, 70).toUpperCase()}${CRLF}`;
    if (awb.sci) msg += `SCI/${awb.sci.substring(0, 3).toUpperCase()}${CRLF}`;

    msg += this.totalsSegment(awb);

    if (awb.executedPlace || awb.executedDate) {
      msg += `EXE/${this.fmtDate(awb.executedDate)}/${(awb.executedPlace || '').toUpperCase()}${CRLF}`;
    }

    return msg;
  }

  static houseSegment(house) {
    const hawbNo = (house.awbNumber || '').replace('-', '');
    const pieces =
      house.totalPieces || (house.AwbRateLines || []).reduce((sum, line) => sum + (parseInt(line.pieces) || 0), 0) || 1;
    const grossWeight = parseFloat(house.grossWeight) || 0;

    let msg = `HAW${CRLF}`;
    msg += `/${hawbNo}/${pieces}K${grossWeight.toFixed(1)}${CRLF}`;

    msg += `SHP${CRLF}`;
    msg += `/${upperCut(house.shipperName || 'UNKNOWN', IATA_LINE_LENGTH)}${CRLF}`;
    msg += `/${upperCut(house.shipperAddress, IATA_LINE_LENGTH)}${CRLF}`;
    msg += `/${(house.shipperCity || '').toUpperCase()}${CRLF}`;

    msg += `CNE${CRLF}`;
    msg += `/${upperCut(house.consigneeName || 'UNKNOWN', IATA_LINE_LENGTH)}${CRLF}`;
    msg += `/${upperCut(house.consigneeAddress, IATA_LINE_LENGTH)}${CRLF}`;
    msg += `/${(house.consigneeCity || '').toUpperCase()}${CRLF}`;

    if (house.AwbRateLines && house.AwbRateLines.length > 0) {
      msg += `RTD${CRLF}`;
      house.AwbRateLines.forEach((rateLine, lineIndex) => {
        msg += rtdLine(rateLine, lineIndex);
      });
    }

    const handlingCodes = (house.SpecialHandlingCodes || []).map((row) => row.code).filter(Boolean);
    if (handlingCodes.length > 0) msg += `SSP/${handlingCodes.join('/')}${CRLF}`;

    if (house.ssr) msg += `SSR/${house.ssr.substring(0, 70).toUpperCase()}${CRLF}`;
    return msg;
  }

  static async generateFhl(masterAwbId) {
    const mawb = await Airwaybill.findByPk(masterAwbId);
    if (!mawb) throw new Error('Master AWB not found');

    const hawbs = await HouseAWB.findAll({
      where: { masterAwbNumber: mawb.awbNumber },
      include: [{ all: true }],
    });

    const mawbNo = (mawb.awbNumber || '').replace('-', '');

    let msg = `FHL/4${CRLF}`;
    // T = total consignment
    msg += `MBI/${mawbNo}${mawb.origin || 'UNK'}${mawb.destination || 'UNK'}/T${mawb.totalPieces || 1}K${(parseFloat(mawb.grossWeight) || 0).toFixed(1)}${CRLF}`;

    for (const house of hawbs) msg += this.houseSegment(house);

    if (hawbs.length === 0) msg += `TXT/NO HOUSE WAYBILLS LINKED TO THIS MASTER${CRLF}`;

    return msg;
  }
}

export default IataPayloadGenerator;
