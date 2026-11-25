import { useState } from 'react';
import { Button, Field, Input, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import DetailCard from './DetailCard';

const profileOption = (profile) => ({
  value: String(profile.id),
  label: profile.loginId + (profile.profileName && profile.profileName !== profile.loginId ? ' - ' + profile.profileName : ''),
});

const localTime = (value) => new Date(value).toLocaleString('en-GB');

function FileBox({ title, className, children }) {
  return (
    <div className={cn('tw:flex tw:flex-col tw:gap-1.5 tw:rounded-md tw:border tw:border-border tw:bg-card tw:p-2', className)}>
      <b>{title}</b>
      {children}
    </div>
  );
}

export default function FileCard({ amendment, form, profiles, open, canSend, busy, dirty, setField, actions }) {
  const [pin, setPin] = useState('');
  const working = Boolean(busy);
  const sign = async () => { if (await actions.sign(pin)) setPin(''); };

  return (
    <DetailCard title="File for ICEGATE">
      <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-2">
        <Field layout="col" label="ICEGATE ID" className="tw:w-full tw:sm:w-auto tw:sm:min-w-[180px]">
          <SelectBox
            disabled={!open}
            value={form.icegateProfileId}
            onValueChange={(value) => setField('icegateProfileId', value)}
            options={profiles.map(profileOption)}
            placeholder={profiles.length ? 'Select...' : 'No ICEGATE user set up'}
          />
        </Field>
        {open && <Button disabled={working || !dirty} onClick={actions.save}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>}
        {open && (
          <Button variant="default" disabled={working} onClick={actions.makeFile}>
            {busy === 'file' ? 'Making…' : amendment.hasFile ? 'Make file again' : 'Make file'}
          </Button>
        )}
      </div>

      {amendment.hasFile && (
        <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-2.5 tw:py-2">
          <div>
            <b>{amendment.fileName}</b> · made {amendment.fileMadeAt ? localTime(amendment.fileMadeAt) : ''} by {amendment.fileMadeBy || ''} · codes {(amendment.fileCodes || []).join(', ')}
            {amendment.hasSigned && (
              <span className="tw:text-success"> · signed {localTime(amendment.signedAt)}{amendment.signer ? ' (' + amendment.signer + ')' : ''}</span>
            )}
          </div>
          <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:md:grid-cols-3">
            <FileBox title="Unsigned">
              <div className="tw:flex tw:flex-wrap tw:gap-1.5">
                <Button disabled={working} onClick={() => actions.download('unsigned')}>Download {amendment.fileName}</Button>
                {canSend && <Button disabled={working} onClick={() => actions.markSubmitted('DOWNLOAD_UNSIGNED')}>Uploaded on ICEGATE</Button>}
              </div>
            </FileBox>
            <FileBox title="Signed (DSC)">
              {canSend && (
                <div className="tw:flex tw:gap-1.5">
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder="Token PIN"
                    className="tw:w-[110px]"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') sign(); }}
                  />
                  <Button variant="default" disabled={working} onClick={sign}>
                    {busy === 'sign' ? 'Signing…' : amendment.hasSigned ? 'Sign again' : 'Sign'}
                  </Button>
                </div>
              )}
              <div className="tw:flex tw:flex-wrap tw:gap-1.5">
                <Button disabled={working || !amendment.hasSigned} onClick={() => actions.download('signed')}>Download {amendment.fileName}.sig</Button>
                {canSend && amendment.hasSigned && <Button disabled={working} onClick={() => actions.markSubmitted('DOWNLOAD')}>Uploaded on ICEGATE</Button>}
              </div>
            </FileBox>
            <FileBox title="Direct to ICEGATE" className="tw:border-primary/30 tw:bg-primary/5">
              <span className="tw:text-muted-foreground">Mails the signed file to the ICEGATE address in Settings.</span>
              <Button variant="default" className="tw:self-start" disabled={working || !canSend || !amendment.hasSigned} onClick={actions.send}>
                {busy === 'send' ? 'Sending…' : 'Send to ICEGATE'}
              </Button>
            </FileBox>
          </div>
        </div>
      )}
      {!amendment.hasFile && amendment.fileMadeAt && <span className="tw:text-warning">Details changed after the file was made - make the file again.</span>}
    </DetailCard>
  );
}
