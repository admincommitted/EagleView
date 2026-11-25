import { useEffect, useState } from 'react';
import { AlertCircle, Bell, CheckCircle, Globe, Loader2, Moon, Palette, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, Label, Modal, SelectBox } from '@/components/ui';
import { getToken } from '@/services/session';
import { profileApi } from '@/services/profileApi';
import { useThemeStore } from '@/store/themeStore';
import { askConfirm } from './askConfirm';
import { readTokenUser } from './tokenUser';

const BACKGROUND_OPTIONS = [
  { value: 'slate', label: 'CLASSIC SLATE' },
  { value: 'white', label: 'PURE WHITE' },
  { value: 'warm', label: 'WARM SAND' },
  { value: 'sky', label: 'SOFT SKY' },
  { value: 'mint', label: 'FRESH MINT' },
  { value: 'lavender', label: 'LAVENDER' },
  { value: 'peach', label: 'WARM PEACH' },
  { value: 'rose', label: 'SOFT ROSE' },
  { value: 'coolgrey', label: 'COOL GREY' },
  { value: 'ivory', label: 'IVORY' },
  { value: 'ice', label: 'ICE BLUE' },
  { value: 'seagreen', label: 'SEA GREEN' },
  { value: 'lemon', label: 'SOFT LEMON' },
];

// Picking a theme colour also switches the page background to the one that goes with it; colours without a
// background keep the current one.
const THEME_COLOURS = [
  { name: 'ocean', hex: '#008ac1', background: 'sky' },
  { name: 'blue', hex: '#0ea5e9', background: 'sky' },
  { name: 'emerald', hex: '#10b981', background: 'mint' },
  { name: 'forest', hex: '#15803d', background: 'mint' },
  { name: 'violet', hex: '#8b5cf6', background: 'lavender' },
  { name: 'plum', hex: '#701a75', background: 'lavender' },
  { name: 'rose', hex: '#f43f5e', background: 'rose' },
  { name: 'crimson', hex: '#be123c', background: 'rose' },
  { name: 'amber', hex: '#f59e0b', background: 'peach' },
  { name: 'pumpkin', hex: '#c2410c', background: 'peach' },
  { name: 'cyan', hex: '#06b6d4', background: 'sky' },
  { name: 'pink', hex: '#ec4899', background: 'rose' },
  { name: 'teal', hex: '#14b8a6', background: 'mint' },
  { name: 'indigo', hex: '#6366f1', background: 'sky' },
  { name: 'midnight', hex: '#1e3a8a', background: 'slate' },
  { name: 'gray', hex: '#64748b', background: 'slate' },
  { name: 'ruby', hex: '#e11d48', background: 'rose' },
  { name: 'lime', hex: '#84cc16', background: 'mint' },
  { name: 'sage', hex: '#5f7161', background: 'mint' },
  { name: 'coral', hex: '#ff7f50', background: 'peach' },
  { name: 'magenta', hex: '#d946ef', background: 'rose' },
  { name: 'slate', hex: '#475569', background: 'slate' },
  { name: 'navy', hex: '#0f172a', background: 'slate' },
  { name: 'sky', hex: '#38bdf8', background: 'sky' },
  { name: 'gold', hex: '#eab308', background: 'peach' },
  { name: 'fuchsia', hex: '#c026d3', background: 'lavender' },
  { name: 'tangerine', hex: '#f97316', background: 'peach' },
  { name: 'cerulean', hex: '#0284c7', background: 'sky' },
  { name: 'olive', hex: '#65a30d', background: 'mint' },
  { name: 'berry', hex: '#9f1239', background: 'rose' },
  { name: 'chocolate', hex: '#78350f', background: 'peach' },
  { name: 'lavender', hex: '#a855f7', background: 'lavender' },
  { name: 'deepteal', hex: '#08676d', background: 'mint' },
  { name: 'steel', hex: '#4a6fa5', background: 'coolgrey' },
  { name: 'royal', hex: '#2548c9', background: 'ice' },
  { name: 'petrol', hex: '#0b6477', background: 'seagreen' },
  { name: 'bottle', hex: '#1b6b4a', background: 'mint' },
  { name: 'maroon', hex: '#8a1c2c', background: 'rose' },
  { name: 'bronze', hex: '#9a6a2f', background: 'ivory' },
  { name: 'charcoal', hex: '#3a3f4b' },
];

const readUserRole = () => (getToken() === 'dummy-token' ? 'admin' : readTokenUser().role || null);

function SaveStatus({ status, errorText }) {
  if (errorText) return <><AlertCircle className="tw:size-3.5 tw:shrink-0" /> {errorText}</>;
  if (status === 'loading') return <><Loader2 className="tw:size-3.5 tw:shrink-0 tw:animate-spin" /> Loading your settings...</>;
  if (status === 'saving') return <><Loader2 className="tw:size-3.5 tw:shrink-0 tw:animate-spin" /> Saving...</>;
  if (status === 'saved') return <><CheckCircle className="tw:size-3.5 tw:shrink-0" /> Saved</>;
  return <span className="tw:font-normal tw:text-muted-foreground">Changes are saved as you make them</span>;
}

function SettingRow({ icon: Icon, title, description, className, titleClassName, alignTop, children }) {
  return (
    <div
      className={cn(
        'tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:py-1.5 tw:sm:flex-row tw:sm:gap-3',
        alignTop ? 'tw:sm:items-start' : 'tw:sm:items-center',
        className
      )}
    >
      <div className="tw:min-w-0 tw:flex-1">
        <div className={cn('tw:inline-flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-semibold tw:text-foreground', titleClassName)}>
          {Icon && <Icon className="tw:size-3.5" />} {title}
        </div>
        <div className={cn('tw:text-[11px] tw:text-muted-foreground', Icon && 'tw:ml-5')}>{description}</div>
      </div>
      <div className="tw:shrink-0">{children}</div>
    </div>
  );
}

