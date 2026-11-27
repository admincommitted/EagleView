import { parseDocument } from 'htmlparser2';
import * as DomUtils from 'domutils';

// Reads the answer page of DGFT "View Any IEC": the IEC details, the branches and the people of the firm.
const LABELS = [
  'IEC Number',
  'PAN Number',
  'Date of Birth / Incorporation',
  'IEC Issuance Date',
  'IEC Status',
  'DEL Status',
  'IEC Cancelled Date',
  'IEC Suspended Date',
  'File Number',
  'File Date',
  'DGFT RA Office',
  'Nature of Concern / Firm',
  'Category of Exporters',
  'Firm Name',
  'Address',
];
const BLOCK_TAGS = new Set([
  'p',
  'div',
  'td',
  'th',
  'tr',
  'li',
  'label',
  'span',
  'b',
  'strong',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'br',
  'dt',
  'dd',
  'section',
  'input',
]);
const STATES = [
  'ANDAMAN AND NICOBAR ISLANDS',
  'ANDHRA PRADESH',
  'ARUNACHAL PRADESH',
  'ASSAM',
  'BIHAR',
  'CHANDIGARH',
  'CHHATTISGARH',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
  'DADRA AND NAGAR HAVELI',
  'DAMAN AND DIU',
  'DELHI',
  'GOA',
  'GUJARAT',
  'HARYANA',
  'HIMACHAL PRADESH',
  'JAMMU AND KASHMIR',
  'JHARKHAND',
  'KARNATAKA',
  'KERALA',
  'LADAKH',
  'LAKSHADWEEP',
  'MADHYA PRADESH',
  'MAHARASHTRA',
  'MANIPUR',
  'MEGHALAYA',
  'MIZORAM',
  'NAGALAND',
  'ODISHA',
  'ORISSA',
  'PUDUCHERRY',
  'PONDICHERRY',
  'PUNJAB',
  'RAJASTHAN',
  'SIKKIM',
  'TAMIL NADU',
  'TELANGANA',
  'TRIPURA',
  'UTTAR PRADESH',
  'UTTARAKHAND',
  'UTTARANCHAL',
  'WEST BENGAL',
];
// ICEGATE takes Address 1 = 35 and Address 2 = 35 (the BE / SB JSON cuts there), and AWB EDI 35 per line too
const ADDRESS_LINE_LENGTH = 35;
const MAX_CITY_LENGTH = 40;
const BLOCK_MARK = '\u0001';
const TEXT_MARK = '\u0002';
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

