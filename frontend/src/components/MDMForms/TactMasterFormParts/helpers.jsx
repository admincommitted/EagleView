import html2pdf from 'html2pdf.js';
import { rgbColorsForHtml2canvas } from '@/lib/cssColors';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

const DIAMOND = '50,0 100,50 50,100 0,50';
const TOP_HALF = '50,0 100,50 0,50';
const diamond = (fill) => `<polygon points="${DIAMOND}" fill="${fill}" />`;

const DGR_ICONS = {
  flame: '<path d="M50 20 Q55 35 60 50 Q65 65 50 80 Q35 65 40 50 Q45 35 50 20 Z M50 40 Q45 55 50 70 Q55 55 50 40 Z" fill="currentColor" />',
  cylinder: '<path d="M40 30 L60 30 L60 20 Q50 15 40 20 Z M40 30 L40 70 A10 10 0 0 0 60 70 L60 30 Z" fill="currentColor" />',
  skull: '<g fill="currentColor"><path d="M50 25 A15 15 0 0 0 35 40 Q35 50 40 55 L40 60 L60 60 L60 55 Q65 50 65 40 A15 15 0 0 0 50 25 Z M42 40 A3 3 0 1 1 48 40 A3 3 0 1 1 42 40 Z M52 40 A3 3 0 1 1 58 40 A3 3 0 1 1 52 40 Z M47 55 L53 55 L53 50 L47 50 Z" /><path d="M30 65 L40 55 M70 65 L60 55 M30 35 L40 45 M70 35 L60 45" stroke="currentColor" stroke-width="4" /></g>',
  radioactive: '<g fill="currentColor"><circle cx="50" cy="40" r="5" /><path d="M50 30 A15 15 0 0 0 35 20 L50 40 Z M50 30 A15 15 0 0 1 65 20 L50 40 Z M35 55 A15 15 0 0 0 65 55 L50 40 Z" /></g>',
  corrosive: '<g fill="currentColor"><rect x="35" y="45" width="30" height="5" /><path d="M30 20 L35 20 L35 40 L30 40 Z M40 40 L45 40 L45 20 L40 20 Z" /><circle cx="32" cy="45" r="2" /><circle cx="42" cy="45" r="2" /></g>',
  biohazard: '<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="50" cy="45" r="10" /><circle cx="40" cy="35" r="12" /><circle cx="60" cy="35" r="12" /><circle cx="50" cy="55" r="12" /></g>',
  oxidizer: '<g fill="currentColor"><circle cx="50" cy="65" r="15" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50 15 Q55 35 60 45 Q65 65 50 75 Q35 65 40 45 Q45 35 50 15 Z" /></g>',
  explosive: '<g fill="currentColor"><circle cx="50" cy="45" r="12" /><path d="M50 20 L50 30 M80 45 L70 45 M50 70 L50 60 M20 45 L30 45 M25 25 L35 35 M75 25 L65 35 M75 65 L65 55 M25 65 L35 55" stroke="currentColor" stroke-width="3" /></g>',
  lithiumBattery: '<g fill="currentColor"><rect x="30" y="60" width="15" height="25" rx="2" /><rect x="34" y="57" width="7" height="3" /><rect x="55" y="60" width="15" height="25" rx="2" /><rect x="59" y="57" width="7" height="3" /><path d="M40 70 L45 65 L45 75 Z" /><path d="M48 65 Q50 60 53 65 Q55 70 48 75 Z" /></g>',
};

// lithium batteries (UN 3480 / 3481 / 3090 / 3091) carry the class 9 battery label
const LITHIUM_UN_NUMBERS = ['3480', '3481', '3090', '3091'];
const isLithiumGoods = (unNumber, properName) =>
  LITHIUM_UN_NUMBERS.some((number) => unNumber.includes(number)) || String(properName || '').toUpperCase().includes('LITHIUM');

