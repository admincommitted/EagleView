import { Key, Settings } from 'lucide-react';
import { Button, Checkbox, Field, Input, NumberInput, Section } from '@/components/ui';

export default function SecuritySection({ ctx }) {
  const { formData, setField, password, setPassword, confirmPassword, setConfirmPassword, handlePasswordReset } = ctx;
  return (
    <Section title={<span className="tw:flex tw:items-center tw:gap-1.5"><Settings className="tw:size-3.5" /> Security Settings</span>}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-3">
        <div className="tw:flex tw:flex-col tw:gap-2">
          <h4 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-entry tw:font-semibold tw:text-head">
            <Key className="tw:size-3.5 tw:text-primary" /> Reset Password
          </h4>
          <Input type="password" data-allow-text="" placeholder="New Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Input type="password" data-allow-text="" placeholder="Confirm Password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <Button variant="default" className="tw:self-start" onClick={handlePasswordReset}>Update Password Only</Button>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-3">
          <Field label="Session Timeout (Minutes)" layout="col">
            <NumberInput value={formData.sessionTimeout} onValueChange={(value) => setField('sessionTimeout', value)} />
          </Field>
          <label className="tw:m-0 tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-sm tw:border tw:border-input tw:bg-background tw:px-2 tw:py-1.5">
            <Checkbox checked={Boolean(formData.allowStatusUpdates)} onCheckedChange={(checked) => setField('allowStatusUpdates', checked === true)} />
            <span className="tw:text-[11px] tw:font-semibold">Allow Status Updates Notifications</span>
          </label>
        </div>
      </div>
    </Section>
  );
}
