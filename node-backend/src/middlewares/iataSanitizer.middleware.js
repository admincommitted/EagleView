// Characters airlines reject in IATA messages: , @ # $ % * become a space and & becomes AND
const IATA_BANNED_CHARACTERS = /[,@#$%*]/g;
const AMPERSAND = /&/g;
const REPEATED_WHITESPACE = /\s{2,}/g;

const cleanIataText = (text) =>
  text.replace(IATA_BANNED_CHARACTERS, ' ').replace(AMPERSAND, 'AND').replace(REPEATED_WHITESPACE, ' ');

function sanitizeInPlace(value) {
  for (const key in value) {
    if (typeof value[key] === 'string') value[key] = cleanIataText(value[key]);
    else if (typeof value[key] === 'object' && value[key] !== null) sanitizeInPlace(value[key]);
  }
}

/** Cleans every string in req.body (nested objects and arrays too) for IATA compliance. */
export function sanitizeIataPayload(req, res, next) {
  if (req.body) sanitizeInPlace(req.body);
  next();
}

export default sanitizeIataPayload;
