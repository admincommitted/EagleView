// Saves the report shown as a PDF file: html2pdf makes a picture of the report and cuts it into A4 pages.
// - A picture has a size limit, so a long report is drawn in parts, each part starting on a new page. A report that
//   cannot be cut into parts (one block taller than the limit) or is far too long returns 'long': the caller opens
//   Print, where "Save as PDF" gives the file.
// - html2pdf lays the report out at the A4 page width, so the screen letter sizes read big on paper: the PDF is made
//   from a copy with every letter size and the up / down spacing brought down to SHRINK.
import { COLOR_PROPERTIES, withRgbColors } from './reportCss';

const MAX_PX = 30000;   // canvas height that browsers draw safely
const PART_PX = 9000;   // height of one part of a long report
const MAX_PARTS = 60;   // beyond this the file gets too big and too slow
const SHRINK = 0.82;
const SHRUNK_PROPERTIES = ['font-size', 'padding-top', 'padding-bottom', 'margin-top', 'margin-bottom'];
const MARGINS = ['margin-top', 'margin-bottom'];

const setImportant = (node, name, value) => node.style.setProperty(name, value, 'important');

// A copy of the report, off the screen, with the sizes brought down and every colour as rgb() (html2canvas cannot
// read the oklch / color() colours of Tailwind). Returns { copy, sheet, remove }.
export function shrunkCopy(el, landscape = false) {
  const sheet = document.createElement('div');
  Object.assign(sheet.style, { position: 'fixed', left: '-20000px', top: '0', width: (landscape ? 1090 : 748) + 'px', background: '#ffffff', color: '#000000' });
  const copy = el.cloneNode(true);
  sheet.appendChild(copy);
  document.body.appendChild(sheet);
  // read every value first (a size set on a parent would change what its children report), then write
  const nodes = [copy, ...copy.querySelectorAll('*')];
  const readings = nodes.map((node) => {
    const style = getComputedStyle(node);
    return {
      sizes: SHRUNK_PROPERTIES.map((name) => parseFloat(style.getPropertyValue(name)) || 0),
      colors: COLOR_PROPERTIES.map((name) => style.getPropertyValue(name)),
    };
  });
  nodes.forEach((node, index) => {
    const { sizes, colors } = readings[index];
    SHRUNK_PROPERTIES.forEach((name, position) => {
      const size = sizes[position];
      const isMargin = MARGINS.includes(name);
      if (isMargin ? size > 0 : size) setImportant(node, name, (size * SHRINK).toFixed(2) + 'px');
    });
    COLOR_PROPERTIES.forEach((name, position) => {
      const rgbValue = withRgbColors(colors[position]);
      if (rgbValue !== colors[position]) setImportant(node, name, rgbValue);
    });
  });
  copy.querySelectorAll('.no-print').forEach((node) => node.remove());
  return { copy, sheet, remove: () => sheet.remove() };
}

// a TABLE element, or the ui Table (a div data-slot="table-container" around the TABLE)
const tableIn = (block) => {
  if (block.tagName === 'TABLE') return block;
  const inner = block.firstElementChild;
  return block.matches('[data-slot="table-container"]') && inner?.tagName === 'TABLE' ? inner : null;
};

// a table taller than one part is cut into several tables (same columns and heading), a few of its row groups each
function splitTallTable(block) {
  const table = tableIn(block);
  if (!table || (block.offsetHeight || 0) <= PART_PX) return;
  const repeatedParts = [...table.children].filter((child) => child.tagName === 'COLGROUP' || child.tagName === 'THEAD');
  let rows = [...table.children].filter((child) => !repeatedParts.includes(child));
  const singleBody = rows.length === 1 && rows[0].tagName === 'TBODY' ? rows[0] : null;
  if (singleBody) rows = [...singleBody.children];
  if (rows.length < 2) return;
  const rowHeights = rows.map((row) => row.offsetHeight || 0);
  let pieceTable = null;
  let pieceHeight = 0;
  const startPiece = () => {
    pieceTable = table.cloneNode(false);
    repeatedParts.forEach((part) => pieceTable.appendChild(part.cloneNode(true)));
    const piece = block === table ? pieceTable : block.cloneNode(false);
    if (piece !== pieceTable) piece.appendChild(pieceTable);
    block.parentElement.insertBefore(piece, block);
    pieceHeight = 0;
  };
  rows.forEach((row, index) => {
    if (!pieceTable || (pieceHeight && pieceHeight + rowHeights[index] > PART_PX)) startPiece();
    if (row.tagName === 'TR') {
      let body = pieceTable.lastElementChild;
      if (!body || body.tagName !== 'TBODY') {
        body = singleBody ? singleBody.cloneNode(false) : document.createElement('tbody');
        pieceTable.appendChild(body);
      }
      body.appendChild(row);
    } else {
      pieceTable.appendChild(row);
    }
    pieceHeight += rowHeights[index];
  });
  block.remove();
}