function ColourSwatches({ selected, onPick }) {
  return (
    <div className="tw:grid tw:grid-cols-[repeat(10,18px)] tw:gap-[5px] tw:pt-0.5">
      {THEME_COLOURS.map((colour) => (
        <Button
          key={colour.name}
          variant="ghost"
          title={colour.name.toUpperCase()}
          aria-label={'Theme colour ' + colour.name}
          onClick={() => onPick(colour)}
          style={{ '--swatch': colour.hex }}
          className={cn(
            'tw:size-[18px] tw:min-h-0 tw:rounded-sm tw:border tw:border-black/20 tw:bg-(--swatch) tw:p-0 tw:hover:bg-(--swatch)',
            selected === colour.name && 'tw:outline-solid tw:outline-2 tw:outline-offset-2 tw:outline-foreground'
          )}
        />
      ))}
    </div>
  );
}

export default function SettingsModal({ onClose }) {
  const settings = useThemeStore((state) => state.settings);
  const status = useThemeStore((state) => state.status);
  const errorText = useThemeStore((state) => state.errorText);
  const { changeSettings, resetSettings, saveNow, loadFromServer } = useThemeStore.getState();
  const [userRole] = useState(readUserRole);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [backupError, setBackupError] = useState('');

  useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  const updateSetting = (key, value) => changeSettings({ [key]: value });

  const pickColour = (colour) => changeSettings({ primaryColor: colour.name, appBackground: colour.background || settings.appBackground });

  const handleClose = () => {
    saveNow();
    onClose();
  };

  const handleBackup = async () => {
    const confirmed = await askConfirm({
      title: 'Start system backup',
      message: 'Make a full backup of the code and the database now?',
      note: 'It can take a little time. Nothing is changed or deleted.',
      okLabel: 'Start backup',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    setIsBackingUp(true);
    setBackupError('');
    try {
      const result = await profileApi.startSystemBackup();
      setBackupNote((result.message || 'Backup completed') + ' - saved to ' + result.backupDir);
    } catch (error) {
      setBackupError(error.response ? 'Backup failed: ' + error.response.data?.error : 'Backup error: ' + error.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const languageOptions = [
    { value: 'en', label: 'ENGLISH (US)' },
    ...(settings.language === 'hi' ? [{ value: 'hi', label: 'HINDI (IN) - not available yet' }] : []),
    ...(settings.language === 'es' ? [{ value: 'es', label: 'SPANISH (ES) - not available yet' }] : []),
  ];

  const shownError = errorText || backupError;
  const footer = (
    <>
      <Button onClick={resetSettings} title="Back to the default colours, notifications and language" className="tw:text-muted-foreground">
        <RotateCcw /> Reset defaults
      </Button>
      <span className={cn('tw:inline-flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-1 tw:truncate tw:text-[11px] tw:font-semibold', shownError ? 'tw:text-destructive' : 'tw:text-success')}>
        <SaveStatus status={status} errorText={shownError} />
      </span>
      <Button variant="default" onClick={handleClose}>Done</Button>
    </>
  );

  return (
    <Modal
      open
      onClose={handleClose}
      width={520}
      closeOnOutside={false}
      title={<span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-semibold"><SettingsIcon className="tw:size-3.5" /> App settings</span>}
      description="Colours, notifications and language of the app"
      bodyClassName="tw:gap-0 tw:px-3.5 tw:pt-1.5 tw:pb-2.5"
      footer={footer}
    >
      <SettingRow icon={Moon} title="Background theme" description="Colour of the page behind the screens">
        <SelectBox options={BACKGROUND_OPTIONS} value={settings.appBackground || 'slate'}
          onValueChange={(value) => updateSetting('appBackground', value)} className="tw:w-full tw:sm:w-[160px]" />
      </SettingRow>

      <SettingRow
        icon={Palette}
        title="Theme colour"
        alignTop
        description={
          <>
            Colour of the menu bar, headings and buttons
            <div className="tw:mt-0.5 tw:font-semibold tw:text-foreground">Now: {String(settings.primaryColor || 'blue').toUpperCase()}</div>
          </>
        }
      >
        <ColourSwatches selected={settings.primaryColor} onPick={pickColour} />
      </SettingRow>

      <SettingRow icon={Bell} title="Push notifications" description="Pop-up alerts for new notifications">
        <Label className="tw:cursor-pointer">
          <Checkbox checked={Boolean(settings.notificationsEnabled)}
            onCheckedChange={(checked) => updateSetting('notificationsEnabled', checked === true)} />
          {settings.notificationsEnabled ? 'On' : 'Off'}
        </Label>
      </SettingRow>

      <SettingRow icon={Globe} title="Language" description="The screens are in English only for now">
        <SelectBox options={languageOptions} value={settings.language || 'en'}
          onValueChange={(value) => updateSetting('language', value)} className="tw:w-full tw:sm:w-[160px]" />
      </SettingRow>

      {userRole === 'admin' && (
        <SettingRow title="System backup (admin only)" titleClassName="tw:text-destructive" className="tw:border-b-0"
          description={backupNote || 'Makes a full backup of the code and the database'}>
          <Button variant="destructive" onClick={handleBackup} disabled={isBackingUp}>
            {isBackingUp ? 'Backing up...' : 'Start backup'}
          </Button>
        </SettingRow>
      )}
    </Modal>
  );
}
