const express    = require("express");
const router     = express.Router();
const mailer     = require("../utils/mailer");
// 14-Nov-2026 (security check): the SMTP test is for an admin; /send keeps the company "From", is limited per user and
// is logged (before, any logged-in user could send any number of mails with any From through the company SMTP)
const { requireAdmin } = require("../middleware/auth");
const sendLog = new Map(); // userId -> [times]
const SEND_PER_HOUR = 200;
// 28-Oct-2026: SMTP from Settings > Email (table EmailConfig) through utils/mailer.js. The test used the screen's
// values only, so a saved password (shown empty on the screen) was sent as empty and the test always failed.

// ── POST /api/email/test ─────────────────────────────────────────
router.post("/test", requireAdmin, async (req, res) => {
  try {
    const { to, smtp } = req.body;
    if (!to) return res.status(400).json({ error: "Recipient email required" });

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to).trim())) return res.status(400).json({ error: "Recipient email is not valid" });
    const c = await mailer.smtpConfig(smtp);
    await mailer.sendMail({
      from:    `"${c.fromName}" <${c.user}>`,
      to,
      subject: "SMTP Test — Committed Cargo ERP",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#1e3a5f;">✅ SMTP Test Successful</h2>
          <p>This is a test email from <strong>Committed Cargo ERP</strong>.</p>
          <p>Your email notification setup is working correctly.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
          <p style="color:#94a3b8;font-size:12px;">Sent at: ${new Date().toLocaleString("en-IN", { timeZone:"Asia/Kolkata" })} IST</p>
        </div>
      `,
    }, smtp);

    res.json({ success: true, message: "Test email sent to " + to });
  } catch (err) {
    console.error("[Email Test]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── POST /api/email/send ─────────────────────────────────────────
// Generic send — used internally by other routes
router.post("/send", async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};
    if (!to || !subject || !html) return res.status(400).json({ error: "to, subject and html are required" });
    const uid = String((req.user && req.user.id) || "?");
    const now = Date.now(); const times = (sendLog.get(uid) || []).filter(t => now - t < 3600000);
    const count = String(to).split(/[,;]/).filter(x => x.trim()).length || 1;
    if (times.length + count > SEND_PER_HOUR) return res.status(429).json({ error: `Mail limit reached (${SEND_PER_HOUR} an hour per user). Try again later.` });
    for (let i = 0; i < count; i++) times.push(now); sendLog.set(uid, times);

    await mailer.sendMail({ to, subject, html }); // From: the company address from Settings > Email
    console.log(`[Email Send] user ${uid} (${(req.user && req.user.username) || ""}) to ${String(to).slice(0, 200)} - ${String(subject).slice(0, 120)}`);
    res.json({ success: true });
  } catch (err) {
    console.error("[Email Send]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
