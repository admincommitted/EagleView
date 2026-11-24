// Helpers and constants
// Split out of NetworkSettingsTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';

export const NETWORK_PRESETS = [
  { id: 'descartes', name: 'Descartes myVAN (GLN)', color: '#1d4ed8',
    test: 'ftptest.myvan.descartes.com', prod: 'ftp.myvan.descartes.com', port: '22',
    recipientId: 'TDVAIR01GLNDTCR',
    info: 'Standard Descartes myVAN SFTP — for XFWB / XFHL transmission' },
  { id: 'sita', name: 'SITA Cargo (Traxon)', color: '#0369a1',
    test: 'sftp.traxon.com', prod: 'sftp.traxon.com', port: '22',
    recipientId: '', info: 'SITA Traxon SFTP — for SITA-connected airlines' },
  { id: 'champ', name: 'CHAMP Cargosprint', color: '#059669',
    test: 'sftp.cargosprint.net', prod: 'sftp.cargosprint.net', port: '22',
    recipientId: '', info: 'CHAMP Cargosprint SFTP — for Cargosprint network airlines' },
  { id: 'custom', name: 'Custom / Other', color: '#7c3aed',
    test: '', prod: '', port: '22', recipientId: '', info: 'Enter your own SFTP host manually' },
];
