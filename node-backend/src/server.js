import childProcess from 'node:child_process';
import http from 'node:http';
import { env } from './config/env.js';
import { createApp, initializeDatabase } from './app.js';
import { createSocketServer } from './sockets/socket.server.js';
import { startBackgroundJobs } from './jobs/index.js';

// the browsers started for PDFs and WhatsApp must not open console windows on the office PC
const spawnProcess = childProcess.spawn;
childProcess.spawn = (command, args, options = {}) => spawnProcess(command, args, { ...options, windowsHide: true });

function exitBecausePortIsBusy(port) {
  const line = '='.repeat(72);
  console.error(
    [
      '',
      line,
      `  PORT ${port} IS ALREADY IN USE - this server did NOT start.`,
      '  Something else is answering on that port (most likely an older copy of this',
      '  server still running, or the old HRMS backend in the "backend" folder).',
      '',
      '  Find it and close it (PowerShell):',
      `    Get-Process -Id (Get-NetTCPConnection -LocalPort ${port} -State Listen).OwningProcess`,
      `    Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port} -State Listen).OwningProcess -Force`,
      '',
      '  Then start this server again. To run it on another port instead:',
      '    $env:PORT=5001; npm start',
      line,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

// a dropped socket / IMAP connection must not stop the server; a port that cannot be taken must
function keepRunningOnStrayErrors() {
  process.on('uncaughtException', (error) => {
    if (error?.code === 'EADDRINUSE') return exitBecausePortIsBusy(error.port || env.port);
    console.error('[Global] Uncaught Exception:', error?.message || error);
  });
  process.on('unhandledRejection', (reason) => console.error('[Global] Unhandled Rejection:', reason));
}

async function startServer() {
  keepRunningOnStrayErrors();
  const app = createApp();
  const httpServer = http.createServer(app);
  createSocketServer(httpServer, app);
  await initializeDatabase();

  httpServer.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') return exitBecausePortIsBusy(error.port || env.port);
    console.error('[Server]', error?.message || error);
    process.exit(1);
  });
  httpServer.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
    startBackgroundJobs({ app });
  });
}

startServer().catch((error) => console.error('Failed to sync database:', error));
