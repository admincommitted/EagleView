import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import useWhatsappSettingsTab from './WhatsappSettingsTabParts/useWhatsappSettingsTab';
import { ChoiceButton } from './WhatsappSettingsTabParts/ChoiceButton';
import { CONNECTION_MODES } from './WhatsappSettingsTabParts/whatsappOptions';
import QrConnectionSection from './WhatsappSettingsTabParts/sections/QrConnectionSection';
import ApiConnectionSection from './WhatsappSettingsTabParts/sections/ApiConnectionSection';
import NotificationModeSection from './WhatsappSettingsTabParts/sections/NotificationModeSection';
import AutoSentMessagesSection from './WhatsappSettingsTabParts/sections/AutoSentMessagesSection';
import StatusTemplateSection from './WhatsappSettingsTabParts/sections/StatusTemplateSection';
import ModuleNumbersSection from './WhatsappSettingsTabParts/sections/ModuleNumbersSection';
import SaveAllBar from './WhatsappSettingsTabParts/sections/SaveAllBar';

const SHARED_SECTIONS = [NotificationModeSection, AutoSentMessagesSection, StatusTemplateSection, ModuleNumbersSection, SaveAllBar];

function ConnectionModeSwitch({ activeMode, onSwitch }) {
  return (
    <div className="tw:grid tw:grid-cols-2 tw:gap-1 tw:rounded-lg tw:bg-muted tw:p-1">
      {CONNECTION_MODES.map((mode) => {
        const selected = activeMode === mode.id;
        return (
          <ChoiceButton key={mode.id} selected={selected} onClick={() => onSwitch(mode.id)}
            className={cn('tw:flex-col tw:items-center tw:gap-0.5 tw:border-0 tw:text-center', selected ? 'tw:bg-background tw:shadow-sm' : 'tw:bg-transparent')}>
            <span className={cn('tw:text-[13px]', selected ? 'tw:font-bold tw:text-foreground' : 'tw:font-medium tw:text-muted-foreground')}>{mode.label}</span>
            <span className="tw:text-[11px] tw:text-muted-foreground">{mode.desc}</span>
          </ChoiceButton>
        );
      })}
    </div>
  );
}

export default function WhatsappSettingsTab() {
  const ctx = useWhatsappSettingsTab();
  return (
    <div className="tw:flex tw:w-full tw:flex-col tw:gap-4">
      <div className="tw:flex tw:items-center tw:gap-2.5">
        <span className="tw:flex tw:size-[38px] tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-success">
          <MessageCircle className="tw:size-5.5 tw:text-white" />
        </span>
        <div>
          <h3 className="tw:m-0 tw:text-base tw:font-bold tw:text-foreground">WhatsApp Notifications</h3>
          <p className="tw:m-0 tw:text-[12px] tw:text-muted-foreground">QR Scan or API — Instant or Scheduled</p>
        </div>
      </div>

      <ConnectionModeSwitch activeMode={ctx.activeMode} onSwitch={ctx.handleModeSwitch} />

      {ctx.activeMode === 'qr' && <QrConnectionSection ctx={ctx} />}
      {ctx.activeMode === 'api' && <ApiConnectionSection ctx={ctx} />}

      {SHARED_SECTIONS.map((SectionComponent, position) => <SectionComponent key={position} ctx={ctx} />)}
    </div>
  );
}
