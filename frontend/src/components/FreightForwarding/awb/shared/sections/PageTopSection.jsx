import AirExportActionTabs from '../../../AirExportActionTabs';

// the dimensions typed in the rate lines win over the old separate dimension rows
const printDimensions = (rateLines, dimRows) => {
  if (!rateLines.some((line) => line.dimensions?.length > 0)) return dimRows ?? [];
  return rateLines.flatMap((line, rateLineIndex) => (line.dimensions || [])
    .filter((dimension) => dimension.length && dimension.width && dimension.height)
    .map((dimension) => ({ ...dimension, rateLineIndex })));
};

/** Print data read by printLogic (#awb-print-data) and the Air Export tabs. */
export default function PageTopSection({ ctx, awbKind, extraPrintData }) {
  const {
    accountingInfo, awbPrefix, awbSuffix, by1, by2, by3, carriageValue, chargeCode, currencyCode, customsValue, depAirport,
    destAirport, destAirportName, dimRows, dueAgentCC, dueAgentPP, dueCarrierCC, dueCarrierPP, executedDate, executedPlace,
    flightDate1, flightDate2, flightNumber1, flightNumber2, insuranceValue, natureOfGoods, ociRows, osiText, otherCharges,
    otherPC, parties, printAgentDetails, rateLines, sci, signatureCarrier, signatureShipper, sphCodes, ssrText, taxCC, taxPP,
    to1, to2, to3, totalCC, totalPP, valChargeCC, valChargePP, volume, weightChargeCC, weightChargePP, wtValPC,
  } = ctx;
  const printData = {
    awbKind, signatureShipper, signatureCarrier,
    depAirport, destAirport, destAirportName, executedDate, executedPlace, awbPrefix, awbSuffix,
    by1, to1, by2, to2, by3, to3, flightNumber1, flightDate1, flightNumber2, flightDate2,
    weightChargePP, weightChargeCC, valChargePP, valChargeCC, taxPP, taxCC,
    dueAgentPP, dueAgentCC, dueCarrierPP, dueCarrierCC, totalPP, totalCC,
    rateLines, otherCharges, ssrText, osiText, sci, accountingInfo,
    carriageValue, customsValue, insuranceValue, currencyCode, chargeCode, wtValPC, otherPC, natureOfGoods,
    dimRows: printDimensions(rateLines, dimRows), volume, parties, agentDetails: printAgentDetails, sphCodes, ociRows,
    ...extraPrintData,
  };

  return (
    <>
      <div id="awb-print-data" className="tw:hidden" data-json={JSON.stringify(printData)} />
      <AirExportActionTabs activeTab="create" />
    </>
  );
}
