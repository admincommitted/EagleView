import { ensureInvoiceTables, selectRows } from './shared/invoiceDb.js';

export { KINDS } from './shared/invoiceKinds.js';

const TABLES_DELAY_MS = 4000;
const PDF_FOOTER_META = /<meta name="pdf-footer" content="([^"]*)">/;
// Playwright's own Chromium is often not downloaded on the office PCs; then the browser already on Windows is used
const BROWSER_LAUNCH_OPTIONS = [
  { headless: true },
  { headless: true, channel: 'msedge' },
  { headless: true, channel: 'chrome' },
];
const MAX_LAUNCH_ERROR_LENGTH = 160;

let pdfBrowser = null;

async function launchPdfBrowser() {
  // loaded on first use: Playwright is heavy and only the PDF needs it
  const { chromium } = await import('playwright');
  const errors = [];
  for (const options of BROWSER_LAUNCH_OPTIONS) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      errors.push(
        (options.channel || 'playwright chromium') +
          ': ' +
          String(error.message || error)
            .split('\n')[0]
            .slice(0, MAX_LAUNCH_ERROR_LENGTH),
      );
    }
  }
  throw new Error(
    'No browser could be started to make the PDF (' +
      errors.join(' | ') +
      '). Install Microsoft Edge or Google Chrome, or run "npx playwright install chromium" in node-backend.',
  );
}

async function browserForPdf() {
  if (!pdfBrowser) {
    pdfBrowser = await launchPdfBrowser();
    pdfBrowser.on('disconnected', () => {
      pdfBrowser = null;
    });
  }
  return pdfBrowser;
}

// a bulk invoice asks for "Bill No / Bill Date / Page x / y" at the foot of every page
const footerTemplate = (text) =>
  '<div style="font-size:8px;font-family:Verdana,Arial;width:100%;padding:0 8mm;display:flex;' +
  'justify-content:space-between;font-weight:700"><span>' +
  text +
  '</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>';

/** An A4 PDF of the invoice print HTML (the same HTML as Print). Sales quotations use it too. */
export async function htmlToPdf(html) {
  const browser = await browserForPdf();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    const options = { format: 'A4', printBackground: true, preferCSSPageSize: true };
    const footer = PDF_FOOTER_META.exec(html);
    if (footer) {
      await page.addStyleTag({ content: '.pf { display: none !important }' });
      Object.assign(options, {
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate(footer[1]),
      });
    }
    return await page.pdf(options);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Voucher ids that belong to a GST invoice: the voucher screens send these to GST Invoice instead of editing them. */
export async function invoiceVoucherIds() {
  try {
    await ensureInvoiceTables();
    const rows = await selectRows('SELECT voucherId FROM AccSalesInvoices WHERE voucherId IS NOT NULL');
    return new Set(rows.map((row) => Number(row.voucherId)));
  } catch {
    return new Set();
  }
}

/** Makes the GST invoice tables a few seconds after the backend starts (not only when the screen is first used). */
export function initGstInvoiceTables() {
  setTimeout(async () => {
    try {
      await ensureInvoiceTables();
      console.log('[gst-invoice] tables ready: AccSalesInvoices, AccProvisionalSheets, AccSalesInvoiceDeleted');
    } catch (error) {
      console.error('[gst-invoice] tables not made:', error.message);
    }
  }, TABLES_DELAY_MS);
}
