import html2pdf from 'html2pdf.js';
import { rgbColorsForHtml2canvas, withRgbColors } from '@/lib/cssColors';
import { downloadBlob } from '@/lib/download';

export const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The print window, the Word file and the PDF do not get the app's Tailwind classes, so the sheet's look is written
// into the copy as inline styles. Widths become percentages of the parent, so the copy can be given another width.
const COPIED_STYLES = [
  'display', 'min-width', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-collapse',
  'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-align', 'text-transform', 'text-decoration-line', 'white-space', 'vertical-align',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'justify-content', 'align-items', 'align-self',
  'row-gap', 'column-gap', 'break-inside',
];
const FIXED_HEIGHT_CLASS = /(^|\s)tw:(min-)?h-/;

const contentWidth = (element) => {
  const style = getComputedStyle(element);
  return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
};

function relativeWidth(element, style) {
  if (!(element instanceof HTMLElement) || style.display.startsWith('inline') || style.display.startsWith('table-row')) return null;
  const reference = style.display === 'table-cell' ? element.closest('table')?.offsetWidth : contentWidth(element.parentElement);
  return reference > 0 ? `${((element.offsetWidth / reference) * 100).toFixed(3)}%` : null;
}

const pxTracksToFractions = (tracks) => tracks.replace(/([\d.]+)px/g, '$1fr');

function readStyles(element, isRoot) {
  const isInsideSvg = element instanceof SVGElement && element.tagName.toLowerCase() !== 'svg';
  if (isInsideSvg) return null;
  const style = getComputedStyle(element);
  const values = Object.fromEntries(COPIED_STYLES.map((name) => [name, withRgbColors(style.getPropertyValue(name))]));
  const width = isRoot ? style.width : relativeWidth(element, style);
  if (width) Object.assign(values, { width, 'box-sizing': 'border-box' });
  if (FIXED_HEIGHT_CLASS.test(element.getAttribute('class') || '')) Object.assign(values, { height: style.height, 'min-height': style.minHeight });
  if (style.display.includes('grid')) values['grid-template-columns'] = pxTracksToFractions(style.gridTemplateColumns);
  if (style.breakInside === 'avoid') values['page-break-inside'] = 'avoid';
  return values;
}

function inlineStyles(sourceRoot, cloneRoot) {
  const sources = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
  const clones = [cloneRoot, ...cloneRoot.querySelectorAll('*')];
  const readings = sources.map((element, index) => readStyles(element, index === 0));
  clones.forEach((clone, index) => {
    const values = readings[index];
    if (!values) return;
    const plainClasses = (clone.getAttribute('class') || '').split(/\s+/).filter((name) => name && !name.startsWith('tw:'));
    clone.setAttribute('class', plainClasses.join(' '));
    Object.entries(values).forEach(([name, value]) => clone.style.setProperty(name, value));
  });
}

const FIELDS = 'input, textarea, select';

// a typed box becomes plain text, as the AWB document windows print it
export function fieldAsText(field) {
  const text = document.createElement('span');
  if (field.type === 'checkbox' || field.type === 'radio') {
    text.textContent = field.checked ? '[X]' : '[  ]';
    text.style.fontFamily = 'monospace';
    return text;
  }
  const value = field.tagName === 'SELECT' ? field.options[field.selectedIndex]?.text || '' : field.value;
  const isTextarea = field.tagName === 'TEXTAREA';
  text.innerHTML = escapeHtml(value).replace(/\n/g, '<br/>') || '&nbsp;';
  text.style.cssText = `display:${isTextarea ? 'block' : 'inline-block'};min-width:${isTextarea ? '100%' : '20px'};font-size:11px;white-space:pre-wrap;`;
  if (!isTextarea) text.style.borderBottom = '1px solid #000';
  return text;
}

/** A copy of the sheet with its look inlined and every typed box written in as text (boxes do not print / export). */
export function sheetClone(root, { width, padding, renderField = fieldAsText } = {}) {
  const copy = root.cloneNode(true);
  inlineStyles(root, copy);
  const originals = root.querySelectorAll(FIELDS);
  copy.querySelectorAll(FIELDS).forEach((field, index) => field.replaceWith(renderField(originals[index])));
  if (width) copy.style.width = `${width}px`;
  if (padding) copy.style.padding = padding;
  return copy;
}

export const safeFileName = (name) => String(name || 'Document').replace(/[^A-Za-z0-9_-]+/g, '_');

export function printSheet(sheet, { title, landscape, css = '' }) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const printDocument = frame.contentWindow.document;
  printDocument.open();
  printDocument.write(`<html><head><title>${escapeHtml(title)}</title><style>@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:8mm} body{margin:0;font-family:Arial,sans-serif;color:#000} ${css}</style></head><body>${sheet.outerHTML}</body></html>`);
  printDocument.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1500);
  }, 300);
}

export function saveSheetPdf(sheet, { fileName, landscape, windowWidth, avoid }) {
  html2pdf().set({
    margin: [0.25, 0.25, 0.25, 0.25],
    filename: `${fileName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, ...(windowWidth && { windowWidth }), ...rgbColorsForHtml2canvas },
    jsPDF: { unit: 'in', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid },
  }).from(sheet).save();
}

export function saveSheetWord(sheet, { fileName, title, landscape, margin = '0.5in' }) {
  const pageSize = landscape ? '841.9pt 595.3pt; mso-page-orientation: landscape' : '595.3pt 841.9pt';
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${escapeHtml(title)}</title><style>@page WordSection1 { size: ${pageSize}; margin: ${margin}; } div.WordSection1 { page: WordSection1; } table { border-collapse: collapse; }</style></head><body><div class="WordSection1">${sheet.outerHTML}</div></body></html>`;
  downloadBlob(new Blob([html], { type: 'application/msword' }), `${fileName}.doc`);
}
