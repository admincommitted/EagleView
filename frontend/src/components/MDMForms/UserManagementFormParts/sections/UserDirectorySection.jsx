import { Search, Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, Input } from '@/components/ui';
import { roleLabel, statusOf } from '../userFormData';

const STATUS_DOT = { active: 'tw:bg-success', locked: 'tw:bg-warning' };

function UserRow({ user, selected, onPick }) {
  const status = statusOf(user);
  return (
    <Button variant="ghost" size="block" onClick={onPick}
      className={cn('tw:gap-2.5 tw:rounded tw:border tw:border-transparent tw:border-l-[3px] tw:px-2 tw:py-1.5', selected && 'tw:border-primary tw:bg-primary/10')}>
      <span className={cn('tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded tw:text-[13px] tw:font-bold', selected ? 'tw:bg-primary tw:text-primary-foreground' : 'tw:bg-secondary tw:text-muted-foreground')}>
        {(user.fullName || user.username || '?').charAt(0).toUpperCase()}
      </span>
      <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <span className={cn('tw:truncate tw:text-entry tw:font-semibold', selected && 'tw:text-head')}>{user.fullName || user.username}</span>
        <span className="tw:flex tw:items-center tw:gap-1 tw:text-[10px] tw:text-muted-foreground">
          <Shield className="tw:size-2.5" /> {roleLabel(user.role)} &bull; {user.username}
          {status !== 'active' && <span className={cn('tw:font-bold', user.status === 'locked' ? 'tw:text-warning' : 'tw:text-destructive')}> &bull; {String(user.status).toUpperCase()}</span>}
        </span>
      </span>
      <span title={status} className={cn('tw:size-2 tw:shrink-0 tw:rounded-full tw:border tw:border-white', STATUS_DOT[status] || 'tw:bg-destructive')} />
    </Button>
  );
}

export default function UserDirectorySection({ ctx }) {
  const { users, selectedUser, handleUserSelect, userSearch, setUserSearch } = ctx;
  return (
    <Card className="tw:flex tw:max-h-[40vh] tw:flex-col tw:gap-0 tw:overflow-hidden tw:p-0 tw:lg:max-h-none tw:lg:w-[280px] tw:lg:shrink-0">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3">
        <h2 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-[15px] tw:font-bold">
          <span className="tw:rounded tw:bg-primary/10 tw:p-1"><User className="tw:size-4 tw:text-primary" /></span>
          User Directory
        </h2>
        <Input leftIcon={Search} data-allow-text="" placeholder="Search by name or ID..." value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
      </div>
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-0.5 tw:overflow-y-auto tw:p-2">
        {users.map((user, index) => (
          <UserRow key={user.id ?? index} user={user} selected={selectedUser?.id === user.id} onPick={() => handleUserSelect(user)} />
        ))}
      </div>
    </Card>
  );
}
