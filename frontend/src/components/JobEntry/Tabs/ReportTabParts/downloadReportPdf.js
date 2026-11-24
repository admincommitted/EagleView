// Saves the report shown on the Reports tab as a PDF file (21-Nov-2026), the same way the export "PDF file" button
// does: html2pdf makes a picture of the report and cuts it into A4 pages.
// - A picture has a size limit, so a long report (a checklist with hundreds of items) is drawn in parts, one after
//   the other, each part starting on a new page. A report that cannot be cut into parts (one block taller than the
//   limit) or is far too long returns 'long': the caller opens Print, where "Save as PDF" gives the file.
// - html2pdf lays the report out at the A4 page width, so the letters came out at their full screen size, which reads
//   big on paper. The PDF is made from a copy of the report with every letter size and the up / down spacing of the
//   rows brought down to SHRINK; the report on the screen is not touched.
const MAX_PX = 30000;   // canvas height that browsers draw safely
const PART_PX = 9000;   // height of one part of a long report
const MAX_PARTS = 60;   // beyond this the file gets too big and too slow
const SHRINK = 0.82;

// A copy of the report, off the screen, with the sizes brought down. Returns { copy, remove }.
export function shrunkCopy(el, landscape = false) {
  const sheet = document.createElement('div');
  Object.assign(sheet.style, { position: 'fixed', left: '-20000px', top: '0', width: (landscape ? 1090 : 748) + 'px', background: '#ffffff', color: '#000000' });
  const copy = el.cloneNode(true);
  sheet.appendChild(copy);
  document.body.appendChild(sheet);
  // read every size first (a size set on a parent would change what its children report), then write
  const all = [copy, ...copy.querySelectorAll('*')];
  const sizes = all.map((n) => { const cs = getComputedStyle(n); return [parseFloat(cs.fontSize) || 0, parseFloat(cs.paddingTop) || 0, parseFloat(cs.paddingBottom) || 0, parseFloat(cs.marginTop) || 0, parseFloat(cs.marginBottom) || 0]; });
  all.forEach((n, i) => {
    const [f, pt, pb, mt, mb] = sizes[i];
    if (f) n.style.setProperty('font-size', (f * SHRINK).toFixed(2) + 'px', 'important');
    if (pt) n.style.setProperty('padding-top', (pt * SHRINK).toFixed(2) + 'px', 'important');
    if (pb) n.style.setProperty('padding-bottom', (pb * SHRINK).toFixed(2) + 'px', 'important');
    if (mt > 0) n.style.setProperty('margin-top', (mt * SHRINK).toFixed(2) + 'px', 'important');
    if (mb > 0) n.style.setProperty('margin-bottom', (mb * SHRINK).toFixed(2) + 'px', 'important');
  });
  copy.querySelectorAll('.no-print').forEach((n) => n.remove());
  return { copy, sheet, remove: () => sheet.remove() };
}

// Cuts a long copy into parts: goes down while there is a single child, then groups the children by height.
// Returns the list of part elements (each a <div> holding some of the children), or null when it cannot be cut.
function cutIntoParts(copy, sheet) {
  let box = copy;
  while (box.children.length === 1 && box.firstElementChild.scrollHeight > MAX_PX) box = box.firstElementChild;
  if (box.children.length < 2) return null;
  // a table taller than one part is cut into several tables (same columns and heading), a few of its row groups each
  [...box.children].forEach((t) => {
    if (t.tagName !== 'TABLE' || (t.offsetHeight || 0) <= PART_PX) return;
    const fixed = [...t.children].filter((c) => c.tagName === 'COLGROUP' || c.tagName === 'THEAD');
    let rows = [...t.children].filter((c) => !fixed.includes(c));
    if (rows.length === 1 && rows[0].tagName === 'TBODY') rows = [...rows[0].children]; // one body: cut by its rows
    if (rows.length < 2) return;
    const hs = rows.map((r) => r.offsetHeight || 0);
    let piece = null, sum = 0;
    const startPiece = () => { piece = t.cloneNode(false); fixed.forEach((c) => piece.appendChild(c.cloneNode(true))); t.parentElement.insertBefore(piece, t); sum = 0; };
    rows.forEach((r, i) => {
      if (!piece || (sum && sum + hs[i] > PART_PX)) startPiece();
      if (r.tagName === 'TR') { let tb = piece.lastElementChild; if (!tb || tb.tagName !== 'TBODY') { tb = document.createElement('tbody'); piece.appendChild(tb); } tb.appendChild(r); }
      else piece.appendChild(r);
      sum += hs[i];
    });
    t.remove();
  });
  const kids = [...box.children];
  const heights = kids.map((k) => k.offsetHeight || k.scrollHeight || 0);
  if (heights.some((h) => h > MAX_PX)) return null;
  const groups = []; let cur = [], sum = 0;
  kids.forEach((k, i) => { if (cur.length && sum + heights[i] > PART_PX) { groups.push(cur); cur = []; sum = 0; } cur.push(k); sum += heights[i]; });
  if (cur.length) groups.push(cur);
  if (groups.length > MAX_PARTS) return null;
  // each part keeps the chain of parents (their classes / styles) from the copy down to the box
  const chain = []; for (let n = box; n && n !== copy.parentElement; n = n.parentElement) chain.unshift(n);
  return groups.map((g) => {
    let top = null, at = null;
    chain.forEach((n) => { const c = n.cloneNode(false); if (at) at.appendChild(c); else top = c; at = c; });
    g.forEach((k) => at.appendChild(k));
    sheet.appendChild(top);
    return top;
  });
}

export async function downloadReportPdf(el, { fileName = 'Report', landscape = false, watermark = '' } = {}) {
  if (!el) return 'none';
  const { copy, sheet, remove } = shrunkCopy(el, landscape);
  try {
    const h = copy.scrollHeight || copy.offsetHeight || 0;
    let scale = 2;
    let parts = [copy];
    if (h * scale > MAX_PX) {
      scale = 1.5;
      if (h * scale > MAX_PX) { parts = cutIntoParts(copy, sheet); if (!parts) return 'long'; copy.remove(); }
    }
    const html2pdf = (await import('html2pdf.js')).default;
    const opt = {
      margin: [14, 6, 10, 6], // top, left, bottom, right (mm)
      filename: `${fileName}.pdf`,
      image: { type: 'jpeg', quality: parts.length > 1 ? 0.9 : 0.98 },
      html2canvas: { scale, scrollY: 0, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' },
      pagebreak: { avoid: ['tr', '.section-avoid-break'] },
    };
    let worker = html2pdf().set(opt).from(parts[0]).toPdf();
    for (const part of parts.slice(1)) worker = worker.get('pdf').then((pdf) => { pdf.addPage(); }).from(part).toContainer().toCanvas().toPdf();
    await worker.get('pdf').then((pdf) => {
      const n = pdf.internal.getNumberOfPages();
      const w = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      for (let i = 1; i <= n; i++) {
        pdf.setPage(i);
        if (watermark && pdf.GState && pdf.setGState) {
          try {
            pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({ opacity: 0.07 }));
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(120); pdf.setTextColor(0, 0, 0);
            pdf.text(String(watermark), w / 2, ph / 2 + 20, { align: 'center', angle: 30 });
            pdf.restoreGraphicsState();
          } catch (e) { /* no watermark on this page */ }
        }
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0);
        pdf.text(`PRINTED ON: ${new Date().toLocaleDateString('en-GB')}`, 6, 8);
        pdf.text(`PAGE ${i} OF ${n}`, w - 6, 8, { align: 'right' });
      }
    }).save();
    return 'ok';
  } finally { remove(); }
}