const normalizeText = (text) =>
  String(text || '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const labelKey = (text) =>
  normalizeText(text)
    .replace(/[:*]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/');
const LABEL_BY_KEY = new Map(LABELS.map((label) => [labelKey(label), label]));

/** The page text as tokens, a mark around every block tag; tables are read separately. */
function textTokens(node, tokens) {
  for (const child of node.children || []) {
    if (child.type === 'text') {
      const text = normalizeText(child.data);
      if (text) tokens.push(text);
    } else if (child.type === 'tag' || child.type === 'script' || child.type === 'style') {
      if (child.name === 'script' || child.name === 'style' || child.name === 'table') continue;
      if (BLOCK_TAGS.has(child.name)) tokens.push(BLOCK_MARK);
      textTokens(child, tokens);
      if (BLOCK_TAGS.has(child.name)) tokens.push(BLOCK_MARK);
    }
  }
  return tokens;
}

function tableRows(table) {
  return DomUtils.findAll((element) => element.name === 'tr', [table])
    .filter((row) => DomUtils.findAll((element) => element.name === 'table', row.children || []).length === 0)
    .map((row) =>
      (row.children || [])
        .filter((cell) => cell.name === 'td' || cell.name === 'th')
        .map((cell) => normalizeText(DomUtils.textContent(cell))),
    );
}

const trimCommas = (text) => text.replace(/^[,\s]+|[,\s]+$/g, '');

function splitLongWords(text, words, lineLength) {
  text
    .split(/\s+/)
    .filter(Boolean)
    .forEach((word) => {
      for (let start = 0; start < word.length; start += lineLength) words.push(word.slice(start, start + lineLength));
    });
}

/** Whole comma-parts first ("NEHRU PLACE" stays together); only a part longer than a line is broken on words. */
function packParts(parts, lineLength = ADDRESS_LINE_LENGTH) {
  const lines = ['', ''];
  let lineIndex = 0;
  const rest = [];
  const put = (text, separator) => {
    while (lineIndex < 2) {
      const candidate = lines[lineIndex] ? lines[lineIndex] + separator + text : text;
      if (candidate.length <= lineLength) {
        lines[lineIndex] = candidate;
        return true;
      }
      if (!lines[lineIndex]) return false;
      lineIndex += 1;
    }
    return false;
  };
  for (const part of (parts || []).map((value) => String(value || '').trim()).filter(Boolean)) {
    if (lineIndex >= 2) {
      rest.push(part);
      continue;
    }
    if (put(part, ', ')) continue;
    // too long for one line: words, continuing on the current line
    const words = [];
    splitLongWords(part, words, lineLength);
    let first = true;
    const left = [];
    for (const word of words) {
      if (left.length || lineIndex >= 2 || !put(word, first ? ', ' : ' ')) left.push(word);
      first = false;
    }
    if (left.length) rest.push(left.join(' '));
  }
  return { address1: trimCommas(lines[0]), address2: trimCommas(lines[1]), overflow: trimCommas(rest.join(', ')) };
}

function packWords(parts, lineLength = ADDRESS_LINE_LENGTH) {
  const words = [];
  splitLongWords(String((parts || []).filter(Boolean).join(', ')), words, lineLength);
  const lines = ['', ''];
  let lineIndex = 0;
  const rest = [];
  for (const word of words) {
    while (lineIndex < 2) {
      const candidate = lines[lineIndex] ? lines[lineIndex] + ' ' + word : word;
      if (candidate.length <= lineLength) {
        lines[lineIndex] = candidate;
        break;
      }
      lineIndex += 1;
    }
    if (lineIndex >= 2) rest.push(word);
  }
  return { address1: trimCommas(lines[0]), address2: trimCommas(lines[1]), overflow: trimCommas(rest.join(' ')) };
}

/**
 * The street parts packed into 35 + 35 on whole words; what does not fit is returned as overflow, never dropped.
 * Both ways are tried: the one that leaves less text out wins, whole parts on a tie.
 */
function pack35(parts, lineLength = ADDRESS_LINE_LENGTH) {
  const byParts = packParts(parts, lineLength);
  const byWords = packWords(parts, lineLength);
  return byWords.overflow.length < byParts.overflow.length ? byWords : byParts;
}

const pinPattern = (pin) => new RegExp('\\b' + pin.slice(0, 3) + '\\s?' + pin.slice(3) + '\\b');

/** The state written last wins ("DELHI MATHURA ROAD, FARIDABAD, HARYANA" is Haryana). */
function lastStateIn(text) {
  let state = '';
  let at = -1;
  for (const candidate of STATES) {
    const pattern = new RegExp('(^|[^A-Z])' + candidate.replace(/ /g, '\\s+') + '(?=[^A-Z]|$)', 'g');
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > at) {
        at = match.index;
        state = candidate;
      }
    }
  }
  return state;
}

const withoutPinAndCountry = (part, pin) =>
  (pin ? part.replace(pinPattern(pin), '') : part)
    .replace(/\bINDIA\b/, '')
    .replace(/^[\s-]+|[\s-]+$/g, '')
    .trim();