function dgrIcon(baseClass, isLithium) {
  if (baseClass.startsWith('1')) return DGR_ICONS.explosive;
  if (baseClass.startsWith('2.1') || baseClass.startsWith('3') || baseClass.startsWith('4') || baseClass === '5.2') return DGR_ICONS.flame;
  if (baseClass === '2.2') return DGR_ICONS.cylinder;
  if (baseClass === '2.3') return DGR_ICONS.skull;
  if (baseClass === '5.1') return DGR_ICONS.oxidizer;
  if (baseClass.startsWith('6.1')) return DGR_ICONS.skull;
  if (baseClass.startsWith('6.2')) return DGR_ICONS.biohazard;
  if (baseClass.startsWith('7')) return DGR_ICONS.radioactive;
  if (baseClass.startsWith('8')) return DGR_ICONS.corrosive;
  if (baseClass.startsWith('9') && isLithium) return DGR_ICONS.lithiumBattery;
  return '';
}

// the IATA hazard label backgrounds (4.2: upper half white, lower half red; 5.2: top red, bottom yellow)
function dgrBackground(baseClass) {
  if (baseClass.startsWith('1')) return diamond('#f97316');
  if (baseClass === '2.1' || baseClass === '3') return diamond('#ef4444');
  if (baseClass === '2.2') return diamond('#10b981');
  if (baseClass === '4.1') return `<g>${diamond('#ffffff')}<path d="M20,30 L40,10 M10,40 L60,-10 M0,50 L80,-30 M10,60 L100,-30 M20,70 L100,-10 M30,80 L100,10 M40,90 L100,30 M50,100 L100,50 M70,100 L100,70 M90,100 L100,90" stroke="#ef4444" stroke-width="6" /></g>`;
  if (baseClass === '4.2') return `<g><polygon points="${TOP_HALF}" fill="#ffffff" /><polygon points="50,100 100,50 50,0" fill="#ef4444" /></g>`;
  if (baseClass === '4.3') return diamond('#3b82f6');
  if (baseClass === '5.1') return diamond('#fde047');
  if (baseClass === '5.2') return `<g><polygon points="${TOP_HALF}" fill="#ef4444" /><polygon points="50,100 100,50 0,50" fill="#fde047" /></g>`;
  if (baseClass.startsWith('7')) return `<g>${diamond('#ffffff')}<polygon points="${TOP_HALF}" fill="#fde047" /></g>`;
  if (baseClass.startsWith('8')) return `<g>${diamond('#000000')}<polygon points="${TOP_HALF}" fill="#ffffff" /></g>`;
  if (baseClass.startsWith('9')) return `<g>${diamond('#ffffff')}<path d="M0,50 L50,0 L100,50 Z" fill="#ffffff" /><path d="M10,40 L10,0 M30,20 L30,0 M50,50 L50,0 M70,20 L70,0 M90,40 L90,0" stroke="#000000" stroke-width="6" /></g>`;
  return diamond('#ffffff');
}

// the inside of a 100 x 100 DGR hazard label <svg>: background, border, pictogram and class number
export function dgrLabelMarkup(classCode, unNumber = '', properName = '') {
  const baseClass = String(classCode).split(' ')[0].substring(0, 3);
  const iconColor = ['2.1', '3', '4.3', '5.2'].includes(baseClass) ? '#ffffff' : '#000000';
  let numberColor = iconColor;
  if (baseClass.startsWith('8')) numberColor = '#ffffff';
  if (baseClass === '5.2') numberColor = '#000000';

  return `${dgrBackground(baseClass)}
    <polygon points="50,2 98,50 50,98 2,50" fill="none" stroke="${numberColor}" stroke-width="2" />
    <g color="${iconColor}">${dgrIcon(baseClass, isLithiumGoods(String(unNumber ?? ''), properName))}</g>
    <text x="50" y="92" font-size="18" font-weight="900" font-family="Arial, sans-serif" fill="${numberColor}" text-anchor="middle">${escapeHtml(baseClass.substring(0, 1))}</text>`;
}

const isCargoAircraftOnly = (caoOnly) => caoOnly.startsWith('Yes') || caoOnly.startsWith('Strictly');

const LABEL_PAGE_STYLE = 'width: 800px; height: 800px; background-color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50px; font-family: Helvetica, Arial, sans-serif; box-sizing: border-box;';

