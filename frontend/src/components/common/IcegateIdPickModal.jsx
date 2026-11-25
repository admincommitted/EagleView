// "Which ICEGATE ID?" before a BE file is made (Download JSON, .be flat file, Preview JSON). The ID goes in the file as
// the sender (senderID / .be header) and as the e-Sanchit user ID of the documents that have no ID of their own, so it
// must be the same ID the Submit window sends with.
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Modal } from '@/components/ui';
import { sharedWidgetsApi } from './sharedWidgetsApi';

const STORAGE_KEY = 'ev.fileIcegateId';

export const rememberIcegateId = (id) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // browser storage is off
  }
};

const lastUsedIcegateId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

// the same pick everywhere: the ID used last in this browser, else the one linked to the job's CHA, else the default one
export function defaultIcegateId(profiles, chaCode) {
  const list = profiles || [];
  const lastId = lastUsedIcegateId();
  const profile = (lastId && list.find((item) => String(item.id) === lastId))
    || (chaCode && list.find((item) => item.linkedChaCode === chaCode))
    || list.find((item) => item.isDefault)
    || list[0];
  return profile ? String(profile.id) : '';
}

function ProfileChoice({ profile, chaCode, selected, onChoose }) {
  const tags = `${chaCode && profile.linkedChaCode === chaCode ? '  (job CHA)' : ''}${profile.isDefault ? '  (default)' : ''}`;
  return (
    <Button
      size="block"
      role="radio"
      aria-checked={selected}
      onClick={onChoose}
      className={cn('tw:items-center tw:gap-2 tw:text-[13px]', selected && 'tw:border-success tw:bg-success/10')}
    >
      <span className={cn('tw:size-3 tw:shrink-0 tw:rounded-full tw:border tw:border-input', selected && 'tw:border-4 tw:border-success')} />
      <span>
        <b>{profile.loginId}</b>
        {profile.profileName && profile.profileName !== profile.loginId ? ` - ${profile.profileName}` : ''}
        <span className="tw:text-[11px] tw:whitespace-pre tw:text-muted-foreground">{tags}</span>
      </span>
    </Button>
  );
}

export default function IcegateIdPickModal({ open, title, actionLabel, chaCode, onPick, onClose }) {
  const [profiles, setProfiles] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const loadProfiles = async () => {
      setError('');
      try {
        const answer = await sharedWidgetsApi.icegateProfiles();
        const list = (answer?.success && answer.data) || [];
        setProfiles(list);
        setSelectedId(defaultIcegateId(list, chaCode));
        if (!list.length) setError('No ICEGATE ID is set up - add one in Settings > ICEGATE');
      } catch {
        setProfiles([]);
        setError('Could not load the ICEGATE IDs');
      }
    };
    loadProfiles();
  }, [open, chaCode]);

  const pickSelected = () => {
    const profile = (profiles || []).find((item) => String(item.id) === selectedId);
    if (!profile) return;
    rememberIcegateId(profile.id);
    onPick(profile.id, profile.loginId);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || 'Choose ICEGATE ID'}
      width={420}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="default" onClick={pickSelected} disabled={!selectedId}>{actionLabel || 'Continue'}</Button>
        </>
      )}
    >
      <div role="radiogroup" aria-label="ICEGATE ID" className="tw:grid tw:gap-2">
        {profiles === null && <p className="tw:m-0 tw:text-muted-foreground">Loading ICEGATE IDs...</p>}
        {error && <p className="tw:m-0 tw:rounded-md tw:bg-destructive/10 tw:p-2 tw:text-destructive">{error}</p>}
        {(profiles || []).map((profile) => (
          <ProfileChoice
            key={profile.id}
            profile={profile}
            chaCode={chaCode}
            selected={String(profile.id) === selectedId}
            onChoose={() => setSelectedId(String(profile.id))}
          />
        ))}
        <p className="tw:m-0 tw:text-[11px] tw:text-muted-foreground">
          This ID goes in the file as the sender, and as the e-Sanchit user of the documents. Use the ID that uploaded the
          e-Sanchit documents and whose DSC signs the file.
        </p>
      </div>
    </Modal>
  );
}
