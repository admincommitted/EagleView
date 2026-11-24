const { DataTypes } = require('sequelize');

/**
 * Columns shared by Airwaybill (MAWB / direct AWB), HouseAWB and MasterAWB.
 *
 * Fix 28-Oct-2026: the models had been cut down to ~15 columns, so Sequelize silently
 * dropped everything else on save (agent, currency, charges, declared values, signatures…)
 * and returned undefined when the XFWB/XFHL/XFZB builders read them back
 * (e.g. currency fell back to "USD", agent block empty).
 * This list matches what routes/awb.js writes and what utils/XmlPayloadGenerator.js reads.
 */
const S = () => ({ type: DataTypes.STRING });
const T = () => ({ type: DataTypes.TEXT });
const F = () => ({ type: DataTypes.FLOAT, defaultValue: 0 });

const awbColumns = {
  awbNumber: S(), type: S(), awbType: S(), status: S(),
  branchId: { type: DataTypes.INTEGER }, financialYearId: { type: DataTypes.INTEGER },
  masterAwbNumber: S(), masterAwbId: { type: DataTypes.INTEGER }, parentAwb: S(), productId: S(),
  origin: S(), destination: S(), depAirport: S(), destAirport: S(),
  // Parties
  shipperName: S(), shipperAddress: T(), shipperCity: S(), shipperState: S(), shipperCountry: S(), shipperZip: S(), shipperPhone: S(), shipperEmail: S(),
  consigneeName: S(), consigneeAddress: T(), consigneeCity: S(), consigneeState: S(), consigneeCountry: S(), consigneeZip: S(), consigneePhone: S(), consigneeEmail: S(),
  buyerName: S(), buyerAddress: T(), buyerCity: S(), buyerState: S(), buyerCountry: S(), buyerZip: S(), buyerPhone: S(), buyerEmail: S(),
  // Issuing agent
  agentName: S(), agentCode: S(), agentAccountNo: S(), agentPlace: S(), agentCity: S(), agentCountry: S(), agentDocs: S(), agentEori: S(), agentAccountingInfo: T(),
  // Quantities
  totalPieces: { type: DataTypes.INTEGER }, grossWeight: { type: DataTypes.FLOAT }, totalVolume: F(), natureOfGoods: T(),
  // Routing & flights
  flightNumber1: S(), flightDate1: S(), flightNumber2: S(), flightDate2: S(), flightNumber3: S(), flightDate3: S(),
  to1: S(), by1: S(), to2: S(), by2: S(), to3: S(), by3: S(),
  // Charges declaration
  currencyCode: S(), destinationCurrency: S(), chargeCode: S(), wtVal: S(), other: S(),
  declaredValueCarriage: S(), declaredValueCustoms: S(), amountOfInsurance: S(),
  accountingInformation: T(), handlingInformation: T(), ssr: T(), osi: T(), sci: S(),
  // Execution
  signatureShipper: S(), signatureCarrier: S(), executedDate: S(), executedPlace: S(),
  // Totals block
  weightChargePP: F(), weightChargeCC: F(), valChargePP: F(), valChargeCC: F(), taxPP: F(), taxCC: F(),
  totalChargePP: F(), totalChargeCC: F(), ccChargesDest: F(),
  // Extra screen data (read by the XML builders as `fd`)
  formData: { type: DataTypes.JSON },
  createdBy: S(), modifiedBy: S()
};

module.exports = { awbColumns };
