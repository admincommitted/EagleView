// node tools/check_tls.js  - checks the certificates of the servers the backend talks to (no login, no data sent)
import tls from 'node:tls';
const hosts = [
  ['cisapi.icegate.gov.in', 443, 'ICEGATE JSON filing'],
  ['www.ulip.dpiit.gov.in', 443, 'ULIP'],
  ['imap.gmail.com', 993, 'Gmail IMAP'],
];
(async () => {
  for (const [host, port, label] of hosts) {
    await new Promise((done) => {
      const s = tls.connect({ host, port, servername: host, rejectUnauthorized: true, timeout: 10000 }, () => {
        const c = s.getPeerCertificate();
        console.log(
          `OK    ${label.padEnd(20)} ${host}  (issuer: ${c.issuer && (c.issuer.O || c.issuer.CN)}, valid to ${c.valid_to})`,
        );
        s.end();
        done();
      });
      s.on('error', (e) => {
        console.log(`FAIL  ${label.padEnd(20)} ${host}  -> ${e.code || e.message}`);
        done();
      });
      s.on('timeout', () => {
        console.log(`FAIL  ${label.padEnd(20)} ${host}  -> timeout`);
        s.destroy();
        done();
      });
    });
  }
  console.log('\nAll OK = keep the default. A FAIL with a certificate error = see utils/tls.js.');
})();
