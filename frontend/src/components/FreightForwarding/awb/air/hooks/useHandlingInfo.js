import { useEffect, useState } from 'react';
import { airportCountryOf } from '../../awbValidate';
import {
  AIRPORT_COUNTRY_FALLBACK, SCI_T1_COUNTRIES, SPH_TEXT_RULES, TEMPLATE_PRESETS, countryCodeOf, emptySphCodes,
} from './airWaybillData';

const withoutLine = (text, line) => text.split('\n').filter((existing) => existing !== line).join('\n');
const withLine = (text, line) => (text.includes(line) ? text : (text ? text + '\n' : '') + line);
const trimBlankLines = (text) => text.replace(/^\n+|\n+$/g, '');

// SSR / OSI lines follow the special handling codes: lines of removed codes go, lines of new codes are added
function textsForCodes(sphCodes, ssrText, osiText) {
  let ssr = ssrText || '';
  let osi = osiText || '';
  SPH_TEXT_RULES.filter((rule) => !sphCodes.includes(rule.code)).forEach((rule) => {
    if (rule.ssr) ssr = withoutLine(ssr, rule.ssr);
    if (rule.osi) osi = withoutLine(osi, rule.osi);
  });
  SPH_TEXT_RULES.filter((rule) => sphCodes.includes(rule.code)).forEach((rule) => {
    if (rule.ssr) ssr = withLine(ssr, rule.ssr);
    if (rule.osi) osi = withLine(osi, rule.osi);
  });
  return { ssr: trimBlankLines(ssr), osi: trimBlankLines(osi) };
}

// SCI: T1 for an EU / CH / NO consignee, X for any other known country
function consigneeCountryForSci(destAirport, parties, masterAirports) {
  const consigneeCountry = parties.Consignee?.country;
  let country = countryCodeOf(consigneeCountry || airportCountryOf(destAirport, masterAirports) || '');
  if (destAirport && !consigneeCountry) {
    for (const [airports, fallbackCountry] of AIRPORT_COUNTRY_FALLBACK) {
      if (airports.includes(destAirport)) country = fallbackCountry;
    }
  }
  return country;
}

const mentionsPharma = (goods) => goods.includes('PHARMA') || goods.includes('MEDICINE');

export default function useHandlingInfo({ destAirport, parties, masterAirports }) {
  const [sphCodes, setSphCodes] = useState(emptySphCodes);
  const [ssrText, setSsrText] = useState('');
  const [osiText, setOsiText] = useState('');
  const [sci, setSci] = useState('');
  const [natureOfGoods, setNatureOfGoods] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('SELECT');

  const handleLoadTemplate = () => {
    const preset = TEMPLATE_PRESETS[selectedTemplate];
    if (!preset) return;
    setNatureOfGoods(preset.natureOfGoods);
    setSphCodes([...preset.sphCodes]);
    setSsrText(preset.ssrText);
  };

  useEffect(() => {
    if (sci) return; // a code picked by hand stays
    if (!destAirport && !parties.Consignee?.country) return;
    const country = consigneeCountryForSci(destAirport, parties, masterAirports);
    if (SCI_T1_COUNTRIES.includes(country)) setSci('T1');
    else if (country) setSci('X');
  }, [destAirport, parties, sci]); // eslint-disable-line react-hooks/exhaustive-deps -- the airport master only helps; it does not re-run the guess

  useEffect(() => {
    const { ssr, osi } = textsForCodes(sphCodes, ssrText, osiText);
    if (ssr !== ssrText) setSsrText(ssr);
    if (osi !== osiText) setOsiText(osi);
  }, [sphCodes]); // eslint-disable-line react-hooks/exhaustive-deps -- runs only when the codes change, typed text is kept

  useEffect(() => {
    if (!mentionsPharma(natureOfGoods) || sphCodes.includes('PIL')) return;
    const emptyIndex = sphCodes.findIndex((code) => code === '');
    if (emptyIndex === -1) return;
    const codes = [...sphCodes];
    codes[emptyIndex] = 'PIL';
    setSphCodes(codes);
  }, [natureOfGoods]); // eslint-disable-line react-hooks/exhaustive-deps -- only a new goods text adds PIL

  return {
    sphCodes, setSphCodes, ssrText, setSsrText, osiText, setOsiText, sci, setSci,
    natureOfGoods, setNatureOfGoods, selectedTemplate, setSelectedTemplate, handleLoadTemplate,
  };
}
