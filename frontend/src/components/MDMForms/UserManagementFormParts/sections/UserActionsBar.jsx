import { CheckCircle, Lock, Printer, RefreshCw, Save, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';

export default function UserActionsBar({ ctx }) {
  const { selectedUser, handlePrint, handleClear, handleEnableUser, handleDisableUser, handleLockUser, handleSave } = ctx;
  const inactiveStatus = selectedUser?.status && selectedUser.status !== 'active' ? selectedUser.status : '';
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:border-t tw:border-border tw:bg-card tw:px-3 tw:py-1.5 tw:md:pr-[60px]">
      <Button onClick={handlePrint}><Printer /> Print</Button>
      <Button onClick={handleClear}><RefreshCw /> Clear / New</Button>
      <div className="tw:flex-1" />
      {inactiveStatus && <Button variant="success" onClick={handleEnableUser}><CheckCircle /> Enable ({inactiveStatus})</Button>}
      <Button variant="destructive" onClick={handleDisableUser}><XCircle /> Disable User</Button>
      <Button onClick={handleLockUser}><Lock /> Lock</Button>
      <Button variant="default" onClick={handleSave}><Save /> F7 SAVE</Button>
    </div>
  );
}
