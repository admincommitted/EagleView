import { tailwindStylesheet } from './reportCss';

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const marginText = (text) => String(text || '').replace(/["\\]/g, '');
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// printed in the page margin of every page, with "Page x of y" (Chrome page-margin boxes; other browsers leave it out)
const pageHeaderCss = (pageHeader) => `  @page { margin-top: 12mm;
    @top-left { content: "${marginText(pageHeader.left)}"; font: 8px Helvetica, Arial, sans-serif; }
    @top-right { content: "${marginText(pageHeader.right)}${pageHeader.right ? '   ' : ''}Page " counter(page) " of " counter(pages); font: bold 8px Helvetica, Arial, sans-serif; } }
`;

const frameCss = ({ landscape, css, pageHeader }) => `
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Helvetica, Arial, sans-serif; }
  .no-print { display: none !important; }
  table { border-collapse: collapse; }
  tr, img { break-inside: avoid; }
  thead { display: table-header-group; }
  .rp-watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 110px; font-weight: 800; color: rgba(0,0,0,0.06); transform: rotate(-30deg); z-index: 0; pointer-events: none; }
${pageHeader ? pageHeaderCss(pageHeader) : ''}${css || ''}`;

// Prints a copy of one report element in a hidden frame: the report on the screen sits inside a .no-print panel and
// in scroll boxes, so window.print() of the page gave a blank or cut sheet.
export function printReport(el, { title = 'Report', landscape = false, watermark = '', css = '', pageHeader = null } = {}) {
  if (!el) return false;
  const content = el.cloneNode(true);
  content.querySelectorAll('.no-print').forEach((node) => node.remove());

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${tailwindStylesheet()}</style>
<style>${frameCss({ landscape, css, pageHeader })}</style></head><body>${watermark ? `<div class="rp-watermark">${escapeHtml(watermark)}</div>` : ''}${content.innerHTML}</body></html>`);
  doc.close();

  const printWhenLoaded = async () => {
    if (doc.fonts?.ready) {
      await doc.fonts.ready;
      await wait(100);
    } else {
      await wait(300);
    }
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } finally {
      setTimeout(() => frame.remove(), 1500);
    }
  };
  printWhenLoaded();
  return true;
}
