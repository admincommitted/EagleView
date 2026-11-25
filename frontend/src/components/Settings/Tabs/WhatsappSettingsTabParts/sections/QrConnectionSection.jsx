import { Loader2, RefreshCw, Send, Smartphone, Unplug, Wifi } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { QR_STATUS, STARTING_STATUSES } from '../whatsappOptions';

const STATUS_TONES = {
  primary: { card: 'tw:border-primary/40 tw:bg-primary/10', text: 'tw:text-primary', dot: 'tw:bg-primary' },
  danger: { card: 'tw:border-destructive/40 tw:bg-destructive/10', text: 'tw:text-destructive', dot: 'tw:bg-destructive' },
  warning: { card: 'tw:border-warning/40 tw:bg-warning/10', text: 'tw:text-warning', dot: 'tw:bg-warning' },
  success: { card: 'tw:border-success/40 tw:bg-success/10', text: 'tw:text-success', dot: 'tw:bg-success' },
};

function ConnectionStatus({ qrState, connecting, onConnect, onDisconnect }) {
  const status = QR_STATUS[qrState.status];
  const tone = STATUS_TONES[status?.tone] || STATUS_TONES.danger;
  const label = qrState.status === 'connected' && qrState.number ? `${status.label} (${qrState.number})` : status?.label;
  return (
    <div className={cn('tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:px-4 tw:py-4 tw:md:flex-row tw:md:items-center tw:md:justify-between tw:md:px-6', tone.card)}>
      <div className="tw:flex tw:items-center tw:gap-2.5">
        <span className={cn('tw:size-2.5 tw:shrink-0 tw:rounded-full tw:shadow-sm', tone.dot)} />
        <span className={cn('tw:text-[13px] tw:font-bold', tone.text)}>{label}</span>
      </div>
      {qrState.status === 'disconnected' && qrState.error && <div className="tw:flex-1 tw:text-[11px] tw:text-destructive tw:md:mx-3.5">{qrState.error}</div>}
      <div className="tw:flex tw:gap-2">
        {qrState.status === 'disconnected' && (
          <Button variant="success" onClick={onConnect} disabled={connecting}>
            {connecting ? <Loader2 className="tw:animate-spin" /> : <Wifi />}{connecting ? 'Starting...' : 'Connect'}
          </Button>
        )}
        {STARTING_STATUSES.includes(qrState.status) && <Button variant="warning" onClick={onConnect}><RefreshCw /> Refresh QR</Button>}
        {qrState.status === 'connected' && <Button variant="destructive" onClick={onDisconnect}><Unplug /> Disconnect</Button>}
      </div>
    </div>
  );
}

function QrCode({ qr }) {
  return (
    <Card>
      <CardContent className="tw:items-center tw:gap-3.5 tw:py-7 tw:text-center">
        <div className="tw:flex tw:items-center tw:justify-center tw:gap-2 tw:text-[13px] tw:font-bold tw:text-foreground">
          <Smartphone className="tw:size-4.5 tw:text-success" /> Scan QR code with your mobile WhatsApp
        </div>
        <img src={qr} alt="QR" className="tw:size-[260px] tw:max-w-full tw:rounded-xl tw:border-3 tw:border-success tw:bg-white tw:p-2" />
        <div className="tw:text-[11px] tw:leading-loose tw:text-muted-foreground">
          <b>Steps:</b><br />1. Open WhatsApp on your mobile<br />2. <b>3 dots (⋮) &rarr; Linked Devices &rarr; Link a Device</b><br />3. Scan the QR code with your camera
        </div>
        <div className="tw:flex tw:items-center tw:justify-center tw:gap-1 tw:text-[10px] tw:text-muted-foreground">
          <Loader2 className="tw:size-3 tw:animate-spin" /> QR refreshes every 60 seconds
        </div>
      </CardContent>
    </Card>
  );
}

function QrTestMessage({ ctx }) {
  const { handleQrTest, setTestMessage, setTestNumber, testMessage, testNumber, testingQr } = ctx;
  return (
    <Card>
      <CardHeader><CardTitle icon={<Send className="tw:text-success" />}>Send Test Message</CardTitle></CardHeader>
      <CardContent>
        <Input value={testNumber} onChange={(event) => setTestNumber(event.target.value)} placeholder="Mobile number (e.g. 9876543210)" />
        <Textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} placeholder="Message (optional)" rows={2} />
        <Button variant="success" className="tw:self-start" onClick={handleQrTest} disabled={testingQr}>
          {testingQr ? <Loader2 className="tw:animate-spin" /> : <Send />}{testingQr ? 'Sending...' : 'Send WhatsApp'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function QrConnectionSection({ ctx }) {
  const { connecting, handleConnect, handleDisconnect, qrState } = ctx;
  return (
    <>
      <ConnectionStatus qrState={qrState} connecting={connecting} onConnect={handleConnect} onDisconnect={handleDisconnect} />
      {qrState.qr && <QrCode qr={qrState.qr} />}
      {qrState.status === 'connected' && <QrTestMessage ctx={ctx} />}
    </>
  );
}
