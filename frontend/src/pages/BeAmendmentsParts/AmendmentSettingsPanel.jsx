import { Button, DataTable, Input } from '@/components/ui';
import { dmy } from '@/components/BeAmendment/beAmendApi';

const SERIES_COLUMNS = [
  { key: 'branchCode', header: 'Branch' },
  { key: 'division', header: 'Div' },
  { key: 'fyCode', header: 'FY' },
  { key: 'last', header: 'Last', cell: (series) => `${series.lastNo || '-'} ${series.lastDate ? 'dt ' + dmy(series.lastDate) : ''}` },
  { key: 'nextNo', header: 'Next', className: 'tw:font-bold' },
];

export default function AmendmentSettingsPanel({ settings, mailTo, onMailToChange, onSaveMailTo }) {
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:rounded-md tw:border tw:border-border tw:bg-card tw:px-3 tw:py-2.5 tw:text-entry tw:lg:grid-cols-2">
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5">
        <b>Direct to ICEGATE (mail)</b>
        <span className="tw:text-muted-foreground">The signed file is mailed to this address from {settings.smtpUser || 'the Settings > Email account'}.</span>
        <div className="tw:flex tw:gap-1.5">
          <Input type="email" placeholder="ICEGATE mail address" value={mailTo} onChange={(event) => onMailToChange(event.target.value)} />
          <Button onClick={onSaveMailTo}>Save</Button>
        </div>
      </div>
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5">
        <b>Amendment numbers</b>
        <DataTable columns={SERIES_COLUMNS} rows={settings.series || []} rowKey={(series, index) => index} emptyText="No number series" />
        <span className="tw:text-muted-foreground">Continues the iCAFFE series. Change it in Settings &gt; Number Series (BE_AMEND).</span>
      </div>
    </div>
  );
}
