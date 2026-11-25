import { downloadBlob } from '@/lib/download';

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

export const DEFAULT_FORM = {
  sftp_test_host: 'ftptest.myvan.descartes.com',
  sftp_prod_host: 'ftp.myvan.descartes.com',
  sftp_port: '22',
  sftp_active_env: 'test',
  sftp_username: '',
  sftp_password: '',
  sftp_private_key: '',
  sftp_passphrase: '',
  van_recipient_id: 'TDVAIR01GLNDTCR',
  van_sender_pima: '',
  company_name: '',
  default_currency: 'USD',
  default_charge_code: 'PP',
};

export const CHARGE_CODES = [
  { value: 'PP', label: 'PP — Prepaid' },
  { value: 'CC', label: 'CC — Collect' },
  { value: 'CA', label: 'CA — Cash' },
];

export const DESCARTES_SESSION_LOGS = {
  test: 'https://wwwtest.myvan.descartes.com/iVanDiagsOF/OftpSessionList?ProtocolDDL=sftp',
  production: 'https://www.myvan.descartes.com/iVanDiagsOF/OftpSessionList?ProtocolDDL=sftp',
};

export const DESCARTES_ERROR_CODES = [
  { code: '0', label: 'Success', tone: 'success' },
  { code: '11', label: 'Duplicate — do not retry', tone: 'danger' },
  { code: '28', label: 'Corrupt file — do not retry', tone: 'danger' },
  { code: '15', label: 'File size > 1 MB', tone: 'warning' },
  { code: '4', label: 'General error', tone: 'warning' },
  { code: '23', label: 'Auth failure', tone: 'danger' },
];

// The API sends a saved password / private key back as '***'; that mask is never sent back as the value.
export const MASKED = '***';
// the screen also shows '*** (generated & saved)' after a new key: any value starting with the mask is not a real secret
export const isMasked = (value) => String(value ?? '').startsWith(MASKED);

export const downloadText = (content, fileName) => downloadBlob(new Blob([content], { type: 'text/plain' }), fileName);
