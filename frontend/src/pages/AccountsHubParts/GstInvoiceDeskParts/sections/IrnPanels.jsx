import { useEffect, useState } from 'react';
import { FileJson, Save, Settings, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, DateInput, Input, SelectBox, Textarea } from '@/components/ui';
import { Box, fmtDate, todayIso } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { pdfFileName } from '../gstMath';
import { downloadEInvoice } from '../invoicePrint';
import { CheckField, GRID_6, GridField, StatusText } from './formParts';

const CANCEL_REASONS = [{ value: '1', label: 'Duplicate' }, { value: '2', label: 'Data entry mistake' }, { value: '3', label: 'Order cancelled' }, { value: '4', label: 'Others' }];
const IRP_CANCEL_HOURS = 24;

const CloseButton = ({ onClose }) => <Button variant="ghost" onClick={onClose}><X /> Close</Button>;

// E-Invoice (IRN) by hand: download the IRP JSON, then save the IRN / Ack / signed QR from the IRP reply
export function IrnPanel({ inv: invoice, onClose, onDone }) {
  const [irn, setIrn] = useState({ irn: invoice.irn || '', ackNo: invoice.ackNo || '', ackDate: invoice.ackDate || todayIso(), signedQr: invoice.signedQr || '' });
  const [msg, setMsg] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const setIrnField = (key, value) => setIrn((old) => ({ ...old, [key]: value }));

  const downloadJson = async () => {
    try {
      const result = await downloadEInvoice([invoice.id], pdfFileName(invoice.invoiceNo) + '_einvoice.json');
      setMsg(result.json.length ? { ok: true, t: 'JSON downloaded - upload it on the IRP (einvoice1.gst.gov.in, or the offline tool), then enter the IRN here' } : { bad: true, t: result.skipped.join('; ') });
    } catch (error) { setMsg({ bad: true, t: errorMessage(error) }); }
  };
  const save = async () => {
    try {
      await accountsApi.gstInvoiceSaveIrn(invoice.id, irn);
      setMsg({ ok: true, t: 'IRN saved - it prints on the invoice with the QR' });
      onDone();
    } catch (error) { setMsg({ bad: true, t: errorMessage(error) }); }
  };

  return (
    <Box title={'E-Invoice (IRN) - ' + invoice.invoiceNo} right={<CloseButton onClose={onClose} />}>
      <div className="tw:mb-2 tw:text-[11px] tw:text-muted-foreground">
        Step 1: Download the JSON (IRP schema 1.1). Step 2: upload it on the IRP. Step 3: enter the IRN, Ack No / Date and paste the Signed QR Code from the IRP reply.
        {invoice.irnStatus ? ' Status now: ' + invoice.irnStatus + (invoice.irnCancelReason ? ' (' + invoice.irnCancelReason + ')' : '') : ''}
      </div>
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:md:grid-cols-[3fr_1.2fr_1fr]">
        <GridField label="IRN (64 characters)"><Input data-allow-text value={irn.irn} onChange={(event) => setIrnField('irn', event.target.value.trim())} /></GridField>
        <GridField label="Ack No"><Input data-allow-text value={irn.ackNo} onChange={(event) => setIrnField('ackNo', event.target.value.trim())} /></GridField>
        <GridField label="Ack Date"><DateInput value={String(irn.ackDate).slice(0, 10)} onValueChange={(value) => setIrnField('ackDate', value)} /></GridField>
        <GridField label="Signed QR Code (from the IRP reply)" className="tw:md:col-span-3"><Textarea className="tw:h-[60px]" value={irn.signedQr} onChange={(event) => setIrnField('signedQr', event.target.value)} /></GridField>
      </div>
      <div className="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Button variant="secondary" size="lg" onClick={downloadJson}><FileJson /> Download JSON</Button>
        <Button variant="success" size="lg" onClick={save} disabled={!irn.irn || !irn.ackNo}><Save /> Save IRN</Button>
        <Button variant="ghost" size="lg" onClick={() => setShowSettings((shown) => !shown)}><Settings /> E-Invoice Settings (for Post To GSTN)</Button>
        <StatusText msg={msg} />
      </div>
      {showSettings && <div className="tw:mt-2.5"><EinvSettings /></div>}
    </Box>
  );
}