/** DGFT writes "street, street, CITY, DISTRICT, STATE, PIN": the city is taken before the district. */
function splitByState(parts, state, pin, withDistrict) {
  const base = parts.map((part) => withoutPinAndCountry(part, pin)).filter(Boolean);
  const stateIndex = base.lastIndexOf(state);
  if (stateIndex >= 0) base.splice(stateIndex, 1);
  const count = base.length;
  if (count >= 2 && (base[count - 1] === state || base[count - 1] === 'NEW ' + state)) {
    return { ...pack35(base.slice(0, count - 1)), city: base[count - 1], state, pinCode: pin };
  }
  if (
    withDistrict &&
    count >= 4 &&
    !/\d/.test(base[count - 1]) &&
    !/\d/.test(base[count - 2]) &&
    base[count - 2].length <= MAX_CITY_LENGTH
  ) {
    return {
      ...pack35(base.slice(0, count - 2)),
      city: base[count - 2],
      district: base[count - 1],
      state,
      pinCode: pin,
    };
  }
  return null;
}

const withoutTrailingDigits = (part) => part.replace(/[-\d\s]+$/, '').trim();

function guessCity(parts, cleanParts, state, fullText) {
  let city = '';
  if (state === 'DELHI' || state === 'CHANDIGARH') {
    const union = parts.map(withoutTrailingDigits).find((part) => part === state || part === 'NEW ' + state);
    if (union) city = union;
  }
  if (!city) {
    for (let index = cleanParts.length - 1; index >= 0; index -= 1) {
      const part = withoutTrailingDigits(cleanParts[index]);
      if (part && part.length <= MAX_CITY_LENGTH && !/\d/.test(part)) {
        city = part;
        break;
      }
    }
  }
  if (!city && state === 'DELHI') city = /NEW\s+DELHI/.test(fullText) ? 'NEW DELHI' : 'DELHI';
  return city;
}

/** "PLOT 12, MIDC, ANDHERI EAST, MUMBAI, MAHARASHTRA, 400093" -> the pieces of the branch form. */
export function splitAddress(address, withDistrict = true) {
  const fullText = normalizeText(address).toUpperCase();
  const pin =
    (fullText.match(/(?:^|\D)(\d{3}\s?\d{3})(?!\d)/g) || []).map((value) => value.replace(/\D/g, '')).pop() || '';
  const state = lastStateIn(fullText);
  const parts = fullText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (state) {
    const byState = splitByState(parts, state, pin, withDistrict);
    if (byState) return byState;
  }
  const cleanParts = parts
    .map((part) => {
      const cleaned = (pin ? part.replace(pinPattern(pin), ' ') : part)
        .replace(/\bINDIA\b/, '')
        .replace(/^[\s-]+|[\s-]+$/g, '')
        .trim();
      // only a part that is just the state name is dropped ("NORTH WEST DELHI" stays)
      return cleaned === state ? '' : cleaned;
    })
    .filter(Boolean);
  const city = guessCity(parts, cleanParts, state, fullText);
  // only the last part that is the city is taken out ("..., PITHAMPUR, DISTT. DHAR, PITHAMPUR, MP" keeps the first one)
  let cityIndex = -1;
  for (let index = cleanParts.length - 1; index >= 0; index -= 1) {
    if (withoutTrailingDigits(cleanParts[index]) === city) {
      cityIndex = index;
      break;
    }
  }
  const street = cleanParts.filter((part, index) => index !== cityIndex);
  return { ...pack35(street), city, state, pinCode: pin };
}

// header like "Branch Code | GSTIN | Branch Address" or "Branch Sr. No. | GSTIN | Address" (the live page uses Sr. No.)
const isBranchHeader = (row) =>
  row.length >= 2 &&
  row.length <= 8 &&
  row.some((cell) => /address/i.test(cell)) &&
  (row.some((cell) => /branch/i.test(cell)) || row.some((cell) => /^gst/i.test(cell))) &&
  !row.some((cell) => /^name$|father|designation/i.test(cell));
const isPeopleHeader = (row) => row.some((cell) => /^name$/i.test(cell) || /father|designation|director/i.test(cell));

