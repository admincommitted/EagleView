import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui';

export default function SaveAllBar({ ctx }) {
  const { handleSaveAll, savingAll } = ctx;
  // the right gap leaves room for the chat robot button that sits over that corner
  return (
    <div className="tw:sticky tw:bottom-0 tw:z-10 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:bg-linear-to-t tw:from-page tw:from-80% tw:to-transparent tw:pt-4 tw:pr-[90px] tw:pb-1">
      <div className="tw:text-[11px] tw:text-muted-foreground">💾 CLICK <b>SAVE ALL SETTINGS</b> TO SAVE ALL CHANGES</div>
      <Button variant="success" onClick={handleSaveAll} disabled={savingAll} className="tw:border-success tw:bg-success tw:text-white tw:hover:bg-success/85">
        {savingAll ? <Loader2 className="tw:animate-spin" /> : <Save />}
        {savingAll ? 'Saving...' : 'Save All Settings'}
      </Button>
    </div>
  );
}
