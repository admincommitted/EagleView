// Form section: PageTopSection
// Split out of CreateHouseWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import AirExportActionTabs from '../../../AirExportActionTabs';
import React from 'react';

export default function PageTopSection({ ctx }) {
  const { accountingInfo, awbPrefix, awbSuffix, by1, by2, by3, carriageValue, chargeCode, currencyCode, customsValue, depAirport, destAirport, destAirportName, dimRows, dueAgentCC, dueAgentPP, dueCarrierCC, dueCarrierPP, executedDate, executedPlace, flightDate1, flightDate2, flightNumber1, flightNumber2, hawbNumber, insuranceValue, natureOfGoods, ociRows, osiText, otherCharges, otherPC, parties, printAgentDetails, rateLines, sci, sphCodes, ssrText, taxCC, taxPP, to1, to2, to3, totalCC, totalPP, valChargeCC, valChargePP, volume, weightChargeCC, weightChargePP, wtValPC } = ctx;
  return (
    <>
    <div id="awb-print-data" style={{ display: 'none' }} data-json={JSON.stringify({ awbKind: 'HAWB', signatureShipper: ctx.signatureShipper, signatureCarrier: ctx.signatureCarrier, // printed in the signature boxes (11-Nov-2026)
                    depAirport, destAirport, destAirportName, executedDate, executedPlace, awbPrefix, awbSuffix, hawbNumber, by1, to1, by2, to2, by3, to3, flightNumber1, flightDate1, flightNumber2, flightDate2,
          weightChargePP, weightChargeCC, valChargePP, valChargeCC, taxPP, taxCC,
          dueAgentPP, dueAgentCC, dueCarrierPP, dueCarrierCC, totalPP, totalCC,
          rateLines, otherCharges, ssrText, osiText, sci, accountingInfo,
          carriageValue, customsValue, insuranceValue, currencyCode, chargeCode, wtValPC, otherPC, natureOfGoods, dimRows: rateLines.some(r => r.dimensions && r.dimensions.length > 0) ? rateLines.reduce((acc, rl, idx) => acc.concat((rl.dimensions || []).filter(d => d.length && d.width && d.height).map(d => ({ ...d, rateLineIndex: idx }))), []) : (typeof dimRows !== 'undefined' ? dimRows : []), volume, parties, agentDetails: printAgentDetails, sphCodes, ociRows
        })}></div>
      

      <style>{`

        .premium-input:focus {

          border-color: #0ea5e9 !important;

          box-shadow: inset 0 1px 2px rgba(0,0,0,0.1), 0 0 0 2px rgba(14, 165, 233, 0.2) !important;

          background-color: #ffffff !important;
}

        .premium-input {

          transition: all 0.2s ease;

          background-color: #ffffff;
}

      `}</style>

      <div style={{ marginBottom: '0px' }}>

        <AirExportActionTabs activeTab="create" />

      </div>
    </>
  );
}