// Cuts a long copy into parts: goes down while there is a single child, then groups the children by height.
// Returns the part elements (each holds some of the children), or null when it cannot be cut.
function cutIntoParts(copy, sheet) {
  let box = copy;
  while (box.children.length === 1 && box.firstElementChild.scrollHeight > MAX_PX) box = box.firstElementChild;
  if (box.children.length < 2) return null;
  [...box.children].forEach(splitTallTable);
  const blocks = [...box.children];
  const heights = blocks.map((block) => block.offsetHeight || block.scrollHeight || 0);
  if (heights.some((height) => height > MAX_PX)) return null;
  const groups = [];
  let group = [];
  let groupHeight = 0;
  blocks.forEach((block, index) => {
    if (group.length && groupHeight + heights[index] > PART_PX) { groups.push(group); group = []; groupHeight = 0; }
    group.push(block);
    groupHeight += heights[index];
  });
  if (group.length) groups.push(group);
  if (groups.length > MAX_PARTS) return null;
  // each part keeps the chain of parents (their classes / styles) from the copy down to the box
  const chain = [];
  for (let node = box; node && node !== copy.parentElement; node = node.parentElement) chain.unshift(node);
  return groups.map((members) => {
    let top = null;
    let innermost = null;
    chain.forEach((node) => {
      const shell = node.cloneNode(false);
      if (innermost) innermost.appendChild(shell);
      else top = shell;
      innermost = shell;
    });
    members.forEach((block) => innermost.appendChild(block));
    sheet.appendChild(top);
    return top;
  });
}

function stampPages(pdf, watermark) {
  const pageCount = pdf.internal.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    if (watermark && pdf.GState && pdf.setGState) {
      try {
        pdf.saveGraphicsState();
        pdf.setGState(new pdf.GState({ opacity: 0.07 }));
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(120);
        pdf.setTextColor(0, 0, 0);
        pdf.text(String(watermark), pageWidth / 2, pageHeight / 2 + 20, { align: 'center', angle: 30 });
        pdf.restoreGraphicsState();
      } catch {
        // this page goes without the watermark
      }
    }
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`PRINTED ON: ${new Date().toLocaleDateString('en-GB')}`, 6, 8);
    pdf.text(`PAGE ${page} OF ${pageCount}`, pageWidth - 6, 8, { align: 'right' });
  }
}

export async function downloadReportPdf(el, { fileName = 'Report', landscape = false, watermark = '' } = {}) {
  if (!el) return 'none';
  const { copy, sheet, remove } = shrunkCopy(el, landscape);
  try {
    const height = copy.scrollHeight || copy.offsetHeight || 0;
    let scale = 2;
    let parts = [copy];
    if (height * scale > MAX_PX) {
      scale = 1.5;
      if (height * scale > MAX_PX) {
        parts = cutIntoParts(copy, sheet);
        if (!parts) return 'long';
        copy.remove();
      }
    }
    const html2pdf = (await import('html2pdf.js')).default;
    const options = {
      margin: [14, 6, 10, 6], // top, left, bottom, right (mm)
      filename: `${fileName}.pdf`,
      image: { type: 'jpeg', quality: parts.length > 1 ? 0.9 : 0.98 },
      html2canvas: { scale, scrollY: 0, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' },
      pagebreak: { avoid: ['tr', '.section-avoid-break'] },
    };
    let worker = html2pdf().set(options).from(parts[0]).toPdf();
    for (const part of parts.slice(1)) {
      const pdf = await worker.get('pdf');
      pdf.addPage();
      worker = worker.from(part).toContainer().toCanvas().toPdf();
    }
    const pdf = await worker.get('pdf');
    stampPages(pdf, watermark);
    await worker.save();
    return 'ok';
  } finally {
    remove();
  }
}
