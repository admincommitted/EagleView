import { stateInfoFor } from '../ctxCodes';

// named boxes and the autoField_* keys the ICEGATE JSON builder reads must hold the same value
const HEADER_FIELD_ALIASES = {
  chaCode: 'autoField_3', nameOfImporter: 'autoField_4', iecCode: 'autoField_5', address1: 'autoField_6', address2: 'autoField_7',
  city: 'autoField_8', state: 'autoField_9', pin: 'autoField_10', branchSrNo: 'autoField_48', aeoCode: 'autoField_49',
  igmDate: 'autoField_14', mawbDate: 'autoField_15', hawbDate: 'autoField_16', inwardDate: 'autoField_17',
  autoField_50: 'commercialTaxType', autoField_13: 'commercialTaxRegistrationNo', autoField_11: 'ctxStateName', autoField_12: 'stateCode',
  mawbNo: 'mawbblNo', hawbNo: 'hawbhblNo', igmNumber: 'igmNo', portCode: 'autoField_2',
};

export const withHeaderField = (previous, name, value, states) => {
  const next = { ...previous, [name]: value };
  if (HEADER_FIELD_ALIASES[name]) next[HEADER_FIELD_ALIASES[name]] = value;
  if (name === 'autoField_11') {
    next.autoField_12 = stateInfoFor(states, value).taxCode;
    next.stateCode = next.autoField_12;
  }
  return next;
};

export const withGatewayPort = (previous, ports, text) => {
  const port = ports.find((candidate) => candidate.portName === text || candidate.portCode === text);
  return port
    ? { ...previous, gatewayPortName: port.portName, gatewayPortCode: port.portCode }
    : { ...previous, gatewayPortName: text };
};

// grid rows saved with the job come back as a list, or as JSON text from older saves
export const rowsFrom = (saved) => {
  if (typeof saved !== 'string') return Array.isArray(saved) ? saved : [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const listFrom = (response) => (Array.isArray(response) ? response : response?.data || []);

export const upsertRow = (rows, index, row) => (index === null ? [...rows, row] : rows.map((existing, rowIndex) => (rowIndex === index ? row : existing)));

export const defaultChaLabel = (chaList) => {
  const defaultCha = chaList.find((cha) => cha.isDefault);
  return defaultCha ? `${defaultCha.chaName} - ${defaultCha.chaCode}` : '';
};

const isRealDate = ([year, month, day]) => {
  const date = new Date(+year, +month - 1, +day);
  return +year >= 1900 && date.getFullYear() === +year && date.getMonth() === +month - 1 && date.getDate() === +day;
};

// '' when blank, DD/MM/YYYY for a real date typed as YYYY-MM-DD, DDMMYYYY, YYYYMMDD or D/M/YYYY, null otherwise
export const certificateDisplayDate = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const candidates = []; // [YYYY, MM, DD]
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) candidates.push([isoMatch[1], isoMatch[2], isoMatch[3]]);
  if (/^\d{8}$/.test(text)) candidates.push([text.slice(4), text.slice(2, 4), text.slice(0, 2)], [text.slice(0, 4), text.slice(4, 6), text.slice(6)]);
  const dayFirstMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (dayFirstMatch) candidates.push([dayFirstMatch[3], dayFirstMatch[2].padStart(2, '0'), dayFirstMatch[1].padStart(2, '0')]);
  const realDate = candidates.find(isRealDate);
  return realDate ? `${realDate[2]}/${realDate[1]}/${realDate[0]}` : null;
};
