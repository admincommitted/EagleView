const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;

async function waitForIcegateOtp(userEmail, appPassword, timeoutMs = 60000) {
    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: userEmail, pass: appPassword },
        logger: false
    });

    console.log(`[OTP Fetcher] Connecting to Gmail IMAP for ${userEmail}...`);
    await client.connect();
    let otp = null;
    let elapsed = 0;

    console.log("[OTP Fetcher] Waiting for ICEGATE OTP email...");
    try {
        let lock = await client.getMailboxLock('INBOX');
        try {
            while (elapsed < timeoutMs) {
                // Search for unseen emails
                let generator = client.fetch({ seen: false }, { source: true, envelope: true });
                
                for await (let msg of generator) {
                    const fromAddress = (msg.envelope.from[0]?.address || "").toLowerCase();
                    const subject = (msg.envelope.subject || "").toLowerCase();
                    
                    // Check if email is from ICEGATE or subject contains OTP
                    if (fromAddress.includes('icegate') || subject.includes('otp')) {
                        const parsed = await simpleParser(msg.source);
                        const text = parsed.text || parsed.html || "";
                        
                        // Extract 6-digit OTP using regex
                        const match = text.match(/(?:OTP|password|code).*?(\d{6})\b/i) || text.match(/\b(\d{6})\b/);
                        if (match) {
                            otp = match[1];
                            console.log(`[OTP Fetcher] Found OTP: ${otp}`);
                            // Mark email as read so it's not processed again
                            await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
                            break;
                        }
                    }
                }
                
                if (otp) break;
                
                await new Promise(r => setTimeout(r, 5000)); // wait 5 seconds before checking again
                elapsed += 5000;
            }
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }

    if (!otp) {
        console.log("[OTP Fetcher] Timeout: No OTP email received within the expected time.");
    }

    return otp;
}

module.exports = { waitForIcegateOtp };
