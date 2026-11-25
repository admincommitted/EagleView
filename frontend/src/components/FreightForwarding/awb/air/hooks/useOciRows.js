import { useEffect, useState } from 'react';
import { airportCountryOf } from '../../awbValidate';
import { EORI_COUNTRIES, countryCodeOf } from './airWaybillData';

const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/;
const IEC = /\b\d{10}\b/;
const VAT = /\b[A-Z]{2}[0-9]{2}[0-9A-Z]{6,10}\b/;
// ICAO-style codes some airport masters give instead of the ISO country
const COUNTRY_CORRECTIONS = { LF: 'GB', EG: 'GB', ED: 'DE' };

// OCI customs id: P passport, E (EORI) for an EU / UK / CH / NO party, else T (tax id)
function customsIdForParty(party, countryCode = '') {
  if (!party) return 'T';
  const contactType = party.ctxType || (party.addresses && party.addresses[0] && party.addresses[0].ctxType) || '';
  if (contactType.toLowerCase() === 'passport') return 'P';
  if (countryCode && EORI_COUNTRIES.includes(countryCode)) return 'E';
  return 'T';
}

// tax id of a party: its own fields first, else a GSTIN / IEC / VAT number found in its name and address
function taxIdFromParty(party) {
  if (!party) return '';
  const ownId = party.regNo || party.gstin || party.taxId || party.vat || party.iec || party.panNumber;
  if (ownId) return ownId.toUpperCase();
  const details = `${party.name || ''} ${party.address1 || ''} ${party.address2 || ''} ${party.city || ''} ${party.state || ''} ${party.zipCode || ''} ${party.email || ''}`.toUpperCase();
  for (const pattern of [GSTIN, IEC, VAT]) {
    const match = details.match(pattern);
    if (match) return match[0];
  }
  return '';
}

// tax id as the party picker stores it
const pickedTaxId = (party) => party.regNo || party.gstin || party.taxId
  || (party.addresses && party.addresses[0] && (party.addresses[0].regNo || party.addresses[0].gstin))
  || party.panNumber || party.iec || '';

const pickedCountry = (party, fallback) => countryCodeOf(party.countryCode || party.country || (party.addresses && party.addresses[0]?.country) || fallback);

// the SHP / CNE row of the list follows the picked party (added, updated or removed)
function syncPartyRow(rows, infoId, party, countryCode, rowId) {
  if (!party) return rows.filter((row) => row.infoId !== infoId);
  const taxId = pickedTaxId(party);
  if (!taxId || !countryCode) return rows;
  const customsId = customsIdForParty(party, countryCode);
  const existing = rows.find((row) => row.infoId === infoId);
  if (existing) return rows.map((row) => (row === existing ? { ...row, countryCode, suppInfo: taxId, customsId } : row));
  return [...rows, { id: rowId, countryCode, infoId, customsId, suppInfo: taxId }];
}

const CSD_ROWS = [
  { offset: 101, infoId: 'SEC', customsId: 'V', suppInfo: 'SPX' },
  { offset: 102, infoId: 'SEC', customsId: 'SM', suppInfo: 'XRY' },
  { offset: 103, infoId: 'SEC', customsId: 'RA', suppInfo: '' },
];

export default function useOciRows({ parties, depAirport, destAirport, masterAirports }) {
  const [ociRows, setOciRows] = useState([{ id: 1, countryCode: '', infoId: '', customsId: '', suppInfo: '' }]);

  const shipperCountry = () => countryCodeOf(parties.Shipper?.country || airportCountryOf(depAirport, masterAirports) || 'IN');

  const handleOciChange = (id, field, value) => {
    setOciRows((previous) => previous.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  // security declaration rows (SEC) added once each
  const handleAutoFilleCSD = () => {
    const countryCode = shipperCountry();
    const now = Date.now();
    const rows = [...ociRows];
    CSD_ROWS.forEach(({ offset, ...csdRow }) => {
      if (!rows.some((row) => row.infoId === csdRow.infoId && row.customsId === csdRow.customsId)) rows.push({ id: now + offset, countryCode, ...csdRow });
    });
    setOciRows(rows);
  };

  const handleSmartAutoFillOCI = () => {
    const rows = [];
    const shipperTaxId = taxIdFromParty(parties.Shipper);
    if (shipperTaxId) {
      const countryCode = shipperCountry();
      rows.push({ id: Date.now(), countryCode, infoId: 'SHP', customsId: customsIdForParty(parties.Shipper, countryCode), suppInfo: shipperTaxId });
    }
    const consigneeCountry = countryCodeOf(parties.Consignee?.country || airportCountryOf(destAirport, masterAirports) || '');
    const countryCode = COUNTRY_CORRECTIONS[consigneeCountry] || consigneeCountry;
    const consigneeTaxId = taxIdFromParty(parties.Consignee);
    if (consigneeTaxId) {
      rows.push({ id: Date.now() + 1, countryCode, infoId: 'CNE', customsId: EORI_COUNTRIES.includes(countryCode) ? 'E' : 'T', suppInfo: consigneeTaxId });
    }
    setOciRows(rows);
  };

  useEffect(() => {
    const untouched = ociRows.length === 0 || (ociRows.length === 1 && !ociRows[0].suppInfo);
    if (untouched && (parties.Shipper?.name || parties.Consignee?.name || destAirport)) handleSmartAutoFillOCI();
  }, [parties, depAirport, destAirport]); // eslint-disable-line react-hooks/exhaustive-deps -- fills only an untouched list

  useEffect(() => {
    setOciRows((previous) => {
      const shipper = parties.Shipper;
      const consignee = parties.Consignee;
      const now = Date.now();
      let rows = previous || [];
      rows = syncPartyRow(rows, 'SHP', shipper, shipper && pickedCountry(shipper, airportCountryOf(depAirport, masterAirports) || 'IN'), now);
      rows = syncPartyRow(rows, 'CNE', consignee, consignee && pickedCountry(consignee, airportCountryOf(destAirport, masterAirports) || ''), now + 1);
      return JSON.stringify(rows) === JSON.stringify(previous || []) ? previous : rows;
    });
  }, [parties.Shipper, parties.Consignee]); // eslint-disable-line react-hooks/exhaustive-deps -- follows the picked shipper / consignee only

  return {
    ociRows, setOciRows, handleOciChange, handleAutoFilleCSD, handleSmartAutoFillOCI, getCustomsIdForParty: customsIdForParty,
  };
}
