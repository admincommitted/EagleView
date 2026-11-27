// Field app over the internet.
//
// The field boys' phones are on mobile data, outside the office network, so they cannot reach this PC. This small
// gateway lets ONLY what the field app (and the signed PO approval links) need through to the EagleView backend, and a
// Cloudflare quick tunnel gives it a public https address. Everything else - accounts, customs, masters, settings,
// uploads - answers 404 from outside, whatever the URL.
//
//   node src/gateway/fieldGateway.js            (start_field_internet.bat runs it)
//
// The public address is written to node-backend/FIELD_PUBLIC_URL.txt while the tunnel runs (the Field Operations
// screen shows it, PO approval links use it) and removed when this window is closed.
// A quick tunnel's address changes every time it starts; a fixed address needs a Cloudflare account and domain.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Not taken from src/config/env.js: the gateway does not read node-backend/.env (nor need JWT_SECRET); it uses only
// the environment of its own window, so the backend port defaults to 5001.
const BACKEND_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || '5001', 10);
// 5060, not 5050: that is the port of the DSC Local Signer, and the two must run together
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '5060', 10);
const URL_FILE = path.join(BACKEND_ROOT, 'FIELD_PUBLIC_URL.txt');
const TOOLS_DIR = path.join(BACKEND_ROOT, 'tools');
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const STOP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'];

// what may pass: [method(s), path pattern]
const ALLOWED_ROUTES = [
  [['GET', 'HEAD'], /^\/field-app(\/.*)?$/],
  [['GET', 'POST'], /^\/socket\.io\/.*$/],
  [['GET', 'POST'], /^\/api\/field-tracking\/agents$/],
  [['PATCH'], /^\/api\/field-tracking\/agents\/[A-Za-z0-9-]+\/(status|task-complete)$/],
  [['POST'], /^\/api\/field-tracking\/(location|location\/bulk|task)$/],
  [['POST'], /^\/api\/field-tracking\/device\/register$/], // a phone registers with the office code
  [['GET'], /^\/api\/field-tracking\/(health|stats)$/],
  [['GET'], /^\/api\/po\/\d+\/action$/], // signed Approve / Reject / Hold links
];

/** True when the method + path may pass; path tricks (.., encoded / . \) never pass. */
export function allowed(method, url) {
  const requestPath = String(url || '').split('?')[0];
  if (requestPath.includes('..') || /%2e|%2f|%5c/i.test(requestPath)) return false;
  return ALLOWED_ROUTES.some(([methods, pattern]) => methods.includes(method) && pattern.test(requestPath));
}

const log = (...parts) => console.log(new Date().toLocaleTimeString(), ...parts);
const backendHostHeader = () => BACKEND_HOST + ':' + BACKEND_PORT;

function forwardRequest(req, res) {
  if (!allowed(req.method, req.url)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  const upstream = http.request(
    {
      host: BACKEND_HOST,
      port: BACKEND_PORT,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: backendHostHeader() },
    },
    (backendResponse) => {
      res.writeHead(backendResponse.statusCode, backendResponse.headers);
      backendResponse.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('EagleView backend is not running on this PC (' + error.code + ')');
  });
  return req.pipe(upstream);
}

/** The raw upgrade request as the backend should get it: the same headers, Host pointing at the backend. */
function upgradeRequestText(req) {
  let text = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
  for (let index = 0; index < req.rawHeaders.length; index += 2) {
    const name = req.rawHeaders[index];
    text += `${name}: ${/^host$/i.test(name) ? backendHostHeader() : req.rawHeaders[index + 1]}\r\n`;
  }
  return text + '\r\n';
}

/** The websocket (socket.io) upgrade: only for /socket.io/. */
function forwardUpgrade(req, socket, head) {
  if (!allowed('GET', req.url) || !req.url.startsWith('/socket.io/')) return socket.destroy();
  const upstream = net.connect(BACKEND_PORT, BACKEND_HOST, () => {
    upstream.write(upgradeRequestText(req));
    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  return upstream;
}

function findCloudflared() {
  const candidates = [
    path.join(TOOLS_DIR, 'cloudflared.exe'),
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
  ];
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  return 'cloudflared'; // on PATH (winget install Cloudflare.cloudflared)
}

const removeUrlFile = () => {
  try {
    fs.unlinkSync(URL_FILE);
  } catch {
    // already gone
  }
};

function announcePublicUrl(output) {
  const match = TUNNEL_URL_PATTERN.exec(String(output));
  if (!match) return;
  fs.writeFileSync(URL_FILE, match[0]);
  console.log('\n==================================================================');
  console.log('  FIELD APP LINK (send to field boys, works on mobile data):');
  console.log('    ' + match[0] + '/field-app');
  console.log('  Keep this window open. Closing it stops the internet link.');
  console.log('==================================================================\n');
}

let tunnel = null;

function startTunnel() {
  tunnel = spawn(findCloudflared(), ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:' + GATEWAY_PORT], {
    windowsHide: true,
  });
  tunnel.stdout.on('data', announcePublicUrl);
  tunnel.stderr.on('data', announcePublicUrl);
  tunnel.on('error', (error) => {
    console.error('\nCloudflare tunnel (cloudflared) not found or could not start: ' + error.message);
    console.error('Install it once with:   winget install --id Cloudflare.cloudflared');
    console.error('or put cloudflared.exe in ' + TOOLS_DIR + ' - then run this again.\n');
  });
  tunnel.on('exit', (code) => {
    removeUrlFile();
    log('tunnel stopped (' + code + ')');
  });
}

function stop() {
  removeUrlFile();
  try {
    if (tunnel) tunnel.kill();
  } catch {
    // already stopped
  }
  process.exit(0);
}

const server = http.createServer(forwardRequest);
server.on('upgrade', forwardUpgrade);

server.listen(GATEWAY_PORT, '127.0.0.1', () => {
  log(
    `Field gateway on 127.0.0.1:${GATEWAY_PORT} -> EagleView backend 127.0.0.1:${BACKEND_PORT} (field app + PO approval links only)`,
  );
  removeUrlFile();
  startTunnel();
});
server.on('error', (error) => {
  const portHint = error.code === 'EADDRINUSE' ? ` (port ${GATEWAY_PORT} is in use - is it already running?)` : '';
  console.error('Gateway could not start: ' + error.message + portHint);
  process.exit(1);
});

STOP_SIGNALS.forEach((signal) => process.on(signal, stop));
process.on('exit', removeUrlFile);
