import { useState } from 'react';
import { Bell, Globe, Moon, Palette, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Modal, SelectBox, Switch } from '@/components/ui';
import { useTheme } from '../../ThemeContext';

const ACCENTS = [
  { id: 'blue', swatch: 'tw:bg-(--primary-color-start) tw:hover:bg-(--primary-color-start)' },
  { id: 'green', swatch: 'tw:bg-green-500 tw:hover:bg-green-500' },
  { id: 'purple', swatch: 'tw:bg-violet-500 tw:hover:bg-violet-500' },
  { id: 'red', swatch: 'tw:bg-red-500 tw:hover:bg-red-500' },
  { id: 'orange', swatch: 'tw:bg-amber-500 tw:hover:bg-amber-500' },
];
const THEME_OPTIONS = [{ value: 'light', label: 'LIGHT MODE' }, { value: 'dark', label: 'DARK MODE' }];
const LANGUAGE_OPTIONS = [{ value: 'en', label: 'ENGLISH (US)' }, { value: 'hi', label: 'HINDI (IN)' }];

function PreferenceRow({ icon: Icon, title, subtitle, last, children }) {
  return (
    <div className={cn('tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between', !last && 'tw:border-b tw:border-border tw:pb-4')}>
      <div className="tw:flex tw:items-center tw:gap-4">
        <div className="tw:rounded-xl tw:border tw:border-border tw:p-3 tw:text-foreground"><Icon className="tw:size-5" /></div>
        <div>
          <h4 className="tw:m-0 tw:text-sm tw:font-extrabold tw:uppercase tw:text-foreground">{title}</h4>
          <p className="tw:mt-1 tw:mb-0 tw:text-[11px] tw:uppercase tw:text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ThemePreferences({ onClose }) {
  const { themeMode, setThemeMode, accentColor, setAccentColor } = useTheme();
  const [localTheme, setLocalTheme] = useState(themeMode);
  const [localAccent, setLocalAccent] = useState(accentColor);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('en');

  const handleSave = () => {
    setThemeMode(localTheme);
    setAccentColor(localAccent);
    onClose?.();
  };

  const handleReset = () => {
    setLocalTheme('light');
    setLocalAccent('blue');
    setNotifications(true);
    setLanguage('en');
  };

  const footer = (
    <div className="tw:flex tw:w-full tw:flex-wrap tw:justify-between tw:gap-3">
      <Button variant="ghost" size="lg" className="tw:border-dashed tw:border-border tw:font-bold tw:text-muted-foreground" onClick={handleReset}>
        <RotateCcw className="tw:size-4" /> RESET DEFAULTS
      </Button>
      <div className="tw:flex tw:gap-3">
        <Button size="lg" className="tw:px-6 tw:font-bold" onClick={onClose}>CANCEL</Button>
        <Button size="lg" className="tw:border-amber-500 tw:bg-amber-500 tw:px-6 tw:font-bold tw:text-white tw:hover:bg-amber-600" onClick={handleSave}>
          <Save className="tw:size-4" /> SAVE CHANGES
        </Button>
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} title="APP SETTINGS" description="CUSTOMIZE YOUR WORKSPACE" width={450} footer={footer}>
      <div className="tw:flex tw:flex-col tw:gap-5 tw:p-2">
        <PreferenceRow icon={Moon} title="Theme Preference" subtitle="Choose light or dark mode">
          <SelectBox className="tw:w-full tw:font-semibold tw:sm:w-[130px]" options={THEME_OPTIONS} value={localTheme} onValueChange={setLocalTheme} />
        </PreferenceRow>

        <PreferenceRow icon={Bell} title="Push Notifications" subtitle="Enable alerts for job updates">
          <Switch className="tw:data-[state=checked]:bg-amber-500" checked={notifications} onCheckedChange={setNotifications} />
        </PreferenceRow>

        <PreferenceRow icon={Palette} title="Theme Color" subtitle="Accent color of the app">
          <div className="tw:flex tw:gap-2">
            {ACCENTS.map((accent) => (
              <Button
                key={accent.id}
                size="icon"
                title={accent.id}
                className={cn(
                  'tw:rounded-full tw:border-2',
                  accent.swatch,
                  localAccent === accent.id ? 'tw:border-foreground' : 'tw:border-transparent'
                )}
                onClick={() => setLocalAccent(accent.id)}
              />
            ))}
          </div>
        </PreferenceRow>

        <PreferenceRow icon={Globe} title="Language" subtitle="Interface Language" last>
          <SelectBox className="tw:w-full tw:font-semibold tw:sm:w-[130px]" options={LANGUAGE_OPTIONS} value={language} onValueChange={setLanguage} />
        </PreferenceRow>
      </div>
    </Modal>
  );
}
