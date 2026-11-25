import { CheckCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Switch } from '@/components/ui';

function RoleSwitch({ icon: Icon, label, title, on, onToggle }) {
  return (
    <label title={title} className={cn('tw:m-0 tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-sm tw:border tw:px-2.5 tw:py-1', on ? 'tw:border-primary tw:bg-primary/10' : 'tw:border-border tw:bg-page')}>
      <Icon className={cn('tw:size-4', on ? 'tw:text-primary' : 'tw:text-muted-foreground')} />
      <span className={cn('tw:text-[11px] tw:font-semibold', on ? 'tw:text-head' : 'tw:text-muted-foreground')}>{label}</span>
      <Switch checked={on} onCheckedChange={onToggle} />
    </label>
  );
}

export default function UserProfileHeader({ ctx }) {
  const { selectedUser, formData, handleAdminToggle, handleDirectorToggle } = ctx;
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-x-2.5 tw:gap-y-1.5 tw:border-b tw:border-border tw:bg-card tw:px-3 tw:py-1.5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
        <h2 className="tw:m-0 tw:text-sm tw:font-semibold tw:uppercase">User Profile Settings</h2>
        <p className="tw:m-0 tw:text-[11px] tw:text-muted-foreground">Manage account details and permissions.</p>
        {selectedUser && <Badge variant="success"><CheckCircle /> Created: {new Date(selectedUser.createdAt).toLocaleDateString('en-GB')}</Badge>}
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <RoleSwitch icon={ShieldCheck} label="Admin Privileges" on={formData.role === 'admin'} onToggle={handleAdminToggle} />
        <RoleSwitch icon={CheckCircle} label="Director (PO approval)" title="Approves, rejects or holds purchase orders after logging in"
          on={formData.role === 'director'} onToggle={handleDirectorToggle} />
      </div>
    </div>
  );
}
