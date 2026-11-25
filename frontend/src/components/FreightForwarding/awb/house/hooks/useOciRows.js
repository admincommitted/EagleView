import { useEffect, useState } from 'react';
import { airportCountryOf } from '../../awbValidate';
import { emptyOci } from '../../savedAwb';
import {
  EU_CUSTOMS_COUNTRIES, consigneeCountryFix, customsIdForParty, partyCountryCode, partyTaxNumber, taxIdFromParty,
} from './houseWaybillData';

// the SHP / CNE row of a party: updated in place when there is one, else added
function upsertPartyRow(rows, infoId, idOffset, party, countryCode) {
  const suppInfo = partyTaxNumber(party);
  if (!suppInfo || !countryCode) return;
  const customsId = customsIdForParty(party, countryCode);
  const existing = rows.find((row) => row.infoId === infoId);
  if (existing) Object.assign(existing, { countryCode, suppInfo, customsId });
  else rows.push({ id: Date.now() + idOffset, countryCode, infoId, customsId, suppInfo });
}

// OCI (other customs information) rows: shipper / consignee tax ids follow the parties, security (SEC) rows on request
export default function useOciRows({ parties, depAirport, destAirport, masterAirports }) {
  const [ociRows, setOciRows] = useState(emptyOci);
  const shipper = parties['Shipper'];
  const consignee = parties['Consignee'];

  const shipperCountry = () => (shipper?.country || airportCountryOf(depAirport, masterAirports) || 'IN').toUpperCase().substring(0, 2);

  const handleOciChange = (id, field, value) => {
    setOciRows((previous) => previous.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleAutoFilleCSD = () => {
    const countryCode = shipperCountry();
    const stamp = Date.now();
    const securityRows = [
      { id: stamp + 101, countryCode, infoId: 'SEC', customsId: 'V', suppInfo: 'SPX' },
      { id: stamp + 102, countryCode, infoId: 'SEC', customsId: 'SM', suppInfo: 'XRY' },
      { id: stamp + 103, countryCode, infoId: 'SEC', customsId: 'RA', suppInfo: '' },
    ];
    const missingRows = securityRows.filter((securityRow) => !ociRows.some((row) => row.infoId === securityRow.infoId && row.customsId === securityRow.customsId));
    setOciRows([...ociRows, ...missingRows]);
  };

  const handleSmartAutoFillOCI = () => {
    const rows = [];
    const shipperCountryCode = shipperCountry();
    const shipperTaxId = taxIdFromParty(shipper);
    if (shipperTaxId) rows.push({ id: Date.now(), countryCode: shipperCountryCode, infoId: 'SHP', customsId: customsIdForParty(shipper, shipperCountryCode), suppInfo: shipperTaxId });

    const consigneeCountryCode = consigneeCountryFix((consignee?.country || airportCountryOf(destAirport, masterAirports) || '').toUpperCase().substring(0, 2));
    const consigneeTaxId = taxIdFromParty(consignee);
    if (consigneeTaxId) {
      const customsId = EU_CUSTOMS_COUNTRIES.includes(consigneeCountryCode) ? 'E' : 'T';
      rows.push({ id: Date.now() + 1, countryCode: consigneeCountryCode, infoId: 'CNE', customsId, suppInfo: consigneeTaxId });
    }
    setOciRows(rows);
  };

  useEffect(() => {
    const untouched = ociRows.length === 0 || (ociRows.length === 1 && !ociRows[0].suppInfo);
    if (untouched && (shipper?.name || consignee?.name || destAirport)) handleSmartAutoFillOCI();
  }, [parties, depAirport, destAirport]); // eslint-disable-line react-hooks/exhaustive-deps -- rows typed by hand are not replaced

  useEffect(() => {
    setOciRows((previous) => {
      const before = JSON.stringify(previous);
      let rows = JSON.parse(before);
      if (shipper) upsertPartyRow(rows, 'SHP', 0, shipper, partyCountryCode(shipper, airportCountryOf(depAirport, masterAirports) || 'IN'));
      if (consignee) upsertPartyRow(rows, 'CNE', 1, consignee, partyCountryCode(consignee, airportCountryOf(destAirport, masterAirports)));
      if (!shipper) rows = rows.filter((row) => row.infoId !== 'SHP');
      if (!consignee) rows = rows.filter((row) => row.infoId !== 'CNE');
      return JSON.stringify(rows) === before ? previous : rows;
    });
  }, [shipper, consignee]); // eslint-disable-line react-hooks/exhaustive-deps -- follows the parties, not the airports

  return { ociRows, setOciRows, handleOciChange, handleAutoFilleCSD, handleSmartAutoFillOCI, getCustomsIdForParty: customsIdForParty };
}
