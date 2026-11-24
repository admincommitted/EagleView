// Field app over the internet (09-Nov-2026).
//
// The field boys' phones are on mobile data, outside the office network, so they cannot reach this PC. This small
// gateway lets ONLY what the field app (and the signed PO approval links) need through to the EagleView backend, and a
// Cloudflare quick tunnel gives it a public https address. Everything else - accounts, customs, masters, settings,
// uploads - answers 404 from outside, whatever the URL.
//
//   node field_gateway.js            (start_field_internet.bat runs it)
//
// The public address is written to FIELD_PUBLIC_URL.txt next to this file while the tunnel runs (the Field Operations
// screen shows it, PO approval links use it) and removed when this window is closed.
// A quick tunnel's address changes every time it starts; a fixed address needs a Cloudflare account and domain.
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || '5001', 10);
// 14-Nov-2026: 5060 (was 5050, the port of the DSC Local Signer - the two could not run together)
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '5060', 10);
const URL_FILE = path.join(__dirname, 'FIELD_PUBLIC_URL.txt');

// what may pass: [method(s), path regex]
const ALLOW = [
  [['GET', 'HEAD'], /^\/field-app(\/.*)?$/],
  [['GET', 'POST'], /^\/socket\.io\/.*$/],
  [['GET', 'POST'], /^\/api\/field-tracking\/agents$/],
  [['PATCH'], /^\/api\/field-tracking\/agents\/[A-Za-z0-9-]+\/(status|task-complete)$/],
  [['POST'], /^\/api\/field-tracking\/(location|location\/bulk|task)$/],
  [['POST'], /^\/api\/field-tracking\/device\/register$/], // 14-Nov-2026: a phone registers with the office code
  [['GET'], /^\/api\/field-tracking\/(health|stats)$/],
  [['GET'], /^\/api\/po\/\d+\/action$/], // signed Approve / Reject / Hold links
];
const allowed = (method, url) => {
  const p = String(url || '').split('?')[0];
  if (p.includes('..') || /%2e|%2f|%5c/i.test(p)) return false;
  return ALLOW.some(([ms, rx]) => ms.includes(method) && rx.test(p));
};
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

const server = http.createServer((req, res) => {
  if (!allowed(req.method, req.url)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const up = http.request({ host: '127.0.0.1', port: BACKEND_PORT, method: req.method, path: req.url, headers: { ...req.headers, host: '127.0.0.1:' + BACKEND_PORT } }, (r) => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  up.on('error', (e) => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('EagleView backend is not running on this PC (' + e.code + ')'); });
  req.pipe(up);
});

// websocket (socket.io) upgrade: only for /socket.io/
server.on('upgrade', (req, socket, head) => {
  if (!allowed('GET', req.url) || !/^\/socket\.io\//.test(req.url)) return socket.destroy();
  const up = net.connect(BACKEND_PORT, '127.0.0.1', () => {
    let h = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) h += `${req.rawHeaders[i]}: ${/^host$/i.test(req.rawHeaders[i]) ? '127.0.0.1:' + BACKEND_PORT : req.rawHeaders[i + 1]}\r\n`;
    up.write(h + '\r\n'); if (head && head.length) up.write(head);
    up.pipe(socket); socket.pipe(up);
  });
  up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy());
});

function findCloudflared() {
  const c = [
    path.join(__dirname, 'tools', 'cloudflared.exe'),
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
  ];
  for (const f of c) if (fs.existsSync(f)) return f;
  return 'cloudflared'; // on PATH (winget install Cloudflare.cloudflared)
}

const cleanup = () => { try { fs.unlinkSync(URL_FILE); } catch (e) { /* gone */ } };
let tunnel = null;
function startTunnel() {
  const exe = findCloudflared();
  tunnel = spawn(exe, ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:' + GATEWAY_PORT], { windowsHide: true });
  const seen = (buf) => {
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(buf));
    if (m) {
      fs.writeFileSync(URL_FILE, m[0]);
      console.log('\n==================================================================');
      console.log('  FIELD APP LINK (send to field boys, works on mobile data):');
      console.log('    ' + m[0] + '/field-app');
      console.log('  Keep this window open. Closing it stops the internet link.');
      console.log('==================================================================\n');
    }
  };
  tunnel.stdout.on('data', seen); tunnel.stderr.on('data', seen);
  tunnel.on('error', (e) => {
    console.error('\nCloudflare tunnel (cloudflared) not found or could not start: ' + e.message);
    console.error('Install it once with:   winget install --id Cloudflare.cloudflared');
    console.error('or put cloudflared.exe in ' + path.join(__dirname, 'tools') + ' - then run this again.\n');
  });
  tunnel.on('exit', (code) => { cleanup(); log('tunnel stopped (' + code + ')'); });
}

server.listen(GATEWAY_PORT, '127.0.0.1', () => {
  log(`Field gateway on 127.0.0.1:${GATEWAY_PORT} -> EagleView backend 127.0.0.1:${BACKEND_PORT} (field app + PO approval links only)`);
  cleanup();
  startTunnel();
});
server.on('error', (e) => { console.error('Gateway could not start: ' + e.message + (e.code === 'EADDRINUSE' ? ` (port ${GATEWAY_PORT} is in use - is it already running?)` : '')); process.exit(1); });

const stop = () => { cleanup(); try { tunnel && tunnel.kill(); } catch (e) { /* done */ } process.exit(0); };
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'].forEach(s => process.on(s, stop));
process.on('exit', cleanup);

// exported for the test only
module.exports = { allowed };
