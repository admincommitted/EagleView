import { Loader2, MessageCircle, Save, Shield, TestTube2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Field, Input, Label, PasswordInput, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { PROVIDERS } from '../whatsappOptions';

const templateNameOnly = (text) => text.toLowerCase().replace(/[^a-z0-9_]/g, '');

function ApprovedTemplateBox({ apiSettings, setApi }) {
  const isMsg91 = apiSettings.whatsapp_provider === 'msg91';
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-lg tw:border tw:border-dashed tw:border-primary/40 tw:bg-primary/10 tw:p-3">
      <div className="tw:text-[11px] tw:font-bold tw:text-head">Approved WhatsApp template (needed to message a customer first)</div>
      <div className="tw:text-[11px] tw:text-head">
        WhatsApp delivers a plain text only if the customer messaged you in the last 24 hours. For status updates, create a template with 3 values and get it approved: {'{{1}}'} = party name, {'{{2}}'} = AWB / job / BE no, {'{{3}}'} = status. Leave the name empty to send plain text.
      </div>
      <div className={cn('tw:grid tw:grid-cols-1 tw:gap-2.5', isMsg91 ? 'tw:md:grid-cols-[2fr_1fr_2fr]' : 'tw:md:grid-cols-[2fr_1fr]')}>
        <Field label="Template name" layout="col">
          <Input data-allow-text value={apiSettings.whatsapp_template_name} onChange={(event) => setApi('whatsapp_template_name')(templateNameOnly(event.target.value))} placeholder="shipment_status" />
        </Field>
        <Field label="Language" layout="col">
          <Input data-allow-text value={apiSettings.whatsapp_template_lang} onChange={(event) => setApi('whatsapp_template_lang')(event.target.value.trim())} placeholder="en" />
        </Field>
        {isMsg91 && (
          <Field label="Namespace (from MSG91)" layout="col">
            <Input data-allow-text value={apiSettings.whatsapp_template_namespace} onChange={(event) => setApi('whatsapp_template_namespace')(event.target.value.trim())} placeholder="optional" />
          </Field>
        )}
      </div>
    </div>
  );
}

function ApiConfiguration({ ctx }) {
  const { apiSettings, handleSaveApi, savingApi, setApi } = ctx;
  const provider = apiSettings.whatsapp_provider;
  return (
    <Card>
      <CardHeader><CardTitle icon={<Shield />}>API Configuration</CardTitle></CardHeader>
      <CardContent className="tw:gap-3.5">
        <Field label="API Provider" layout="col" note={PROVIDERS.find((option) => option.value === provider)?.desc}>
          <SelectBox options={PROVIDERS} value={provider} onValueChange={setApi('whatsapp_provider')} className="tw:w-full" />
        </Field>
        <Field label="API Key" layout="col">
          <PasswordInput value={apiSettings.whatsapp_api_key} onChange={(event) => setApi('whatsapp_api_key')(event.target.value)} placeholder="Enter API key..." />
        </Field>
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
          {provider === '2factor' ? (
            <Field label="Sender ID" layout="col">
              <Input data-allow-text value={apiSettings.whatsapp_sender_id} onChange={(event) => setApi('whatsapp_sender_id')(event.target.value.toUpperCase())} placeholder="EAGLEV" maxLength={6} />
            </Field>
          ) : (
            <Field label={provider === 'meta' ? 'Phone Number ID' : 'From Number'} layout="col">
              <Input data-allow-text value={apiSettings.whatsapp_from_number} onChange={(event) => setApi('whatsapp_from_number')(event.target.value.trim())} placeholder={provider === 'meta' ? 'e.g. 106540352242922' : '+91XXXXXXXXXX'} />
            </Field>
          )}
          {provider === 'meta' && (
            <Field label="Graph API version" layout="col">
              <Input data-allow-text value={apiSettings.whatsapp_api_version} onChange={(event) => setApi('whatsapp_api_version')(event.target.value.trim())} placeholder="v21.0" />
            </Field>
          )}
          <div className="tw:flex tw:items-center tw:gap-2 tw:md:self-end">
            <Checkbox id="whatsapp-enabled" checked={String(apiSettings.whatsapp_enabled) !== 'false'} onCheckedChange={(checked) => setApi('whatsapp_enabled')(checked ? 'true' : 'false')} />
            <Label htmlFor="whatsapp-enabled" className="tw:font-semibold">Sending switched on</Label>
          </div>
        </div>
        {(provider === 'msg91' || provider === 'meta') && <ApprovedTemplateBox apiSettings={apiSettings} setApi={setApi} />}
        <Button variant="default" className="tw:self-start" onClick={handleSaveApi} disabled={savingApi}>
          {savingApi ? <Loader2 className="tw:animate-spin" /> : <Save />}{savingApi ? 'Saving...' : 'Save API Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ApiTestMessage({ ctx }) {
  const { apiTestNumber, handleApiTest, setApiTestNumber, testingApi } = ctx;
  return (
    <Card className="tw:border-warning/30 tw:bg-warning/5">
      <CardHeader><CardTitle icon={<TestTube2 />} className="tw:text-warning">Test API Message</CardTitle></CardHeader>
      <CardContent className="tw:flex-col tw:sm:flex-row">
        <Input value={apiTestNumber} onChange={(event) => setApiTestNumber(event.target.value)} placeholder="Mobile number (e.g. 9876543210)" className="tw:flex-1" />
        <Button variant="success" onClick={handleApiTest} disabled={testingApi}>
          {testingApi ? <Loader2 className="tw:animate-spin" /> : <MessageCircle />}{testingApi ? 'Testing...' : 'Send Test'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ApiConnectionSection({ ctx }) {
  return (
    <>
      <ApiConfiguration ctx={ctx} />
      <ApiTestMessage ctx={ctx} />
    </>
  );
}
