const SftpClient = require('ssh2-sftp-client');

class MyVanSftpService {
    /**
     * Transmit payload to Descartes MyVAN via SFTP
     * @param {string} filename - The name of the file to save remotely
     * @param {Buffer|string} fileBuffer - The FWB/FHL content
     */
    static async transmitPayload(filename, fileBuffer) {
        // Enforce 1 MB Size Limit before attempting connection
        const bufferSize = Buffer.byteLength(fileBuffer, 'utf8');
        if (bufferSize > 1024 * 1024) {
            throw new Error("Quota Exceeded: Payload size exceeds 1 MB limit.");
        }

        const sftp = new SftpClient();
        
        // MyVAN Strict Configuration
        const config = {
            host: process.env.MYVAN_HOST || 'ftptest.myvan.descartes.com', // Strict DNS mapping
            port: 22,
            username: process.env.MYVAN_USERNAME,
            privateKey: process.env.MYVAN_PRIVATE_KEY, // Strict SSH2 Key Auth
            readyTimeout: 300000, // Generous 300 seconds timeout for processing delays
            algorithms: {
                cipher: [
                    'aes256-ctr', 
                    'aes256-gcm@openssh.com'
                ],
                hmac: [
                    'hmac-sha2-256', 
                    'hmac-sha2-512'
                ]
            }
        };

        try {
            await sftp.connect(config);
            
            // Atomic Upload: Stream directly, NO renaming allowed by Descartes
            const remotePath = `./${filename}`;
            await sftp.put(Buffer.from(fileBuffer), remotePath);
            
            console.log(`[SFTP Success] File ${filename} transmitted successfully.`);
            return { success: true, message: 'Transmitted successfully' };
            
        } catch (err) {
            console.error(`[SFTP Error] File: ${filename}, Error Code: ${err.code}, Message: ${err.message}`);
            
            // Error Code 11: File already exists (Considered Success / Processed)
            if (err.code === 11 || err.message.includes('SSH_FX_FILE_ALREADY_EXISTS')) {
                console.log(`[SFTP Skip] File ${filename} already exists. Considered SUCCESS.`);
                return { success: true, message: 'File already exists and processed' };
            }
            
            // Error Code 15 (Quota Exceeded) or Error Code 4 (Failure) - Permanent Errors
            if (err.code === 15 || err.message.includes('SSH_FX_QUOTA_EXCEEDED') || 
                err.code === 4  || err.message.includes('SSH_FX_FAILURE')) {
                throw new Error(`PERMANENT_SFTP_ERROR: ${err.message}`);
            }

            // Throw generic error for retryable connection issues
            throw err;
            
        } finally {
            // Strict Session Management: Close immediately, max 4 concurrent sessions allowed
            try {
                await sftp.end();
            } catch (e) {
                console.error("[SFTP Close Error]", e.message);
            }
        }
    }
}

module.exports = MyVanSftpService;