// Cancel IRN: on the IRP through the API when E-Invoice Settings are filled, else only marked here
export function CancelIrnPanel({ inv: invoice, onClose, onDone }) {
  const [code, setCode] = useState('2');
  const [remark, setRemark] = useState('');
  const [viaApi, setViaApi] = useState(true);
  const [ready, setReady] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try { const settings = await accountsApi.gstEinvoiceSettings(); setReady(settings.ready); setViaApi(settings.ready); } catch { setReady(false); }
    };
    loadSettings();
  }, []);

  const hoursSinceIrn = invoice.ackDate ? (Date.now() - new Date(String(invoice.ackDate).replace(' ', 'T')).getTime()) / 3600000 : 0;
  const tooLate = hoursSinceIrn > IRP_CANCEL_HOURS;
  const cancel = async () => {
    if (!remark.trim()) { setMsg({ bad: true, t: 'Give the remark' }); return; }
    setBusy(true);
    try {
      const result = await accountsApi.gstInvoiceCancelIrn(invoice.id, { code, reason: remark.trim(), viaApi });
      onDone(result.note);
    } catch (error) { setMsg({ bad: true, t: errorMessage(error) }); }
    setBusy(false);
  };

  return (
    <Box title={'Cancel IRN - ' + invoice.invoiceNo} right={<CloseButton onClose={onClose} />}>
      <div className={cn('tw:mb-1.5 tw:text-[11px]', tooLate ? 'tw:text-destructive' : 'tw:text-muted-foreground')}>
        IRN {String(invoice.irn).slice(0, 18)}... Ack {invoice.ackNo} of {fmtDate(invoice.ackDate)}. {tooLate ? 'More than 24 hours since the IRN - the IRP will not cancel it; issue a credit note instead.' : 'The IRP allows cancelling within 24 hours of generation.'}
      </div>
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2 tw:md:grid-cols-[1fr_3fr_1.4fr_auto]">
        <GridField label="Reason" required><SelectBox value={code} onValueChange={setCode} options={CANCEL_REASONS} /></GridField>
        <GridField label="Remark" required><Input data-allow-text required={!remark} value={remark} maxLength={100} onChange={(event) => setRemark(event.target.value)} placeholder="Why it is cancelled" /></GridField>
        <CheckField label={ready ? 'Cancel on the IRP (API)' : 'API not set up - mark here only'} checked={viaApi} disabled={!ready} onCheckedChange={setViaApi} />
        <Button variant="destructive" size="lg" onClick={cancel} disabled={busy}><XCircle /> {busy ? 'Cancelling' : 'Cancel IRN'}</Button>
      </div>
      {msg && <div className="tw:mt-1.5"><StatusText msg={msg} /></div>}
    </Box>
  );
}

const SECRET_FIELDS = { clientSecret: '', password: '', publicKey: '' };

// E-Invoice API settings (Post To GSTN): typed by the user; password and secret are never shown back
export function EinvSettings() {
  const [settings, setSettings] = useState(null);
  const [msg, setMsg] = useState(null);
  const setSetting = (key) => (event) => setSettings((old) => ({ ...old, [key]: event.target.value }));

  const load = async () => {
    try { setSettings({ ...(await accountsApi.gstEinvoiceSettings()), ...SECRET_FIELDS }); } catch (error) { setMsg({ bad: true, t: errorMessage(error) }); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { baseUrl, clientId, clientSecret, username, password, gstin, publicKey } = settings;
    try {
      await accountsApi.gstSaveEinvoiceSettings({ baseUrl, clientId, clientSecret, username, password, gstin, publicKey });
      setMsg({ ok: true, t: 'Saved' });
      load();
    } catch (error) { setMsg({ bad: true, t: errorMessage(error) }); }
  };

  if (!settings) return <div className="tw:text-muted-foreground">{msg ? msg.t : 'Loading'}</div>;
  const title = <span className="tw:inline-flex tw:items-center tw:gap-1.5">E-Invoice Settings {settings.ready ? <Badge variant="success">ready</Badge> : <Badge variant="warning">not complete</Badge>}</span>;
  return (
    <Box title={title}>
      <div className="tw:mb-1.5 tw:text-[11px] tw:text-muted-foreground">From the NIC e-invoice API registration (or your GSP, if it gives the same API). Sandbox: https://einv-apisandbox.nic.in - for live, the production URL NIC / GSP gives you.</div>
      <div className={GRID_6}>
        <GridField label="API Base URL" span={2}><Input data-allow-text value={settings.baseUrl} onChange={setSetting('baseUrl')} /></GridField>
        <GridField label="GSTIN (blank = ours)"><Input data-allow-text value={settings.gstin} onChange={setSetting('gstin')} /></GridField>
        <GridField label="Client ID"><Input data-allow-text value={settings.clientId} onChange={setSetting('clientId')} /></GridField>
        <GridField label={'Client Secret' + (settings.clientSecretSet ? ' (saved)' : '')}>
          <Input type="password" autoComplete="new-password" value={settings.clientSecret} onChange={setSetting('clientSecret')} placeholder={settings.clientSecretSet ? 'leave blank to keep' : ''} />
        </GridField>
        <GridField label="API User Name"><Input data-allow-text value={settings.username} onChange={setSetting('username')} /></GridField>
        <GridField label={'API Password' + (settings.passwordSet ? ' (saved)' : '')}>
          <Input type="password" autoComplete="new-password" value={settings.password} onChange={setSetting('password')} placeholder={settings.passwordSet ? 'leave blank to keep' : ''} />
        </GridField>
        <GridField label={'NIC Public Key (PEM)' + (settings.publicKeySet ? ' (saved)' : '')} span={5}>
          <Textarea className="tw:h-12 tw:font-mono tw:text-[10px]" value={settings.publicKey} onChange={setSetting('publicKey')} placeholder={settings.publicKeySet ? 'saved - paste only to replace' : '-----BEGIN PUBLIC KEY----- ...'} />
        </GridField>
      </div>
      <div className="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Button variant="success" size="lg" onClick={save}><Save /> Save settings</Button>
        <StatusText msg={msg} />
      </div>
    </Box>
  );
}
