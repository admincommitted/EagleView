import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Briefcase, CheckCircle, Key, Phone, Save, Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input, Modal } from '@/components/ui';
import { profileApi } from '@/services/profileApi';
import { useProfileStore } from '@/store/profileStore';

const EMPTY_PROFILE = {
  firstName: '', lastName: '', phone: '', companyName: '', jobTitle: '', address: '',
  reportingTo1: '', reportingTo2: '', limitMin: '', limitMax: '', password: '',
};

const PERSONAL_FIELDS = [
  { key: 'firstName', label: 'First Name', placeholder: 'e.g. Rahul' },
  { key: 'lastName', label: 'Last Name', placeholder: 'e.g. Sharma' },
  { key: 'phone', label: 'Phone', icon: Phone, placeholder: '+91 98765 43210' },
  { key: 'jobTitle', label: 'Job Title', icon: Briefcase, placeholder: 'e.g. Documentation Exec' },
];

const ROLE_FIELDS = [
  { key: 'reportingTo1', label: 'Reporting Manager 1' },
  { key: 'reportingTo2', label: 'Reporting Manager 2' },
  { key: 'limitMin', label: 'Approval Limit (Min)' },
  { key: 'limitMax', label: 'Approval Limit (Max)' },
];

const LABEL_CLASS = 'tw:text-[11px] tw:font-bold tw:uppercase';
const SAVED_MESSAGE_MS = 1500;

function ProfileSection({ icon: Icon, title, children }) {
  return (
    <div className="tw:rounded-lg tw:border tw:border-border tw:bg-card tw:px-4 tw:py-3">
      <h3 className="tw:m-0 tw:mb-2.5 tw:flex tw:items-center tw:gap-2 tw:text-entry tw:font-extrabold tw:tracking-wider tw:text-head tw:uppercase">
        <Icon className="tw:size-3.5" /> {title}
      </h3>
      {children}
    </div>
  );
}

function FieldLabel({ field }) {
  const Icon = field.icon;
  if (!Icon) return field.label;
  return <><Icon className="tw:size-3.5 tw:text-muted-foreground" /> {field.label}</>;
}

function FieldGrid({ fields, profile, onChange }) {
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-x-2.5 tw:gap-y-4 tw:sm:grid-cols-2">
      {fields.map((field) => (
        <Field key={field.key} label={<FieldLabel field={field} />} layout="col" labelClassName={LABEL_CLASS}>
          {onChange ? (
            <Input data-allow-text value={profile[field.key] || ''} placeholder={field.placeholder}
              onChange={(event) => onChange(field.key, event.target.value)} />
          ) : (
            <Input value={profile[field.key] || ''} readOnly className="tw:cursor-not-allowed tw:text-muted-foreground" />
          )}
        </Field>
      ))}
    </div>
  );
}

export default function MyProfileModal({ onClose }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const savedProfile = await profileApi.getProfile();
        if (savedProfile) setProfile({ ...savedProfile, password: '' });
      } catch (error) {
        console.error(error);
      }
    };
    loadProfile();
  }, []);

  const updateField = (key, value) => setProfile((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    try {
      await profileApi.saveProfile(profile);
      setIsSaved(true);
      useProfileStore.getState().loadProfile();
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, SAVED_MESSAGE_MS);
    } catch (error) {
      console.error(error);
      toast.error(error.response ? 'Failed to save profile' : 'Error saving profile');
    }
  };

  const footer = (
    <>
      <span
        className={cn(
          'tw:mr-auto tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:bg-success/10 tw:px-4 tw:py-1.5 tw:text-[13px] tw:font-bold tw:text-success tw:transition-opacity tw:pointer-events-none',
          isSaved ? 'tw:opacity-100' : 'tw:opacity-0'
        )}
      >
        <CheckCircle className="tw:size-4" /> Profile Saved!
      </span>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="default" onClick={handleSave}><Save /> SAVE CHANGES</Button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      width={750}
      closeOnOutside={false}
      title={<span className="tw:flex tw:items-center tw:gap-2 tw:font-bold"><User className="tw:size-5 tw:text-primary" /> MY PROFILE</span>}
      description="Manage your personal information"
      bodyClassName="tw:gap-3 tw:bg-page tw:p-3 tw:sm:p-6"
      footer={footer}
    >
      <ProfileSection icon={User} title="Personal Details">
        <FieldGrid fields={PERSONAL_FIELDS} profile={profile} onChange={updateField} />
      </ProfileSection>

      <ProfileSection icon={Shield} title="Organization Role (Read-Only)">
        <FieldGrid fields={ROLE_FIELDS} profile={profile} />
      </ProfileSection>

      <ProfileSection icon={Key} title="Security">
        <Field label="Change Password" layout="col" labelClassName={LABEL_CLASS}
          note="If changed, Admin can reset it from User Management.">
          <Input type="password" value={profile.password || ''} placeholder="Enter new password (leave blank to keep current)"
            onChange={(event) => updateField('password', event.target.value)} />
        </Field>
      </ProfileSection>
    </Modal>
  );
}
