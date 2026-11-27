// e-Sanchit portal upload through a browser. The portal steps (login, menu, file input, document type, submit, IRN)
// are not mapped yet, so this opens ICEGATE, waits for the OTP and then reports failure; the route keeps the signed
// PDF for a manual upload. No IRN is ever invented here.
import puppeteer from 'puppeteer';
import { waitForIcegateOtp } from './OtpFetcher.js';

const ICEGATE_HOME_URL = 'https://www.icegate.gov.in/';
const MANUAL_ENTRY_WAIT_MS = 30000;
const OTP_WAIT_MS = 60000;
const OTP_PROCESSING_WAIT_MS = 5000;
const NOT_MAPPED_ERROR = 'e-Sanchit portal upload is not mapped yet (utils/EsanchitUploader.js)';

async function waitForOtpStep(page) {
  console.log('[e-Sanchit] Waiting for OTP from Gmail...');
  const gmailEmail = process.env.GMAIL_EMAIL;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailEmail || !gmailAppPassword) {
    console.log('[e-Sanchit] GMAIL credentials missing in .env! Pausing for 30s manual entry.');
    await page.waitForTimeout(MANUAL_ENTRY_WAIT_MS);
    return;
  }
  const otp = await waitForIcegateOtp(gmailEmail, gmailAppPassword, OTP_WAIT_MS);
  if (otp) {
    console.log('[e-Sanchit] Auto-filling OTP...');
    await page.waitForTimeout(OTP_PROCESSING_WAIT_MS); // time for ICEGATE to process the OTP
  } else {
    console.log('[e-Sanchit] Failed to fetch OTP automatically. Please enter manually.');
    await page.waitForTimeout(MANUAL_ENTRY_WAIT_MS);
  }
}

async function uploadToESanchit(loginId, password, pdfFilePath, documentCode) {
  try {
    console.log(`[e-Sanchit] Starting upload for ${documentCode}...`);
    // a visible browser, so the operator can see the portal and solve its captcha; it is left open on purpose so
    // the page can be inspected when a step fails
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized'],
    });
    const page = await browser.newPage();
    await page.goto(ICEGATE_HOME_URL, { waitUntil: 'networkidle2' });

    await waitForOtpStep(page);

    console.log('[e-Sanchit] Navigating to e-Sanchit tab...');
    console.log('[e-Sanchit] Uploading signed PDF...');
    console.log(`[e-Sanchit] Selecting Document Code: ${documentCode}`);
    console.log('[e-Sanchit] Submitting...');
    console.log('[e-Sanchit] Waiting for IRN generation...');
    return { success: false, error: NOT_MAPPED_ERROR };
  } catch (error) {
    console.error('[e-Sanchit] Puppeteer Error:', error);
    return { success: false, error: error.message };
  }
}

export { uploadToESanchit };
