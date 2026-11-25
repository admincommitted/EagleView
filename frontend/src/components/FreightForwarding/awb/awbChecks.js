// Save checks shared by the AWB / MAWB / HAWB screens. The server checks the same rules again.
const numberOrBlank = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : NaN;
};

export function routeError(origin, destination) {
  const originCode = String(origin || '').trim().toUpperCase();
  const destinationCode = String(destination || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(originCode) || !/^[A-Z]{3}$/.test(destinationCode)) return 'Origin and Destination must be 3-letter airport codes (letters only).';
  if (originCode === destinationCode) return 'Origin and Destination cannot be the same airport.';
  return null;
}

export function rateLineErrors(rateLines) {
  const errors = [];
  (rateLines || [])
    .filter((line) => line && (line.noOfPcs || line.pieces || line.grossWeight || line.chargeableWeight))
    .forEach((line, index) => {
      const label = `Rate line ${index + 1}`;
      const pieces = numberOrBlank(line.noOfPcs ?? line.pieces);
      const gross = numberOrBlank(line.grossWeight);
      const chargeable = numberOrBlank(line.chargeableWeight);
      if (gross > 0 && pieces === null) errors.push(`${label}: No. of pieces is required.`);
      else if (pieces !== null && (Number.isNaN(pieces) || pieces < 1 || !Number.isInteger(pieces))) errors.push(`${label}: No. of pieces must be a whole number (1 or more).`);
      if (Number.isNaN(gross) || gross < 0) errors.push(`${label}: Gross weight must be 0 or more.`);
      if (Number.isNaN(chargeable) || chargeable < 0) errors.push(`${label}: Chargeable weight must be 0 or more.`);
      else if (chargeable > 0 && gross > 0 && chargeable + 0.001 < gross) errors.push(`${label}: Chargeable weight (${chargeable}) cannot be less than gross weight (${gross}).`);
    });
  return errors;
}

export function chargeErrors(otherCharges) {
  const errors = [];
  (otherCharges || []).forEach((charge, index) => {
    if (!charge || !charge.code) return;
    const amount = numberOrBlank(charge.amount);
    if (Number.isNaN(amount) || amount < 0) errors.push(`Other charge ${charge.code} (row ${index + 1}): amount must be 0 or more.`);
  });
  return errors;
}
