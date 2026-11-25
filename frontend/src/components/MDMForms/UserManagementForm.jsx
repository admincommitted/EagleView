import { Card } from '@/components/ui';
import useUserManagement from './UserManagementFormParts/useUserManagement';
import UserDirectorySection from './UserManagementFormParts/sections/UserDirectorySection';
import UserProfileHeader from './UserManagementFormParts/sections/UserProfileHeader';
import UserDetailsSection from './UserManagementFormParts/sections/UserDetailsSection';
import SecuritySection from './UserManagementFormParts/sections/SecuritySection';
import PermissionsSection from './UserManagementFormParts/sections/PermissionsSection';
import UserActionsBar from './UserManagementFormParts/sections/UserActionsBar';

// users and their rights per module / form (F7 saves)
export default function UserManagementForm() {
  const ctx = useUserManagement();
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:p-2 tw:lg:h-full tw:lg:min-h-0 tw:lg:flex-row">
      <UserDirectorySection ctx={ctx} />
      <Card className="tw:min-w-0 tw:flex-1 tw:gap-0 tw:overflow-hidden">
        <UserProfileHeader ctx={ctx} />
        <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-2 tw:overflow-y-auto tw:px-3 tw:py-1.5">
          <UserDetailsSection ctx={ctx} />
          <SecuritySection ctx={ctx} />
          <PermissionsSection ctx={ctx} />
        </div>
        <UserActionsBar ctx={ctx} />
      </Card>
    </div>
  );
}
