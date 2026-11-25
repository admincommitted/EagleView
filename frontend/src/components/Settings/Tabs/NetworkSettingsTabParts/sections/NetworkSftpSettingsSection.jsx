import { Globe, Network, Save, Server, ToggleRight, Wifi, X } from 'lucide-react';
import { Badge, Button, Field, Input, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { CHARGE_CODES, NETWORK_PRESETS } from '../helpers';
import StepCard from './StepCard';
import SftpCredentialsSection from './SftpCredentialsSection';

const MESSAGE_TONES = {
  success: 'tw:border-success/40 tw:bg-success/10 tw:text-success',
  error: 'tw:border-destructive/40 tw:bg-destructive/10 tw:text-destructive',
  info: 'tw:border-primary/30 tw:bg-primary/10 tw:text-head',
};

const ENVIRONMENTS = [
  { id: 'test', label: '🧪 TEST', hostKey: 'sftp_test_host', note: 'Pre-production — for testing before go-live',
    selected: 'tw:border-primary tw:bg-primary/10', accent: 'tw:text-primary', dot: 'tw:bg-primary', badge: 'info' },
  { id: 'production', label: '🚀 PRODUCTION', hostKey: 'sftp_prod_host', note: 'Live server — for actual AWB transmission',
    selected: 'tw:border-success tw:bg-success/10', accent: 'tw:text-success', dot: 'tw:bg-success', badge: 'success' },
];

function MessageBanner({ message, onDismiss }) {
  if (!message.text) return null;
  return (
    <div className={cn('tw:flex tw:items-start tw:justify-between tw:gap-2 tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-entry tw:font-semibold', MESSAGE_TONES[message.type] || MESSAGE_TONES.info)}>
      <span>{message.text}</span>
      <Button variant="ghost" size="icon-sm" title="Dismiss" className="tw:text-current tw:opacity-60" onClick={onDismiss}><X /></Button>
    </div>
  );
}

function PresetCard({ preset, selected, onSelect }) {
  return (
    <Button size="block" onClick={() => onSelect(preset)} style={{ '--preset-color': preset.color }}
      className={cn('tw:flex-col tw:items-stretch tw:gap-0.5 tw:border-2 tw:px-4 tw:py-3', selected && 'tw:border-(--preset-color) tw:bg-(--preset-color)/7')}>
      <span className="tw:flex tw:items-center tw:gap-2">
        <span className={cn('tw:size-2.5 tw:shrink-0 tw:rounded-full', selected ? 'tw:bg-(--preset-color)' : 'tw:bg-input')} />
        <span className={cn('tw:font-bold', selected ? 'tw:text-(--preset-color)' : 'tw:text-foreground')}>{preset.name}</span>
      </span>
      <span className="tw:ml-[18px] tw:font-mono tw:text-[9px] tw:break-all tw:text-muted-foreground">TEST: {preset.test || '—'} | PROD: {preset.prod || '—'}</span>
      <span className="tw:ml-[18px] tw:text-[10px] tw:text-muted-foreground">{preset.info}</span>
    </Button>
  );
}

function EnvironmentCard({ environment, active, host, port, onSelect }) {
  return (
    <Button size="block" onClick={() => onSelect(environment.id)}
      className={cn('tw:flex-col tw:items-stretch tw:gap-0.5 tw:border-2 tw:px-5 tw:py-4', active && environment.selected)}>
      <span className="tw:flex tw:items-center tw:gap-2">
        <span className={cn('tw:size-3 tw:shrink-0 tw:rounded-full', active ? environment.dot : 'tw:bg-border')} />
        <span className={cn('tw:font-bold', active ? environment.accent : 'tw:text-muted-foreground')}>{environment.label}</span>
        {active && <Badge variant={environment.badge} className="tw:ml-auto">ACTIVE</Badge>}
      </span>
      <span className="tw:ml-5 tw:font-mono tw:text-[11px] tw:break-all tw:text-muted-foreground">{host}:{port}</span>
      <span className="tw:ml-5 tw:text-[10px] tw:text-muted-foreground">{environment.note}</span>
    </Button>
  );
}

export default function NetworkSftpSettingsSection({ ctx }) {
  const { activeEnv, dismissMessage, form, handleChange, handleEnvSwitch, handleNetworkSelect, handleSave, handleTestSftp, message, saving, selectedNetwork, setField, testing } = ctx;
  return (
    <>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
        <div className="tw:flex tw:items-center tw:gap-2.5">
          <Network className="tw:size-5.5 tw:shrink-0 tw:text-primary" />
          <div>
            <h3 className="tw:m-0 tw:text-[15px] tw:font-bold tw:text-foreground">Network / SFTP Settings</h3>
            <p className="tw:m-0 tw:mt-0.5 tw:text-[11px] tw:text-muted-foreground">SFTP connection config for XFWB / XFHL / XFZB / XFFM transmission</p>
          </div>
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button onClick={handleTestSftp} disabled={testing}>
            <Wifi /> {testing ? 'Testing...' : `Test ${activeEnv === 'test' ? 'TEST' : 'PROD'} SFTP`}
          </Button>
          <Button variant="default" onClick={handleSave} disabled={saving}>
            <Save /> {saving ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
      </div>

      <MessageBanner message={message} onDismiss={dismissMessage} />

      <StepCard icon={Globe} title="Step 1 — Select VAN / Carrier Network">
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
          {NETWORK_PRESETS.map((preset) => (
            <PresetCard key={preset.id} preset={preset} selected={selectedNetwork === preset.id} onSelect={handleNetworkSelect} />
          ))}
        </div>
      </StepCard>

      <StepCard icon={Server} title="Step 2 — VAN Recipient GLN ID + Defaults">
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-4 tw:lg:gap-6">
          <Field label="VAN Recipient ID (GLN)" required layout="col" note="Used in XFWB / XFHL / XFZB XML RecipientParty header">
            <Input name="van_recipient_id" data-allow-text value={form.van_recipient_id} onChange={handleChange} placeholder="e.g. TDVAIR01GLNDTCR" className="tw:font-mono tw:uppercase" />
          </Field>
          <Field label="Default AWB Currency" layout="col">
            <Input name="default_currency" data-allow-text value={form.default_currency} onChange={handleChange} placeholder="USD" maxLength={3} className="tw:uppercase" />
          </Field>
          <Field label="Default Charge Code" layout="col">
            <SelectBox name="default_charge_code" options={CHARGE_CODES} value={form.default_charge_code} onValueChange={setField('default_charge_code')} className="tw:w-full" />
          </Field>
        </div>
      </StepCard>

      <StepCard icon={ToggleRight} title="Step 3 — Active Environment" aside={<span className="tw:text-[10px] tw:text-muted-foreground">Select which server is currently in use</span>}>
        <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:md:grid-cols-2">
          {ENVIRONMENTS.map((environment) => (
            <EnvironmentCard key={environment.id} environment={environment} active={activeEnv === environment.id}
              host={form[environment.hostKey]} port={form.sftp_port} onSelect={handleEnvSwitch} />
          ))}
        </div>
        <p className="tw:m-0 tw:text-center tw:text-[10px] tw:text-muted-foreground">
          Click to select → then press <strong>Save All Settings</strong> — active environment will be stored in database
        </p>
      </StepCard>

      <SftpCredentialsSection ctx={ctx} />
    </>
  );
}
