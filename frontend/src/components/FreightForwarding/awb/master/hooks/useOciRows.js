import { useEffect, useState } from 'react';
import { airportCountryOf } from '../../awbValidate';
import { EORI_COUNTRIES, customsIdForParty, partyTaxIdForOci } from './masterWaybillData';

const partyTaxId = (party) => party.addresses?.[0]?.regNo || party.addresses?.[0]?.gstin || party.taxId || party.panNumber || party.iec || '';

// two-letter airport prefixes that come out as the consignee country, mapped to the country sent on the OCI line
const OCI_COUNTRY_FIXES = { LF: 'GB', EG: 'GB', ED: 'DE' };

// OCI (other customs information) lines: SHP / CNE tax ids follow the shipper / consignee; security (SEC) lines on request
export default function useOciRows({ parties, depAirport, destAirport, masterAirports }) {
  const [ociRows, setOciRows] = useState([{ id: 1, countryCode: '', infoId: '', customsId: '', suppInfo: '' }]);

  const partyCountry = (party, airportCode, fallback) => (
    party.countryCode || party.country || party.addresses?.[0]?.country || airportCountryOf(airportCode, masterAirports) || fallback
  ).substring(0, 2).toUpperCase();

  const shipper = parties['Shipper'];
  const consignee = parties['Consignee'];

  useEffect(() => {
    setOciRows((previous) => {
      const before = JSON.stringify(previous || []);
      let rows = JSON.parse(before);
      const putPartyRow = (infoId, id, party, countryCode, taxId) => {
        const customsId = customsIdForParty(party, countryCode);
        const existing = rows.find((row) => row.infoId === infoId);
        if (existing) Object.assign(existing, { countryCode, suppInfo: taxId, customsId });
        else rows.push({ id, countryCode, infoId, customsId, suppInfo: taxId });
      };
      if (shipper) {
        const countryCode = partyCountry(shipper, depAirport, 'IN');
        const taxId = partyTaxId(shipper);
        if (taxId) putPartyRow('SHP', Date.now(), shipper, countryCode, taxId);
      }
      if (consignee) {
        const countryCode = partyCountry(consignee, destAirport, '');
        const taxId = partyTaxId(consignee);
        if (taxId && countryCode) putPartyRow('CNE', Date.now() + 1, consignee, countryCode, taxId);
      }
      if (!shipper) rows = rows.filter((row) => row.infoId !== 'SHP');
      if (!consignee) rows = rows.filter((row) => row.infoId !== 'CNE');
      return JSON.stringify(rows) !== before ? rows : previous;
    });
  }, [shipper, consignee]); // eslint-disable-line react-hooks/exhaustive-deps -- follows the two parties only

  const handleSmartAutoFillOCI = () => {
    const rows = [];
    const shipperCountry = (shipper?.country || airportCountryOf(depAirport, masterAirports) || 'IN').toUpperCase().substring(0, 2);
    const shipperTaxId = partyTaxIdForOci(shipper);
    if (shipperTaxId) rows.push({ id: Date.now(), countryCode: shipperCountry, infoId: 'SHP', customsId: customsIdForParty(shipper, shipperCountry), suppInfo: shipperTaxId });

    const consigneeCountryCode = (consignee?.country || airportCountryOf(destAirport, masterAirports) || '').toUpperCase().substring(0, 2);
    const consigneeCountry = OCI_COUNTRY_FIXES[consigneeCountryCode] || consigneeCountryCode;
    const consigneeTaxId = partyTaxIdForOci(consignee);
    if (consigneeTaxId) {
      rows.push({ id: Date.now() + 1, countryCode: consigneeCountry, infoId: 'CNE', customsId: EORI_COUNTRIES.includes(consigneeCountry) ? 'E' : 'T', suppInfo: consigneeTaxId });
    }
    setOciRows(rows);
  };

  // untouched OCI lines are filled from the parties / airports as soon as there is something to fill them with
  useEffect(() => {
    const isUntouched = ociRows.length === 0 || (ociRows.length === 1 && !ociRows[0].suppInfo);
    if (isUntouched && (shipper?.name || consignee?.name || destAirport)) handleSmartAutoFillOCI();
  }, [parties, depAirport, destAirport]); // eslint-disable-line react-hooks/exhaustive-deps -- lines the user typed are kept

  const handleOciChange = (id, field, value) => {
    setOciRows((previous) => previous.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleAutoFilleCSD = () => {
    const shipperCountry = (shipper?.country || airportCountryOf(depAirport, masterAirports) || 'IN').toUpperCase().substring(0, 2);
    const securityRows = [
      { id: Date.now() + 101, countryCode: shipperCountry, infoId: 'SEC', customsId: 'V', suppInfo: 'SPX' },
      { id: Date.now() + 102, countryCode: shipperCountry, infoId: 'SEC', customsId: 'SM', suppInfo: 'XRY' },
      { id: Date.now() + 103, countryCode: shipperCountry, infoId: 'SEC', customsId: 'RA', suppInfo: '' },
    ];
    const missing = securityRows.filter((securityRow) => !ociRows.some((row) => row.infoId === securityRow.infoId && row.customsId === securityRow.customsId));
    setOciRows([...ociRows, ...missing]);
  };

  return {
    ociRows, setOciRows, handleOciChange, handleAutoFilleCSD, handleSmartAutoFillOCI,
    getCustomsIdForParty: customsIdForParty,
  };
}
