import { CheckCircle, Key, Wifi, XCircle } from 'lucide-react';
import { Button, Field, Input, NumberInput, PasswordInput } from '@/components/ui';
import { cn } from '@/lib/utils';
import StepCard from './StepCard';
import SshKeyPanel from './SshKeyPanel';

const LOG_TONES = {
  success: 'tw:text-green-400',
  error: 'tw:text-red-400',
  done: 'tw:text-slate-400',
  running: 'tw:text-amber-400',
};

const HOST_FIELDS = [
  { name: 'sftp_test_host', label: '🧪 Test Server Host', env: 'test', activeClass: 'tw:border-primary tw:bg-primary/10' },
  { name: 'sftp_prod_host', label: '🚀 Production Server Host', env: 'production', activeClass: 'tw:border-success tw:bg-success/10' },
];

const statusTone = (isConfigured, hasKeyInDb) => {
  if (isConfigured) return 'tw:border-success/40 tw:bg-success/10 tw:text-success';
  if (hasKeyInDb) return 'tw:border-primary/30 tw:bg-primary/10 tw:text-head';
  return 'tw:border-warning/40 tw:bg-warning/10 tw:text-warning';
};

function ConfiguredBadge({ isConfigured }) {
  const Icon = isConfigured ? CheckCircle : XCircle;
  return (
    <span className={cn('tw:flex tw:items-center tw:gap-1 tw:text-[11px] tw:font-bold', isConfigured ? 'tw:text-success' : 'tw:text-warning')}>
      <Icon className="tw:size-3.5" /> {isConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'}
    </span>
  );
}

function ConnectionStatus({ activeEnv, activeHost, form, hasKeyInDb, isConfigured }) {
  const headline = isConfigured
    ? `✅ ${activeEnv.toUpperCase()} — Ready to transmit`
    : hasKeyInDb ? '🔑 SSH Key saved — waiting for username from Descartes' : '⚠️ Credentials not configured';
  return (
    <div className={cn('tw:rounded-md tw:border tw:px-4 tw:py-3', statusTone(isConfigured, hasKeyInDb))}>
      <div className="tw:mb-1 tw:text-[11px] tw:font-bold">{headline}</div>
      <div className="tw:flex tw:flex-wrap tw:gap-x-3.5 tw:gap-y-1 tw:text-entry tw:font-semibold">
        <span className={form.sftp_username ? 'tw:text-success' : 'tw:text-muted-foreground'}>
          {form.sftp_username ? `✅ ${form.sftp_username}` : '❌ Username — awaiting from Descartes'}
        </span>
        <span className={hasKeyInDb ? 'tw:text-success' : 'tw:text-muted-foreground'}>{hasKeyInDb ? '✅ SSH Key ✓' : '❌ No SSH Key'}</span>
        <span className="tw:font-mono tw:font-normal tw:break-all tw:text-muted-foreground">{activeHost}:{form.sftp_port}</span>
      </div>
    </div>
  );
}

function ConnectionLog({ testLog, testing }) {
  if (!testLog.length) return null;
  return (
    <div className="tw:rounded-lg tw:bg-slate-900 tw:px-3.5 tw:py-3 tw:font-mono tw:text-entry tw:leading-[1.8]">
      <div className="tw:mb-1.5 tw:font-sans tw:text-[11px] tw:font-semibold tw:text-slate-500">CONNECTION LOG</div>
      {testLog.map((log, index) => (
        <div key={index} className="tw:flex tw:items-start tw:gap-2">
          <span className="tw:shrink-0 tw:pt-px tw:text-[10px] tw:text-slate-600">{log.time}</span>
          <span className={cn('tw:break-all', LOG_TONES[log.status] || LOG_TONES.running)}>
            {log.status === 'running' && <span className="tw:animate-pulse">⟳ </span>}
            {log.text}
          </span>
        </div>
      ))}
      {testing && (
        <div className="tw:mt-1 tw:text-slate-600"><span className="tw:text-amber-400">⟳</span> Waiting for server response...</div>
      )}
    </div>
  );
}

export default function SftpCredentialsSection({ ctx }) {
  const { activeEnv, activeHost, form, handleChange, handleTestSftp, hasKeyInDb, isConfigured, setField, testLog, testing } = ctx;
  return (
    <StepCard icon={Key} title="Step 4 — SFTP Credentials" note="(Shared for both Test and Production)" aside={<ConfiguredBadge isConfigured={isConfigured} />}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[1fr_1fr_120px] tw:md:gap-5">
        {HOST_FIELDS.map((host) => (
          <Field key={host.name} label={host.label} layout="col">
            <Input name={host.name} data-allow-text value={form[host.name]} onChange={handleChange}
              className={cn('tw:font-mono', activeEnv === host.env && host.activeClass)} />
          </Field>
        ))}
        <Field label="Port" layout="col">
          <NumberInput name="sftp_port" decimals={0} value={form.sftp_port} onValueChange={setField('sftp_port')} className="tw:font-mono" />
        </Field>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2 tw:md:gap-5">
        <Field layout="col" labelClassName="tw:whitespace-normal" label={<>Username * <span className="tw:text-muted-foreground tw:normal-case">(provided by Descartes after key registration)</span></>}>
          <Input name="sftp_username" data-allow-text value={form.sftp_username} onChange={handleChange} placeholder="e.g. GLN_YOURCOMPANY" className="tw:font-mono" />
        </Field>
        <Field layout="col" labelClassName="tw:whitespace-normal" label={<>Password <span className="tw:text-muted-foreground tw:normal-case">(leave blank if using SSH key)</span></>}>
          <PasswordInput name="sftp_password" value={form.sftp_password} onChange={handleChange} placeholder="Leave blank to use SSH key" className="tw:font-mono" />
        </Field>
      </div>

      <SshKeyPanel ctx={ctx} />

      <ConnectionStatus activeEnv={activeEnv} activeHost={activeHost} form={form} hasKeyInDb={hasKeyInDb} isConfigured={isConfigured} />

      <div className="tw:flex tw:flex-col tw:gap-2.5">
        <Button variant="default" size="lg" className="tw:self-start" onClick={handleTestSftp} disabled={testing}>
          <Wifi /> {testing ? 'Testing Connection...' : `Test ${activeEnv.toUpperCase()} Connection`}
        </Button>
        <ConnectionLog testLog={testLog} testing={testing} />
      </div>
    </StepCard>
  );
}
