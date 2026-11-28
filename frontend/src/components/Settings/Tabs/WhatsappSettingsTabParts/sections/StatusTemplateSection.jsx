import { CheckCircle, Loader2, MessageCircle, Users } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ChoiceButton } from '../ChoiceButton';
import { SAMPLE_TEMPLATES, TEMPLATE_VARIABLES, previewHtml } from '../whatsappOptions';

const SUB_HEADING = 'tw:text-[11px] tw:font-bold tw:text-muted-foreground tw:uppercase';

function SampleTemplates({ template, setTemplate }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      <div className={SUB_HEADING}>📋 Sample Templates — Click to Apply</div>
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2">
        {SAMPLE_TEMPLATES.map((sample) => {
          const selected = template === sample.template;
          return (
            <ChoiceButton key={sample.label} selected={selected} onClick={() => setTemplate(sample.template)} className="tw:flex-col tw:items-start tw:gap-0.5">
              <span className={cn('tw:font-bold', selected ? 'tw:text-primary' : 'tw:text-foreground')}>{sample.label}</span>
              <span className="tw:text-[11px] tw:text-muted-foreground">{sample.preview}</span>
            </ChoiceButton>
          );
        })}
      </div>
    </div>
  );
}

function WhatsappPreview({ template }) {
  const sentAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return (
    <div className="tw:flex tw:min-h-[220px] tw:flex-col tw:gap-2 tw:rounded-lg tw:bg-stone-300 tw:p-3">
      <div className="tw:flex tw:items-end tw:gap-1.5">
        <span className="tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-success">
          <MessageCircle className="tw:size-3.5 tw:text-white" />
        </span>
        <div className="tw:max-w-[85%] tw:rounded-r-lg tw:rounded-bl-lg tw:bg-white tw:px-3.5 tw:py-2.5">
          <div className="tw:text-[13px] tw:leading-relaxed tw:break-words tw:whitespace-pre-wrap tw:text-neutral-900" dangerouslySetInnerHTML={{ __html: previewHtml(template) }} />
          <div className="tw:mt-1 tw:text-right tw:text-[10px] tw:text-slate-400">{sentAt}</div>
        </div>
      </div>
      <div className="tw:text-center">
        <span className="tw:rounded-full tw:bg-white/60 tw:px-2.5 tw:py-0.5 tw:text-[10px] tw:text-neutral-600">
          📋 Sample preview — actual values replace {TEMPLATE_VARIABLES.join(' ')}
        </span>
      </div>
    </div>
  );
}

export default function StatusTemplateSection({ ctx }) {
  const { handleSaveTemplate, savingTemplate, setTemplate, template } = ctx;
  return (
    <Card>
      <CardHeader className="tw:flex-col tw:items-start tw:gap-1">
        <CardTitle icon={<Users />}>Client Status Message Template</CardTitle>
        <CardDescription className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5">
          Variables:
          {TEMPLATE_VARIABLES.map((variable) => <Badge key={variable} variant="info" className="tw:rounded-sm tw:font-mono">{variable}</Badge>)}
        </CardDescription>
      </CardHeader>
      <CardContent className="tw:gap-3.5">
        <SampleTemplates template={template} setTemplate={setTemplate} />

        <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-4 tw:md:grid-cols-2">
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <div className={SUB_HEADING}>✏️ Edit Template</div>
            <Textarea value={template} onChange={(event) => setTemplate(event.target.value)} rows={10} className="tw:font-mono tw:leading-relaxed" />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <div className={SUB_HEADING}>💬 WhatsApp Preview</div>
            <WhatsappPreview template={template} />
          </div>
        </div>

        <Button variant="default" className="tw:self-start" onClick={handleSaveTemplate} disabled={savingTemplate}>
          {savingTemplate ? <Loader2 className="tw:animate-spin" /> : <CheckCircle />}
          {savingTemplate ? 'Saving...' : 'Save Template'}
        </Button>
      </CardContent>
    </Card>
  );
}
