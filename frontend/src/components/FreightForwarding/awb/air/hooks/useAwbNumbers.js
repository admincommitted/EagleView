import { useState } from 'react';

// red border of the AWB number box: the 8th serial digit is the first seven mod 7 (IATA check digit)
function checkDigitError(awbSuffix) {
  if (!awbSuffix || awbSuffix.length < 8) return null;
  const serial = parseInt(awbSuffix.substring(0, 7), 10);
  const checkDigit = parseInt(awbSuffix.substring(7, 8), 10);
  if (serial % 7 === checkDigit) return null;
  return 'Invalid check digit (expected ' + (serial % 7) + ', got ' + checkDigit + '). MOD-7 validation failed.';
}

export default function useAwbNumbers({ masterAirlines }) {
  const [awbPrefix, setAwbPrefix] = useState('');
  const [awbSuffix, setAwbSuffix] = useState('');
  const [hawbNumber, setHawbNumber] = useState('');

  const foundAirline = masterAirlines.find((airline) => airline.prefix === awbPrefix);

  return {
    awbPrefix, setAwbPrefix, awbSuffix, setAwbSuffix, hawbNumber, setHawbNumber,
    awbNo: awbPrefix + awbSuffix,
    getAwbError: () => checkDigitError(awbSuffix),
    foundAirline,
    airlineName: foundAirline ? foundAirline.name : null,
    airlineCode: foundAirline ? (foundAirline.code2 || '') : '',
  };
}
