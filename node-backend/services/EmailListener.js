const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const IcegateProfile = require('../models/IcegateProfile');
const ExportFinalDoc = require('../models/ExportFinalDoc');

let activeConnections = [];

async function processEmail(connection, message) {
  const all = message.parts.find(part => part.which === '');
  const id = message.attributes.uid;
  
  try {
    const parsed = await simpleParser(all.body);
    const messageId = parsed.messageId;
    const subject = parsed.subject || '';
    
    if (messageId) {
       const existingMsg = await ExportFinalDoc.findOne({ where: { messageId } });
       if (existingMsg) {
          await connection.addFlags(id, '\\Seen');
          return;
       }
    }

    if (!parsed.attachments || parsed.attachments.length === 0) {
       await connection.addFlags(id, '\\Seen');
       return;
    }

    let sbNo = null;
    const subjMatch = subject.match(/(?:SB|S\/?B)\s*NO[:.\s]*(\d{7})/i) || subject.match(/(\d{7})/);
    if (subjMatch) sbNo = subjMatch[1];

    for (const att of parsed.attachments) {
      if (att.contentType !== 'application/pdf' && !att.filename.toLowerCase().endsWith('.pdf')) continue;
      
      const filename = att.filename || 'document.pdf';
      
      if (!sbNo) {
         const fileMatch = filename.match(/(\d{7})/);
         if (fileMatch) sbNo = fileMatch[1];
      }

      if (!sbNo) continue; 

      let docType = 'OTHER';
      const textToSearch = (subject + ' ' + filename).toLowerCase();
      if (textToSearch.includes('leo')) docType = 'LEO_COPY';
      else if (textToSearch.includes('first')) docType = 'FIRST_COPY';
      else if (textToSearch.includes('gatepass') || textToSearch.includes('gate pass')) docType = 'GATEPASS';

      if (docType === 'OTHER') continue; 

      const existingDoc = await ExportFinalDoc.findOne({ where: { sbNo, docType } });
      if (existingDoc) {
         console.log(`[EmailListener] Skipping duplicate ${docType} for SB: ${sbNo}`);
         continue; 
      }

      const dir = path.join(__dirname, '../uploads/final_docs');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const uniqueName = `${docType}_${sbNo}_${Date.now()}.pdf`;
      const filePath = path.join(dir, uniqueName);
      
      fs.writeFileSync(filePath, att.content);
      const fileUrl = '/uploads/final_docs/' + uniqueName;

      await ExportFinalDoc.create({
         sbNo,
         docType,
         fileName: filename,
         fileUrl,
         messageId
      });
      
      console.log(`[EmailListener] ✅ Real-Time Downloaded: ${docType} for SB ${sbNo}`);
    }

    await connection.addFlags(id, '\\Seen');

  } catch (err) {
    console.error('[EmailListener] Error parsing email UID', id, err);
  }
}

async function startIdleListener(profile, targetFolder) {
    const config = {
        imap: {
            user: profile.imapEmail,
            password: profile.imapAppPassword,
            host: profile.imapHost || 'imap.gmail.com',
            port: profile.imapPort || 993,
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: require('../utils/tls').rejectUnauthorized },
            keepalive: {
                interval: 10000,
                idleInterval: 300000,
                forceNoop: true
            }
        }
    };

    let connection;

    const connectAndIdle = async () => {
        try {
            connection = await imaps.connect(config);
            activeConnections.push(connection);
            
            connection.imap.on('error', (err) => {
                console.error(`[EmailListener] Connection error on ${targetFolder}:`, err.message);
            });
            connection.on('error', (err) => {
                console.error(`[EmailListener] ImapSimple wrapper error on ${targetFolder}:`, err.message);
            });
            connection.imap.on('end', () => {
                console.log(`[EmailListener] Connection dropped for ${targetFolder}. Reconnecting in 10s...`);
                setTimeout(connectAndIdle, 10000);
            });

            await connection.openBox(targetFolder);
            console.log(`[EmailListener] 📡 LIVE Watching ${targetFolder} for ${profile.imapEmail}`);
            
            await fetchRecent();

            connection.imap.on('mail', async (numNewMsgs) => {
                console.log(`[EmailListener] 🔔 PING: New mail arrived in ${targetFolder}!`);
                await fetchRecent();
            });

        } catch (err) {
            console.error(`[EmailListener] Failed to start IDLE for ${targetFolder}:`, err.message);
            setTimeout(connectAndIdle, 10000);
        }
    };

    const fetchRecent = async () => {
        if (!connection || connection.imap.state !== 'authenticated') return;
        try {
            const d = new Date();
            d.setDate(d.getDate() - 3); // Look back 3 days to catch webhook-marked-read emails
            const searchCriteria = [['SINCE', d]];
            const fetchOptionsHeader = { bodies: ['HEADER.FIELDS (MESSAGE-ID SUBJECT)'], markSeen: false };
            const headerMessages = await connection.search(searchCriteria, fetchOptionsHeader);
            
            if (headerMessages && headerMessages.length > 0) {
                 for (const hMsg of headerMessages) {
                    const id = hMsg.attributes.uid;
                    const all = hMsg.parts.find(part => part.which === 'HEADER.FIELDS (MESSAGE-ID SUBJECT)');
                    let messageId = null;
                    if (all && all.body) {
                        try {
                            const parsed = await simpleParser(all.body);
                            messageId = parsed.messageId;
                        } catch(e) {}
                    }
                    
                    if (messageId) {
                        const existingMsg = await ExportFinalDoc.findOne({ where: { messageId } });
                        if (existingMsg) continue; // Skip, already downloaded
                    }
                    
                    // Not in DB, fetch full body
                    const fetchFull = { bodies: [''], markSeen: false };
                    const fullMessages = await connection.search([['UID', id]], fetchFull);
                    if (fullMessages && fullMessages.length > 0) {
                        await processEmail(connection, fullMessages[0]);
                    }
                 }
            }
        } catch(e) {
            console.error(`[EmailListener] Search error in ${targetFolder}:`, e.message);
        }
    };

    await connectAndIdle();
}

async function runEmailListener() {
  console.log('[EmailListener] Starting Real-Time IMAP IDLE engine...');
  try {
    const profiles = await IcegateProfile.findAll({ 
       where: { 
         imapEmail: { [Op.not]: null, [Op.ne]: '' },
         imapAppPassword: { [Op.not]: null, [Op.ne]: '' }
       }
    });

    if (profiles.length === 0) {
      console.log('[EmailListener] No profiles configured. Listener waiting.');
      return;
    }

    for (const profile of profiles) {
        const folderSetting = (profile.imapFolder || 'INBOX').trim();
        let foldersToScan = [];
        
        if (folderSetting.toUpperCase() === 'ALL') {
             foldersToScan = ['INBOX', '[Gmail]/All Mail'];
        } else if (folderSetting.includes(',')) {
             foldersToScan = folderSetting.split(',').map(f => f.trim()).filter(f => f);
        } else {
             foldersToScan = [folderSetting];
        }

        for (const targetFolder of foldersToScan) {
           startIdleListener(profile, targetFolder);
        }
    }
  } catch (e) {
    console.error('[EmailListener] General Error:', e.message);
  }
}

async function restartEmailListeners() {
   console.log('[EmailListener] Restarting email listeners due to profile update...');
   for (let c of activeConnections) {
       try { c.end(); } catch(e) {}
   }
   activeConnections = [];
   await runEmailListener();
}

module.exports = { runEmailListener, restartEmailListeners };
