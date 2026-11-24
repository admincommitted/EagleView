// Masters / code lists used by the AWB form
// Split out of CreateAirWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
export { AIRLINES, OCI_COUNTRY_CODES, OCI_CUSTOMS_IDS, SPECIAL_HANDLING_CODES } from '../shared/awbConstants';

export const OCI_INFO_IDENTIFIERS = [
  { val: 'AGT', label: 'AGT - Forwarding Agent' },
  { val: 'CNE', label: 'CNE - Consignee' },
  { val: 'SHP', label: 'SHP - Shipper' },
  { val: 'CBR', label: 'CBR - Customs Broker' },
  { val: 'ISS', label: 'ISS - Issuing Carrier' },
  { val: 'DEC', label: 'DEC - Declarant' },
    { val: 'SEC', label: 'SEC - Security' }
];
