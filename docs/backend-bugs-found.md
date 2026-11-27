# Bugs found during the backend refactor (behaviour kept; fix list for later)

Fixed on 2026-11-26: daybook without a date range (now today, max 31 days), PUT /api/auth/profile (only own editable fields), import-file temp path (random name, always deleted), KYC e-mail HTML escaped, notifications fallback refuses logged-out tokens, WhatsApp / e-mail / status-mail previews can no longer run script.

## Security
- routes/auth.js:228,230 PUT /api/auth/profile — body can set userId/id: overwrite another user's profile; password passed into UserProfile.
- routes/import-file.js:126-147 — temp path from uploaded original filename (path traversal); temp file not deleted on error.
- routes/notifications.js:19 — fallback token check ignores revoked tokens.
- middleware/auth.js:59 — revoked/user-status lookup error lets the request through.

- routes/masters.js:1586-1608 — KYC approval e-mail HTML not escaped (party name, doc type, file name).
- routes/masters.js:1693 — multi-byte sig makes timingSafeEqual throw → 500 instead of 403.
- routes/portMaster.js — POST/PUT pass req.body unfiltered to Sequelize; PUT on missing port answers 200 null.

## Crash / memory
- routes/masters.js:1232 — GET /parties ignores type/q, returns every party with includes, uncached (heavy).
- routes/masters.js:291 — /parties/search with array type → 500.
- routes/masters.js:1294-1308 — POST /seed fails half-way (wrong Currency/Party column names).
- routes/icegate-profile.js:29-31 — POST clears current default before checking required fields.
- routes/dutyLists.js:44, masters.js:53 — plain-object lookups ('constructor' resolves).
- routes/vouchers.js /daybook without date range loads every voucher → out of memory (crashes even at 12 GB heap).
- routes/importDashboard.js:109 — bad oocAt date throws → whole dashboard 500.
- routes/bulkZip.js:49 — archive.finalize() promise unhandled.
- services/EmailListener.js:38 — attachment without filename throws; mail never marked Seen.
- services/EmailListener.js:121,222 — restart leaves duplicate IMAP listeners.

## Wrong results
- routes/sales.js:94,217 — 'unique' message check never matches ("Validation error"); duplicate number answer never sent.
- routes/sales.js POST/PUT /quotes — no transaction: orphan charge lines / half-saved quote.
- routes/poRoutes.js:224-232 — "Last Purchase" always shows the PO itself, never "First Time Buy".
- routes/poRoutes.js:666 — resend WhatsApp approval links have no exp/sig → 403.
- routes/poRoutes.js:519 — decodeURIComponent on decoded 'by' → 500 on '%'.
- routes/poRoutes.js:557 — result page icons are literal '?'.
- routes/salesDeals.js POST /quotes — no team check on sales person (PUT has it).
- routes/exportJobs.js:470 — final docs SB No compared with === (number vs string never matches).
- routes/warehouse-be.js:153 — /ex-bonds matches inBondJobId as string only.
- routes/importJobs.js:86 — Ex-Bond without WH BE link answers 500 instead of 400.
- routes/importJobs.js:277 — items-patch problem message lacks "+N more".
- routes/timeline.js:110 — user with no name can delete authorless remarks.
- routes/auth.js:135 vs 169 — 'inactive' status check case differs between login and OTP.
- routes/userManagement.js:45 — message omits 'operator' role.
- routes/fieldTracking.js:150 — lat/lng not validated; :360 isSelfAssigned '' ; :602 activeHours string vs number.
- routes/email.js:49-54 — hourly quota consumed on failed sends.
- server.js:656 — cbicCustomsWatch interval argument ignored (runs every 10 min).
- middleware/auth.js:71 — clearUserStatus stops after first key form.
- routes/tariff.js:35, routes/chatbot.js:91 — dead association guards.
- models/Asset.js:15 — comment refers to deleted PurchaseRequest.
- routes/awb.js:1282,1395 — update/void of a TRANSMITTED HAWB without live master reads null → 500.
- routes/fleet.js:153 — duplicate LR 'unique' check never matches.
- routes/shipments.js:611 — /sync-customs updates without a transaction.
- routes/reports.js:261 — /mis default 'from' via toISOString → 31 Dec of previous year on IST server.
- routes/icegate.js:694-697 — submit-sb status/sender updates run without exportData.id → Sequelize throws (logged).
- routes/search.js:56 — global-search returns array (>=10 remark hits) or object otherwise.
- routes/reports.js:204 — export-data sort depends on server locale.
- utils/geminiExtractor.js:224 — pdf-parse 2.x exports an object: PDF invoice extraction always returns [].
- utils/geminiExtractor.js:202,208 — hard-coded invoice number fix; origin always 'DEL'.
- utils/EsanchitUploader.js — browser never closed; page.waitForTimeout missing in current puppeteer.
- utils/SftpService.js:62 — waitSec unused; 5-min gap only warns.
- utils/WhatsappScheduler.js:156 — cron built from unchecked notifyTime.
- utils/XmlPayloadGenerator generateXfwb — awbSerial always 11 digits; XFHL house email read from formData.
- utils/IcegateJsonBuilder — SB item numbers ignore invoiceSrNo/itemSrNo; SB jobNumber falls back to clock seq; BE reads beNo only.
- utils/beAmendment.js:242 — changesFor reads outside caller's transaction.
- routes/vouchers.js:202-207 — RCM journal number/narration from typed voucherNumber (series number ignored → RCM-AUTO-<id>).
- routes/vouchers.js:185-195 — RCM lookups outside the transaction.
- routes/vouchers.js:563 — approvedBy falls back to user id 1.
- routes/vouchers.js:619 — cash-flow default from = previous 31 Dec on IST server.
- routes/vouchers.js:946 — GSTR-2B tolerance 0 impossible (|| 1).
- routes/vouchers.js:460 — GST returns without dates → 500 SQL error.
- routes/invoices.js:22,35,58 — tax rate 0 becomes 18; IGST never charged; numbers via count()+1 with hard-coded 26-27 (duplicates).
