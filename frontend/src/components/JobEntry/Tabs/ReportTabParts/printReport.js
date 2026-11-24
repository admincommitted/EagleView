// Prints one report element in a hidden iframe (28-Oct-2026).
// The old Print Checklist used window.print() with "@media print { .no-print { display:none } }", but the checklist
// sits INSIDE a .no-print panel, so the printed page came out blank. Printing a copy of the report alone in its own
// frame avoids that and also drops the page's menus, scroll boxes and height limits (which cut the print to one page).
// 12-Nov-2026: css (extra rules of the report) and pageHeader { left, right } - printed in the page margin of every
// page with "Page x of y" (Chrome page-margin boxes; older browsers just leave them out)
export function printReport(el, { title = 'Report', landscape = false, watermark = '', css = '', pageHeader = null } = {}) {
  if (!el) return false;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Helvetica, Arial, sans-serif; }
  .no-print { display: none !important; }
  table { border-collapse: collapse; }
  tr, img { break-inside: avoid; }
  thead { display: table-header-group; }
  .rp-watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 110px; font-weight: 800; color: rgba(0,0,0,0.06); transform: rotate(-30deg); z-index: 0; pointer-events: none; }
${pageHeader ? `  @page { margin-top: 12mm;
    @top-left { content: "${String(pageHeader.left || '').replace(/["\\]/g, '')}"; font: 8px Helvetica, Arial, sans-serif; }
    @top-right { content: "${String(pageHeader.right || '').replace(/["\\]/g, '')}${pageHeader.right ? '   ' : ''}Page " counter(page) " of " counter(pages); font: bold 8px Helvetica, Arial, sans-serif; } }
` : ''}${css || ''}
</style></head><body>${watermark ? `<div class="rp-watermark">${esc(watermark)}</div>` : ''}${el.innerHTML}</body></html>`);
  doc.close();
  const go = () => {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); } finally { setTimeout(() => frame.remove(), 1500); }
  };
  // let fonts / images load first
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => setTimeout(go, 100)); else setTimeout(go, 300);
  return true;
}