const labelPageHtml = (item) => `
  <div style="border: 2px dashed #94a3b8; padding: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; box-sizing: border-box;">
    <h1 style="font-size: 64px; font-weight: 900; color: #000; margin: 0 0 10px 0; text-align: center;">${escapeHtml(item.unNumber)}</h1>
    <h2 style="font-size: 32px; font-weight: bold; color: #334155; margin: 0 0 60px 0; text-align: center; text-transform: uppercase;">${escapeHtml(item.properShippingName)}</h2>
    <svg width="400" height="400" viewBox="0 0 100 100" style="filter: drop-shadow(0 10px 15px rgba(0,0,0,0.3)); display: block;">
      ${dgrLabelMarkup(item.classDivision, item.unNumber, item.properShippingName)}
    </svg>
    <p style="font-size: 24px; font-weight: bold; margin-top: 60px; color: #000;">CLASS: ${escapeHtml(item.classDivision)}</p>
    ${isCargoAircraftOnly(item.caoOnly) ? '<div style="margin-top: 20px; background-color: #ef4444; color: #fff; padding: 10px 30px; font-size: 24px; font-weight: bold; border-radius: 10px;">CARGO AIRCRAFT ONLY</div>' : ''}
  </div>`;

// An 800 x 800 px PDF of the item's DGR hazard label: opened in a new tab and downloaded.
export async function generateLabelPdf(item) {
  const fileName = `DGR_LABEL_${item.unNumber}.pdf`;
  const container = document.createElement('div');
  container.style.cssText = LABEL_PAGE_STYLE;
  container.innerHTML = labelPageHtml(item);
  document.body.appendChild(container);

  try {
    const pdfBlob = await html2pdf().set({
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true, ...rgbColorsForHtml2canvas },
      jsPDF: { unit: 'px', format: [800, 800], orientation: 'portrait' },
    }).from(container).outputPdf('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
    Object.assign(document.createElement('a'), { href: pdfUrl, download: fileName }).click();
  } finally {
    container.remove();
  }
}

const CHARGE_NAMES = {
  AC: 'Animal Container',
  AS: 'Assembly Service Fee',
  AT: 'Attendant',
  AW: 'Air Waybill Fee',
  BA: 'Brokerage',
  BL: 'Blacklist Certificate',
  BR: 'Bank Release',
  CA: 'Cartage (Origin)',
  CB: 'Cartage (Destination)',
  CC: 'Collect Charge Fee',
  CD: 'Clearance and Handling (Dest)',
  CG: 'Electronic Data Charge (e-AWB)',
  CH: 'Clearance and Handling (Origin)',
  DB: 'Disbursement Fee',
  EA: 'Export Customs',
  FC: 'Charges Collect Fee',
  FD: 'Freight Forwarder Facility Fee',
  FE: 'First Flight Out',
  GT: 'Government Tax',
  HR: 'Human Remains Handling',
  IN: 'Insurance Premium',
  LA: 'Live Animals Handling',
  MA: 'Misc. Charge (Due Agent)',
  MB: 'Misc. Charge (Due Dest)',
  MC: 'Misc. Charge (Due Carrier)',
  MY: 'Fuel Surcharge (FSC)',
  PK: 'Packaging Charge',
  PU: 'Pick-up Fee',
  RA: 'Dangerous Goods Fee',
  RC: 'Routing Charge',
  SC: 'Security Surcharge (SSC)',
  SD: 'Surface Transportation (Dest)',
  SI: 'Stop in Transit',
  SO: 'Storage Charge (Origin)',
  SR: 'Storage Charge (Dest)',
  SU: 'Surface Transportation (Origin)',
  TX: 'Tax',
  UD: 'Unitized Consignment',
  XB: 'Security Screening',
  XD: 'X-Ray Charge',
};

export const getChargeName = (code) => CHARGE_NAMES[code] || 'Other Charge';

// id and timestamps are left out (a downloaded file uploaded again failed on duplicate ids), and so are nested rows
// (the GCR rate details)
const CSV_SKIPPED_FIELDS = ['id', 'createdAt', 'updatedAt'];

const csvValue = (value) => {
  const text = String(value ?? '').replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
};

export function toCsv(rows) {
  const [firstRow] = rows;
  const headers = Object.keys(firstRow).filter((key) => !CSV_SKIPPED_FIELDS.includes(key) && (firstRow[key] === null || typeof firstRow[key] !== 'object'));
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(','))].join('\n');
}
