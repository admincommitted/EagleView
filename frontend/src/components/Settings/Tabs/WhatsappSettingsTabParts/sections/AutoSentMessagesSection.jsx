import { Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { autoSentMessages } from '../whatsappOptions';

export default function AutoSentMessagesSection({ ctx }) {
  const { notifyMode, notifyTime } = ctx;
  return (
    <Card>
      <CardHeader><CardTitle icon={<Zap className="tw:text-warning" />}>What Gets Sent Automatically</CardTitle></CardHeader>
      <CardContent>
        {autoSentMessages(notifyMode, notifyTime).map((message) => (
          <div key={message.label} className="tw:flex tw:items-start tw:gap-2.5 tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-3 tw:py-2">
            <span className="tw:text-base">{message.icon}</span>
            <div className="tw:flex-1">
              <div className="tw:font-semibold tw:text-foreground">{message.label}</div>
              <div className="tw:mt-0.5 tw:text-[11px] tw:text-muted-foreground">{message.desc}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
