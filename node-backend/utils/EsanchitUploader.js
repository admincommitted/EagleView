const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function uploadToESanchit(loginId, password, pdfFilePath, documentCode) {
    let browser;
    try {
        console.log(`[e-Sanchit] Starting upload for ${documentCode}...`);
        
        // Launch Puppeteer (headless: false initially so you can see what's happening and solve Captcha)
        browser = await puppeteer.launch({
            headless: false, // Set to true later when captcha solver is integrated
            defaultViewport: null,
            args: ['--start-maximized']
        });

        const page = await browser.newPage();
        
        // 1. Go to ICEGATE Login
        await page.goto('https://www.icegate.gov.in/', { waitUntil: 'networkidle2' });
        
        // Note: ICEGATE portal UI changes. These are standard selectors. 
        // You may need to inspect the live ICEGATE page and update these.
        
        // Click on Login / Fill Credentials
        // await page.type('#username', loginId);
        // await page.type('#password', password);
        // await page.click('#submitLogin'); // This triggers OTP

        console.log("[e-Sanchit] Waiting for OTP from Gmail...");
        const { waitForIcegateOtp } = require('./OtpFetcher');
        const gmailEmail = process.env.GMAIL_EMAIL;
        const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
        
        if (!gmailEmail || !gmailAppPassword) {
             console.log("[e-Sanchit] GMAIL credentials missing in .env! Pausing for 30s manual entry.");
             await page.waitForTimeout(30000); 
        } else {
             const otp = await waitForIcegateOtp(gmailEmail, gmailAppPassword, 60000);
             if (otp) {
                 console.log("[e-Sanchit] Auto-filling OTP...");
                 // await page.type('#otpInput', otp);
                 // await page.click('#verifyOtpBtn');
                 await page.waitForTimeout(5000); // Wait for ICEGATE to process OTP
             } else {
                 console.log("[e-Sanchit] Failed to fetch OTP automatically. Please enter manually.");
                 await page.waitForTimeout(30000);
             }
        }

        // 2. Navigate to e-Sanchit

        console.log("[e-Sanchit] Navigating to e-Sanchit tab...");
        // Example: Click on 'e-Sanchit' menu link
        // await page.click('a[href*="eSanchit"]'); 
        // await page.waitForNavigation();

        // 3. Upload File
        console.log("[e-Sanchit] Uploading signed PDF...");
        // Find the file input and upload
        // const fileInputSelector = 'input[type="file"]';
        // const fileInput = await page.$(fileInputSelector);
        // await fileInput.uploadFile(pdfFilePath);

        // 4. Select Document Type
        console.log(`[e-Sanchit] Selecting Document Code: ${documentCode}`);
        // const dropdownSelector = 'select#documentType';
        // await page.select(dropdownSelector, documentCode);

        // 5. Click Submit
        console.log("[e-Sanchit] Submitting...");
        // await page.click('button#submitUpload');

        // 6. Wait for IRN to generate
        console.log("[e-Sanchit] Waiting for IRN generation...");
        // await page.waitForSelector('.irn-success-message', { timeout: 60000 });
        // const irnText = await page.$eval('.irn-success-message', el => el.innerText);
        
        // Extract IRN from text
        // const irnMatch = irnText.match(/IRN:\s*([A-Z0-9]+)/i);
        // const generatedIrn = irnMatch ? irnMatch[1] : "MOCK_IRN_123456789";

        // 29-Oct-2026: no invented IRN any more - the portal steps above are still commented out, so this reports failure
        // until the real e-Sanchit page flow is mapped (the route keeps the signed PDF for a manual upload)
        return { success: false, error: 'e-Sanchit portal upload is not mapped yet (utils/EsanchitUploader.js)' };

    } catch (error) {
        console.error("[e-Sanchit] Puppeteer Error:", error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (browser) {
            // await browser.close(); // Commented out so you can inspect the page if it fails
        }
    }
}

module.exports = { uploadToESanchit };
