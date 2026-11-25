import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Server, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { sharedWidgetsApi } from './sharedWidgetsApi';

const POLL_SECONDS = 30;

const STATES = {
  checking: { pill: 'tw:border-input tw:bg-muted', dot: 'tw:bg-muted-foreground', text: 'tw:text-muted-foreground' },
  connected: { pill: 'tw:border-success/40 tw:bg-success/10 tw:ring-3 tw:ring-success/10', dot: 'tw:bg-success', text: 'tw:text-success' },
  offline: { pill: 'tw:border-destructive/40 tw:bg-destructive/10', dot: 'tw:bg-destructive', text: 'tw:text-destructive' },
};

const clockTime = (when) => (when
  ? new Date(when).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : null);

function StatusDetails({ status, connected, checking, countdown, onCheckNow }) {
  const lastOk = clockTime(status?.lastConnectedAt);
  const lastCheck = clockTime(status?.lastCheckedAt);
  const environment = (status?.env || 'test').toUpperCase();
  return (
    <div className="tw:grid tw:gap-2.5 tw:text-entry">
      <div className={cn('tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-border tw:pb-2 tw:text-[13px] tw:font-extrabold', connected ? 'tw:text-success' : 'tw:text-destructive')}>
        {connected ? <CheckCircle2 className="tw:size-4" /> : <WifiOff className="tw:size-4" />}
        {connected ? 'Descartes SFTP Connected' : 'Descartes SFTP Offline'}
      </div>

      {status?.host && (
        <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-muted-foreground">
          <Server className="tw:size-3" />
          <span className="tw:font-mono tw:text-[11px]">{status.host}:22</span>
          <Badge variant="info">{environment}</Badge>
        </div>
      )}

      <div className="tw:grid tw:gap-1 tw:text-muted-foreground">
        {lastOk && (
          <span className="tw:flex tw:items-center tw:gap-1.5">
            <Clock className="tw:size-3 tw:text-success" /> Last connected: <strong className="tw:text-success">{lastOk}</strong>
          </span>
        )}
        {lastCheck && <span className="tw:flex tw:items-center tw:gap-1.5"><Clock className="tw:size-3" /> Last checked: {lastCheck}</span>}
        {!lastOk && !connected && (
          <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-destructive"><AlertCircle className="tw:size-3" /> Never connected this session</span>
        )}
      </div>

      {status?.lastError && !connected && (
        <p className="tw:m-0 tw:rounded-md tw:bg-destructive/10 tw:p-2 tw:text-[11px] tw:leading-normal tw:text-destructive">
          <AlertCircle className="tw:mr-1 tw:inline tw:size-3" />
          {status.lastError}
        </p>
      )}

      {!connected && (
        <p className="tw:m-0 tw:text-[10px] tw:leading-normal tw:text-muted-foreground">
          💡 FSU polls every 5 min. Descartes may temporarily block repeated connections. Badge auto-updates.
        </p>
      )}

      <div className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-border tw:pt-2">
        <span className="tw:text-[10px] tw:text-muted-foreground">Refreshes in <strong>{countdown}s</strong></span>
        <Button size="sm" disabled={checking} onClick={onCheckNow}>
          <RefreshCw className={cn('tw:size-3', checking && 'tw:animate-spin')} />
          {checking ? 'Checking…' : 'Check Now'}
        </Button>
      </div>
    </div>
  );
}

// Live Descartes SFTP connection pill: green (pulsing) = connected, red = offline, grey = checking.
export default function SftpStatusBadge({ showLabel = true }) {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(POLL_SECONDS);

  const fetchStatus = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    try {
      setStatus(await sharedWidgetsApi.sftpStatus());
      setCountdown(POLL_SECONDS);
    } catch {
      setStatus({ connected: false, lastError: 'Cannot reach backend' });
    } finally {
      if (manual) setChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const poll = setInterval(() => fetchStatus(), POLL_SECONDS * 1000);
    return () => clearInterval(poll);
  }, [fetchStatus]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown((seconds) => (seconds > 0 ? seconds - 1 : POLL_SECONDS)), 1000);
    return () => clearInterval(tick);
  }, []);

  const connected = status?.connected;
  const isChecking = checking || !status;
  const state = STATES[isChecking ? 'checking' : connected ? 'connected' : 'offline'];
  const labelText = isChecking ? 'Checking…' : connected ? `Descartes ${(status?.env || 'test').toUpperCase()}` : 'Descartes Offline';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          title="Click for Descartes SFTP details"
          className={cn('tw:h-auto tw:gap-2 tw:rounded-full tw:border-[1.5px] tw:px-3 tw:py-1 tw:transition-all', state.pill)}
        >
          <span className="tw:relative tw:inline-flex tw:size-2.5">
            {connected && !isChecking && <span className={cn('tw:absolute tw:inset-0 tw:animate-ping tw:rounded-full tw:opacity-45', state.dot)} />}
            {isChecking
              ? <RefreshCw className={cn('tw:size-2.5 tw:animate-spin', state.text)} />
              : <span className={cn('tw:block tw:size-2.5 tw:rounded-full', state.dot)} />}
          </span>
          {showLabel && <span className={cn('tw:text-[11px] tw:font-bold tw:tracking-wide tw:whitespace-nowrap', state.text)}>{labelText}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="tw:w-auto tw:min-w-[260px] tw:normal-case">
        <StatusDetails status={status} connected={connected} checking={checking} countdown={countdown} onCheckNow={() => fetchStatus(true)} />
      </PopoverContent>
    </Popover>
  );
}