function readBranches(rows, headerIndex, branches) {
  const header = rows[headerIndex].map((cell) => cell.toLowerCase());
  const columnOf = (pattern) => header.findIndex((cell) => pattern.test(cell));
  let codeColumn = columnOf(/branch\s*(code|sr|s\.?\s*no|no)/);
  if (codeColumn < 0) codeColumn = columnOf(/^(sr|s)\.?\s*no|code/);
  const gstColumn = columnOf(/gst/);
  const addressColumn = columnOf(/address/);
  for (const row of rows.slice(headerIndex + 1)) {
    const address = row[addressColumn >= 0 ? addressColumn : row.length - 1];
    if (row.length < 2 || !address) continue;
    const gstin = (gstColumn >= 0 ? row[gstColumn] : '').replace(/\s/g, '').toUpperCase();
    const fullGstin = GSTIN_PATTERN.test(gstin) ? gstin : '';
    branches.push({
      branchCode: codeColumn >= 0 ? row[codeColumn] : '',
      gstin: fullGstin,
      gstinMasked: fullGstin ? '' : gstin,
      address,
      // branch addresses have no district part
      ...splitAddress(address, false),
    });
  }
}

function readPeople(rows, headerIndex, people) {
  const header = rows[headerIndex];
  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some(Boolean)) continue;
    const person = {};
    header.forEach((title, index) => {
      if (title) person[title] = row[index] || '';
    });
    people.push(person);
  }
}

function readLabelledCells(rows, details) {
  for (const row of rows) {
    for (let index = 0; index + 1 < row.length; index += 1) {
      const label = LABEL_BY_KEY.get(labelKey(row[index]));
      if (label && !details[label] && row[index + 1] && !LABEL_BY_KEY.has(labelKey(row[index + 1])))
        details[label] = row[index + 1];
    }
  }
}

/** Labels written outside tables (div / label layout): "Label" followed by its value, or "Label: value". */
function readLabelledText(page, details) {
  const blocks = textTokens(page, [])
    .join(TEXT_MARK)
    .split(BLOCK_MARK)
    .map((block) => block.split(TEXT_MARK).map(normalizeText).filter(Boolean).join(' '))
    .filter(Boolean);
  for (let index = 0; index < blocks.length; index += 1) {
    let label = LABEL_BY_KEY.get(labelKey(blocks[index]));
    let value = '';
    if (label) {
      value = blocks[index + 1] && !LABEL_BY_KEY.has(labelKey(blocks[index + 1])) ? blocks[index + 1] : '';
    } else {
      const match = blocks[index].match(/^([^:]{3,40}):\s*(.+)$/);
      if (match && LABEL_BY_KEY.has(labelKey(match[1]))) {
        label = LABEL_BY_KEY.get(labelKey(match[1]));
        value = match[2];
      }
    }
    if (label && value && !details[label]) details[label] = value;
  }
}

/** The hidden fields, IEC details, branches and people of the DGFT answer page. */
export function parseResult(html) {
  const page = parseDocument(String(html || ''));
  const hidden = {};
  for (const input of DomUtils.findAll((element) => element.name === 'input', page.children)) {
    const id = input.attribs.id || input.attribs.name;
    if (id) hidden[id] = input.attribs.value || '';
  }
  const details = {};
  const branches = [];
  const people = [];
  for (const table of DomUtils.findAll((element) => element.name === 'table', page.children)) {
    const rows = tableRows(table).filter((row) => row.some(Boolean));
    if (!rows.length) continue;
    const branchHeaderIndex = rows.findIndex(isBranchHeader);
    const peopleHeaderIndex = rows.findIndex(isPeopleHeader);
    if (branchHeaderIndex >= 0) readBranches(rows, branchHeaderIndex, branches);
    else if (peopleHeaderIndex >= 0) readPeople(rows, peopleHeaderIndex, people);
    else readLabelledCells(rows, details);
  }
  readLabelledText(page, details);
  const text = normalizeText(DomUtils.textContent(page));
  return {
    hidden,
    details,
    branches,
    people,
    text,
    firmAddress: details.Address ? splitAddress(details.Address) : null,
  };
}
