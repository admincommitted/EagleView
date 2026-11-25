// An AWB number is a 3-digit airline prefix + a 7-digit serial + a check digit (serial mod 7). The serial is typed as
// "first 4" + "last 4" digits, the last of which is the check digit.

const SERIAL_DIGITS = 7;

// the last AWB of a run of `count` numbers from first4 + last4, shown as "1234 5675"; null until all 8 digits and a count are typed
export function lastAwbOf(first4, last4, count) {
  if (first4.length + last4.length !== 8 || !count || isNaN(count)) return null;
  const startSerial = parseInt(first4 + last4.substring(0, 3), 10);
  const endSerial = startSerial + parseInt(count, 10) - 1;
  const endText = endSerial.toString().padStart(SERIAL_DIGITS, '0') + (endSerial % 7).toString();
  return `${endText.substring(0, 4)} ${endText.substring(4)}`;
}

// '' or why the AWB run cannot be generated
export function awbRunProblem({ prefix3, first4, last4, count }) {
  if (!/^\d{3}$/.test(prefix3) || !/^\d+$/.test(String(count).trim()) || parseInt(count, 10) < 1) {
    return 'Please enter valid 3-digit Airline Prefix and Count (NO OF AWB).';
  }
  if (!/^\d{4}$/.test(first4) || !/^\d{4}$/.test(last4)) return 'Error: enter the first AWB serial as 4 + 4 digits (last digit = check digit).';
  const startSerial = first4 + last4.substring(0, 3);
  if (Number(startSerial) % 7 !== Number(last4[3])) return `Error: check digit is wrong. For ${startSerial} it must be ${Number(startSerial) % 7} (serial mod 7).`;
  return '';
}

// the 8-digit start (serial + check digit) sent to the server
export const startSerialOf = (first4, last4) => first4 + last4.substring(0, 3) + last4[3];

// HAWB Ending No while typing: Starting No + Count - 1, same digit length; after Save it is the server's value
export function hawbEndOf(startNo, count, savedEndNo) {
  if (/^\d+$/.test(startNo) && /^\d+$/.test(String(count)) && parseInt(count, 10) >= 1 && startNo.length <= 15) {
    return String(parseInt(startNo, 10) + parseInt(count, 10) - 1).padStart(startNo.length, '0');
  }
  return savedEndNo;
}
